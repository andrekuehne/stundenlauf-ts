import { categoryKey, isEffectiveRace, projectState } from "@/domain/projection.ts";
import type { DomainEvent } from "@/domain/events.ts";
import type {
  IncomingRowData,
  PersonIdentity,
  RaceCategory,
  RaceEvent,
  SeasonDescriptor,
  SeasonState,
  Team,
} from "@/domain/types.ts";
import { consumeImportFile, peekImportFile } from "@/api/import-file-registry.ts";
import {
  finalizeImport as finalizeOrchestratedImport,
  getReviewQueue,
  resolveReviewEntry,
  runMatching,
  type ImportSession,
} from "@/import/orchestrator.ts";
import { defaultMatchingConfig } from "@/matching/config.ts";
import { alignCoupleMembersForDisplay } from "@/matching/review-display.ts";
import { canonicalizeClub, canonicalizePersonNames } from "@/domain/person-identity.ts";
import { resolveSeasonYear } from "@/domain/season-year.ts";
import { splitDisplayNameParts } from "@/lib/normalization.ts";
import { triggerDownload } from "@/portability/download.ts";
import { computeStandings } from "@/ranking/index.ts";
import { exclusionsForCategory, markExclusions } from "@/ranking/exclusions.ts";
import { getSeasonRepository, type SeasonRepository } from "@/services/season-repository.ts";
import type {
  AppApi,
  AppCommandResult,
  HistoryData,
  HistoryHardResetInput,
  HistoryPreviewInput,
  HistoryPreviewState,
  HistoryQuery,
  HistoryRollbackInput,
  HistoryRow,
  ImportDraftInput,
  ImportMatchingConfigInput,
  ImportDraftState,
  ImportFieldComparison,
  ImportReviewCorrectionInput,
  ImportReviewCandidate,
  ImportReviewDecision,
  ImportReviewItem,
  ImportWizardStep,
  SeasonListItem,
  StandingsData,
  StandingsRow,
  StandingsRowIdentity,
  StandingsRowIdentityCorrectionInput,
} from "../contracts/index.ts";

export const TS_APP_API_METHOD_MAP = {
  getShellData: [
    "SeasonRepository.listSeasons()",
    "projectState() for derived season metadata",
    "getReviewQueue() for unresolved review counts",
  ],
  listSeasons: ["SeasonRepository.listSeasons()", "projectState() for event counts and last activity"],
  createSeason: ["SeasonRepository.createSeason(label)"],
  openSeason: ["SeasonRepository.getEventLog(seasonId)", "projectState(seasonId, eventLog)"],
  deleteSeason: ["SeasonRepository.deleteSeason(seasonId)"],
  runSeasonCommand: ["exportSeason()", "importSeason()"],
  getStandings: ["SeasonRepository.getEventLog(seasonId)", "projectState()", "computeStandings()"],
  setStandingsRowExcluded: ["appendEvents()", "ranking.eligibility_set"],
  getStandingsRowIdentity: ["SeasonRepository.getEventLog(seasonId)", "projectState()", "team + person lookup"],
  correctStandingsRowIdentity: ["appendEvents()", "person.corrected per member"],
  runExportAction: ["exportLaufuebersichtDualPdfs()", "exportGesamtwertungWorkbook()"],
  getHistory: ["SeasonRepository.getEventLog(seasonId)", "projectState()", "legacy timeline synthesis adapter"],
  previewHistoryState: ["SeasonRepository.getEventLog(seasonId)", "projectState(seasonId, eventsPrefix)"],
  rollbackHistory: ["appendEvents()", "race.rolled_back", "import_batch.rolled_back"],
  hardResetHistoryToSeq: ["SeasonRepository.getEventLog(seasonId)", "writeEventLog(seasonId, eventsPrefix)"],
} as const;

const APP_VERSION = "stundenlauf-ts-ts-app-api-0.1.0";

type SeasonSnapshot = {
  descriptor: SeasonDescriptor;
  eventLog: DomainEvent[];
  state: SeasonState;
};

type DraftDecision = ImportReviewDecision & { updatedAt: number };

type DraftIdentityCorrectionTarget = {
  personId: string;
  member: "a" | "b" | null;
};

type DraftIdentityCorrection = {
  reviewId: string;
  personId: string;
  member: "a" | "b" | null;
  name: string;
  yob: number;
  club: string;
};

type ImportDraftRecord = {
  draftId: string;
  session: ImportSession;
  decisionByReviewId: Map<string, DraftDecision>;
  typoFixReviewIds: Set<string>;
  category: ImportDraftInput["category"];
  raceNumber: number;
  sourceFileName: string;
  correctionByReviewId: Map<string, DraftIdentityCorrection[]>;
};

function asInfo(message: string): AppCommandResult {
  return { severity: "info", message };
}

function asSuccess(message: string): AppCommandResult {
  return { severity: "success", message };
}

function asWarn(message: string): AppCommandResult {
  return { severity: "warn", message };
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("de-DE").format(date);
}

function categoryLabel(category: RaceCategory): string {
  const duration = category.duration === "half_hour" ? "30 Minuten" : "60 Minuten";
  const divisionLabels: Record<RaceCategory["division"], string> = {
    men: "Herren",
    women: "Damen",
    couples_men: "Paare Herren",
    couples_women: "Paare Damen",
    couples_mixed: "Paare Mixed",
  };
  return `${duration} ${divisionLabels[category.division]}`;
}

async function promptForFile(accept: string): Promise<File | null> {
  if (typeof document === "undefined") {
    return null;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.position = "fixed";
    input.style.left = "-10000px";
    input.style.top = "-10000px";
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] ?? null;
        input.remove();
        resolve(file);
      },
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  });
}

function eventSummary(event: DomainEvent): string {
  switch (event.type) {
    case "import_batch.recorded":
      return `Import-Batch "${event.payload.source_file}" angelegt.`;
    case "import_batch.rolled_back":
      return `Import-Batch ${event.payload.import_batch_id} zurückgerollt.`;
    case "race.registered":
      return `Lauf ${event.payload.race_no} (${categoryLabel(event.payload.category)}) importiert.`;
    case "race.rolled_back":
      return `Lauf ${event.payload.race_event_id} zurückgerollt.`;
    case "race.metadata_corrected":
      return `Metadaten für Lauf ${event.payload.race_event_id} korrigiert.`;
    case "entry.corrected":
      return `Ergebniseintrag ${event.payload.entry_id} korrigiert.`;
    case "entry.reassigned":
      return `Ergebniseintrag ${event.payload.entry_id} neu zugeordnet.`;
    case "person.corrected":
      return `Person ${event.payload.person_id} korrigiert.`;
    case "person.registered":
      return `Person ${event.payload.display_name ?? event.payload.person_id} angelegt.`;
    case "team.registered":
      return `Team ${event.payload.team_id} angelegt.`;
    case "ranking.eligibility_set":
      return `Wertungsstatus aktualisiert (${event.payload.team_id}).`;
  }
}

function eventScope(eventType: DomainEvent["type"]): HistoryRow["scope"] {
  if (eventType.startsWith("import_batch.")) return "batch";
  if (eventType.startsWith("race.") || eventType.startsWith("entry.")) return "race";
  return "season";
}

function raceById(state: SeasonState): Map<string, RaceEvent> {
  return new Map([...state.race_events.values()].map((race) => [race.race_event_id, race]));
}

function teamLabel(team: Team, state: SeasonState): { name: string; yob?: number; yobPair?: string; club: string } {
  if (team.team_kind === "solo") {
    const person = state.persons.get(team.member_person_ids[0] ?? "");
    return {
      name: person?.display_name ?? team.team_id,
      club: person?.club ?? "—",
      yob: person?.yob && person.yob > 0 ? person.yob : undefined,
    };
  }
  const members = team.member_person_ids
    .map((personId) => state.persons.get(personId))
    .filter((person): person is PersonIdentity => person != null);
  const names = members.map((person) => person.display_name);
  const yobPair = members.map((person) => String(person.yob)).join(" / ");
  const clubs = [...new Set(members.map((person) => person.club).filter(Boolean))].join(" / ");
  return {
    name: names.join(" + ") || team.team_id,
    yobPair: yobPair || undefined,
    club: clubs || "—",
  };
}

function toSourceType(category: ImportDraftInput["category"]): "singles" | "couples" {
  return category === "doubles" ? "couples" : "singles";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function effectiveAutoMinForMatchingCap(config: {
  auto_merge_enabled: boolean;
  perfect_match_auto_merge: boolean;
  auto_min: number;
}): number {
  if (config.auto_merge_enabled) {
    return clamp01(config.auto_min);
  }
  if (config.perfect_match_auto_merge) {
    return 1.0;
  }
  return 1.01;
}

function toMatchingConfig(input: ImportMatchingConfigInput | undefined) {
  if (!input) {
    // Keep parity with legacy default ("Fuzzy-Automatik" + "Nur 100 % Ähnlichkeit").
    return defaultMatchingConfig({
      auto_merge_enabled: false,
      perfect_match_auto_merge: true,
      strict_normalized_auto_only: false,
      auto_min: 0.5,
      review_min: 0.5,
    });
  }
  const normalized = {
    auto_merge_enabled: input.autoMergeEnabled,
    perfect_match_auto_merge: input.perfectMatchAutoMerge,
    strict_normalized_auto_only: input.strictNormalizedAutoOnly,
    auto_min: clamp01(input.autoMin),
    review_min: clamp01(input.reviewMin),
  };
  const cappedReviewMin = Math.min(
    normalized.review_min,
    effectiveAutoMinForMatchingCap(normalized),
  );
  return defaultMatchingConfig({
    auto_merge_enabled: normalized.auto_merge_enabled,
    perfect_match_auto_merge: normalized.perfect_match_auto_merge,
    strict_normalized_auto_only: normalized.strict_normalized_auto_only,
    auto_min: normalized.auto_min,
    review_min: cappedReviewMin,
  });
}

function formatIncomingResult(entry: { points: number; distance_m: number }): string {
  return `${entry.points} Punkte · ${(entry.distance_m / 1000).toFixed(3)} km`;
}

function comparisonRow(label: string, incomingValue: string, candidateValue: string): ImportFieldComparison {
  return {
    fieldKey: label === "Name" ? "name" : label === "Jahrgang" ? "yob" : "club",
    label,
    incomingValue,
    candidateValue,
    isMatch: incomingValue.trim().toLowerCase() === candidateValue.trim().toLowerCase(),
  };
}

function splitCompositePair(value: string | null | undefined): [string, string] {
  if (!value) {
    return ["", ""];
  }
  const parts = value.split(" / ").map((part) => part.trim());
  return [parts[0] ?? "", parts[1] ?? ""];
}

function parseCompositeYobPair(yob: string | null | undefined): [number, number] {
  const [leftRaw, rightRaw] = splitCompositePair(yob);
  const parsePart = (raw: string): number => {
    if (!raw || raw === "—" || raw === "-") return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [parsePart(leftRaw), parsePart(rightRaw)];
}

function toDisplayPair(left: string, right: string): string {
  const leftSafe = left.trim() || "—";
  const rightSafe = right.trim() || "—";
  return `${leftSafe} / ${rightSafe}`;
}

function toDisplayYobPair(left: number, right: number): string {
  const leftSafe = left > 0 ? String(left) : "—";
  const rightSafe = right > 0 ? String(right) : "—";
  return `${leftSafe} / ${rightSafe}`;
}

function validateYob(yob: number): void {
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(yob) || yob < 1900 || yob > currentYear + 1) {
    throw new Error("Name und Jahrgang sind für die Korrektur erforderlich.");
  }
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name und Jahrgang sind für die Korrektur erforderlich.");
  }
  return trimmed;
}

function normalizeCorrectionClub(club: string): string {
  return club.trim();
}

function alignDoublesCandidateDisplay(
  incoming: IncomingRowData,
  candidate: {
    display_name: string;
    yob: number;
    yob_text?: string | null;
    club: string | null;
  },
): {
  displayName: string;
  yobText: string;
  clubText: string;
} {
  const [nameA, nameB] = splitCompositePair(candidate.display_name);
  const [clubA, clubB] = splitCompositePair(candidate.club);
  const [yobA, yobB] = parseCompositeYobPair(candidate.yob_text ?? null);
  if (!nameA || !nameB) {
    return {
      displayName: candidate.display_name,
      yobText: candidate.yob_text?.trim() || (candidate.yob > 0 ? String(candidate.yob) : "—"),
      clubText: candidate.club ?? "—",
    };
  }

  const memberA: PersonIdentity = {
    person_id: "candidate-member-a",
    given_name: "",
    family_name: "",
    display_name: nameA,
    name_normalized: "",
    yob: yobA,
    gender: "X",
    club: clubA || null,
    club_normalized: "",
  };
  const memberB: PersonIdentity = {
    person_id: "candidate-member-b",
    given_name: "",
    family_name: "",
    display_name: nameB,
    name_normalized: "",
    yob: yobB,
    gender: "X",
    club: clubB || null,
    club_normalized: "",
  };

  const [, aligned] = alignCoupleMembersForDisplay(
    {
      display_name: incoming.display_name,
      yob: incoming.yob_text ?? incoming.yob ?? null,
      club: incoming.club ?? null,
    },
    memberA,
    memberB,
  );
  const [first, second] = aligned;
  return {
    displayName: toDisplayPair(first.display_name, second.display_name),
    yobText: toDisplayYobPair(first.yob, second.yob),
    clubText: toDisplayPair(first.club ?? "", second.club ?? ""),
  };
}

function incomingYobLabel(incoming: IncomingRowData): string {
  if (incoming.yob_text?.trim()) {
    return incoming.yob_text.trim();
  }
  if (incoming.yob != null && Number.isFinite(incoming.yob) && incoming.yob > 0) {
    return String(incoming.yob);
  }
  return "—";
}

function buildReviewCandidate(
  incoming: IncomingRowData,
  candidate: {
    team_id: string;
    display_name: string;
    score: number;
    yob: number;
    yob_text?: string | null;
    club: string | null;
  },
): ImportReviewCandidate {
  const incomingClub = incoming.club ?? "—";
  const isDoublesIncoming = incoming.row_kind === "team";
  const alignedDoubles = isDoublesIncoming
    ? alignDoublesCandidateDisplay(incoming, candidate)
    : null;
  const candidateClub = alignedDoubles?.clubText ?? candidate.club ?? "—";
  const incomingYob = incomingYobLabel(incoming);
  const candidateYob = alignedDoubles?.yobText
    ?? (candidate.yob_text?.trim()
      ? candidate.yob_text.trim()
      : candidate.yob > 0
        ? String(candidate.yob)
        : "—");
  const candidateName = alignedDoubles?.displayName ?? candidate.display_name;
  return {
    candidateId: candidate.team_id,
    displayName: candidateName,
    confidence: candidate.score,
    isRecommended: false,
    fieldComparisons: [
      comparisonRow("Name", incoming.display_name, candidateName),
      comparisonRow("Jahrgang", incomingYob, candidateYob),
      comparisonRow("Verein", incomingClub, candidateClub),
    ],
  };
}

class TsAppApi implements AppApi {
  private readonly repoPromise: Promise<SeasonRepository>;
  private activeSeasonId: string | null = null;
  private readonly importDrafts = new Map<string, ImportDraftRecord>();

  constructor() {
    this.repoPromise = getSeasonRepository();
  }

  private async repo(): Promise<SeasonRepository> {
    return this.repoPromise;
  }

  private async ensureSeason(seasonId: string): Promise<SeasonDescriptor> {
    const repo = await this.repo();
    const season = await repo.getSeason(seasonId);
    if (!season) {
      throw new Error("Die ausgewählte Saison wurde nicht gefunden.");
    }
    return season;
  }

  private async loadSnapshot(seasonId: string): Promise<SeasonSnapshot> {
    const repo = await this.repo();
    const descriptor = await this.ensureSeason(seasonId);
    const eventLog = await repo.getEventLog(seasonId);
    return {
      descriptor,
      eventLog,
      state: projectState(seasonId, eventLog),
    };
  }

  private wizardStepForSession(session: ImportSession): ImportWizardStep {
    return session.phase === "committing" ? "summary" : "review_matches";
  }

  private toReviewItems(record: ImportDraftRecord): ImportReviewItem[] {
    const pendingAndResolved = [...record.session.review_queue];
    return pendingAndResolved.map((entry) => {
      const staged = record.session.section_results[entry.section_index]?.staged_entries[entry.entry_index];
      const candidates = entry.review_item.candidates.map((candidate) =>
        buildReviewCandidate(staged?.incoming ?? {
          display_name: entry.review_item.incoming_display_name,
          yob: entry.review_item.incoming_yob,
          yob_text: entry.review_item.incoming_yob > 0 ? String(entry.review_item.incoming_yob) : null,
          club: entry.review_item.incoming_club,
          row_kind: entry.review_item.incoming_kind,
          sheet_name: "",
          section_name: "",
          row_index: 0,
        }, candidate),
      );
      if (candidates.length > 0) {
        const topId = entry.review_item.candidates[0]?.team_id ?? null;
        for (const candidate of candidates) {
          candidate.isRecommended = candidate.candidateId === topId;
        }
      }
      return {
        reviewId: entry.entry_id,
        incoming: {
          displayName: entry.review_item.incoming_display_name,
          yob: entry.review_item.incoming_yob,
          club: entry.review_item.incoming_club,
          startNumber: Number.parseInt(staged?.startnr ?? "0", 10) || 0,
          resultLabel: staged ? formatIncomingResult(staged) : "—",
        },
        candidates,
      } satisfies ImportReviewItem;
    });
  }

  private toDecisionArray(record: ImportDraftRecord): ImportReviewDecision[] {
    return [...record.decisionByReviewId.values()]
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((decision) => ({
        reviewId: decision.reviewId,
        action: decision.action,
        candidateId: decision.candidateId,
      }));
  }

  private toDraftSummary(record: ImportDraftRecord) {
    const importedEntries = record.session.section_results.reduce(
      (sum, section) => sum + section.staged_entries.length,
      0,
    );
    const mergedEntries = record.session.section_results.reduce(
      (sum, section) => sum + section.staged_entries.filter((entry) => entry.resolution?.method !== "new_identity").length,
      0,
    );
    const newPersonsCreated = record.session.report.new_identities;
    const typoCorrections = record.typoFixReviewIds.size;
    const infos: string[] = [];
    const warnings: string[] = [];
    if (record.session.report.conflicts > 0) {
      warnings.push(`${record.session.report.conflicts} Konflikte wurden im Matching erkannt.`);
    }
    if (record.session.report.replay_overrides > 0) {
      const replayCount = record.session.report.replay_overrides;
      infos.push(
        replayCount === 1
          ? "1 Eintrag wurde aus früheren Zuordnungen automatisch zugeordnet."
          : `${replayCount} Einträge wurden aus früheren Zuordnungen automatisch zugeordnet.`,
      );
    }
    return {
      importedEntries,
      mergedEntries,
      newPersonsCreated,
      typoCorrections,
      infos,
      warnings,
    };
  }

  private toImportDraftState(record: ImportDraftRecord): ImportDraftState {
    return {
      draftId: record.draftId,
      seasonId: record.session.season_state_at_start.season_id,
      fileName: record.sourceFileName,
      category: record.category,
      raceNumber: record.raceNumber,
      step: this.wizardStepForSession(record.session),
      reviewItems: this.toReviewItems(record),
      decisions: this.toDecisionArray(record),
      summary: this.toDraftSummary(record),
    };
  }

  private resolveCorrectionTargets(
    record: ImportDraftRecord,
    input: ImportReviewCorrectionInput,
  ): DraftIdentityCorrectionTarget[] {
    const review = this.toReviewItems(record).find((item) => item.reviewId === input.reviewId);
    if (!review) {
      throw new Error("Die ausgewählte Prüfung wurde nicht gefunden.");
    }
    if (!review.candidates.some((candidate) => candidate.candidateId === input.candidateId)) {
      throw new Error("Bitte einen Kandidaten auswählen.");
    }
    const team = record.session.season_state_at_start.teams.get(input.candidateId);
    if (!team) {
      throw new Error("Zielperson für die Korrektur wurde nicht gefunden.");
    }
    if (team.team_kind === "solo") {
      const personId = team.member_person_ids[0];
      if (!personId) {
        throw new Error("Zielperson für die Korrektur wurde nicht gefunden.");
      }
      return [{ personId, member: null }];
    }
    const [personA, personB] = team.member_person_ids;
    if (!personA || !personB) {
      throw new Error("Zielperson für die Korrektur wurde nicht gefunden.");
    }
    return [
      { personId: personA, member: "a" },
      { personId: personB, member: "b" },
    ];
  }

  private toDraftIdentityCorrections(
    record: ImportDraftRecord,
    input: ImportReviewCorrectionInput,
  ): DraftIdentityCorrection[] {
    const targets = this.resolveCorrectionTargets(record, input);
    if (input.correction.type === "single") {
      const target = targets[0];
      if (!target) {
        throw new Error("Zielperson für die Korrektur wurde nicht gefunden.");
      }
      const name = validateName(input.correction.name);
      validateYob(input.correction.yob);
      return [{
        reviewId: input.reviewId,
        personId: target.personId,
        member: target.member,
        name,
        yob: input.correction.yob,
        club: normalizeCorrectionClub(input.correction.club),
      }];
    }

    if (targets.length < 2) {
      throw new Error("Team-Mitglieder für die Korrektur wurden nicht gefunden.");
    }
    const [targetA, targetB] = targets;
    if (!targetA || !targetB) {
      throw new Error("Team-Mitglieder für die Korrektur wurden nicht gefunden.");
    }
    const memberA = input.correction.memberA;
    const memberB = input.correction.memberB;
    const nameA = validateName(memberA.name);
    const nameB = validateName(memberB.name);
    validateYob(memberA.yob);
    validateYob(memberB.yob);
    return [
      {
        reviewId: input.reviewId,
        personId: targetA.personId,
        member: "a",
        name: nameA,
        yob: memberA.yob,
        club: normalizeCorrectionClub(memberA.club),
      },
      {
        reviewId: input.reviewId,
        personId: targetB.personId,
        member: "b",
        name: nameB,
        yob: memberB.yob,
        club: normalizeCorrectionClub(memberB.club),
      },
    ];
  }

  private buildPersonCorrectedEvent(
    seq: number,
    personId: string,
    name: string,
    yob: number,
    club: string | null,
    rationale: string,
  ): DomainEvent {
    const [givenName, familyName] = splitDisplayNameParts(name);
    const names = canonicalizePersonNames({
      given_name: givenName,
      family_name: familyName || name,
      display_name: name,
    });
    const canonicalClub = canonicalizeClub({ club });
    return {
      event_id: crypto.randomUUID(),
      seq,
      recorded_at: new Date().toISOString(),
      type: "person.corrected",
      schema_version: 1,
      payload: {
        person_id: personId,
        updated_fields: {
          given_name: names.given_name,
          family_name: names.family_name,
          display_name: names.display_name,
          name_normalized: names.name_normalized,
          yob,
          club: canonicalClub.club,
          club_normalized: canonicalClub.club_normalized,
        },
        rationale,
      },
      metadata: { app_version: APP_VERSION },
    };
  }

  async getShellData() {
    const seasons = await this.listSeasons();
    const selectedSeasonId =
      this.activeSeasonId && seasons.some((season) => season.seasonId === this.activeSeasonId)
        ? this.activeSeasonId
        : seasons.find((season) => season.isActive)?.seasonId ?? seasons[0]?.seasonId ?? null;
    if (selectedSeasonId) {
      this.activeSeasonId = selectedSeasonId;
    }
    const selected = seasons.find((season) => season.seasonId === selectedSeasonId) ?? null;
    const unresolvedReviews = [...this.importDrafts.values()].reduce(
      (sum, draft) => sum + getReviewQueue(draft.session).length,
      0,
    );
    return {
      selectedSeasonId,
      selectedSeasonLabel: selected?.label ?? null,
      unresolvedReviews,
      availableSeasons: seasons.map((season) => ({
        seasonId: season.seasonId,
        label: season.label,
      })),
    };
  }

  async listSeasons(): Promise<SeasonListItem[]> {
    const repo = await this.repo();
    const descriptors = await repo.listSeasons();
    const mapped = await Promise.all(
      descriptors.map(async (season) => {
        const events = await repo.getEventLog(season.season_id);
        const state = projectState(season.season_id, events);
        const importedEvents = [...state.race_events.values()].filter((race) =>
          isEffectiveRace(state, race.race_event_id),
        ).length;
        const lastModifiedAt = events[events.length - 1]?.recorded_at ?? season.created_at;
        return {
          seasonId: season.season_id,
          label: season.label,
          importedEvents,
          lastModifiedAt,
          isActive: season.season_id === this.activeSeasonId,
        } satisfies SeasonListItem;
      }),
    );
    return mapped.sort((a, b) => b.lastModifiedAt.localeCompare(a.lastModifiedAt));
  }

  async createSeason(input: { label: string }) {
    const label = input.label.trim();
    if (!label) {
      throw new Error("Bitte einen Saisonnamen eingeben.");
    }
    const repo = await this.repo();
    const created = await repo.createSeason(label);
    this.activeSeasonId = created.season_id;
    return {
      seasonId: created.season_id,
      label: created.label,
      importedEvents: 0,
      lastModifiedAt: created.created_at,
      isActive: true,
    };
  }

  async openSeason(seasonId: string) {
    await this.ensureSeason(seasonId);
    this.activeSeasonId = seasonId;
  }

  async deleteSeason(seasonId: string) {
    await this.ensureSeason(seasonId);
    const repo = await this.repo();
    await repo.deleteSeason(seasonId);
    if (this.activeSeasonId === seasonId) {
      const remaining = await repo.listSeasons();
      this.activeSeasonId = remaining[0]?.season_id ?? null;
    }
  }

  async runSeasonCommand(command: "import_backup" | "export_backup", seasonId?: string) {
    const selectedSeasonId = seasonId ?? this.activeSeasonId;
    if (!selectedSeasonId) {
      throw new Error("Bitte zuerst eine Saison auswählen.");
    }
    const season = await this.ensureSeason(selectedSeasonId);
    const repo = await this.repo();

    if (command === "export_backup") {
      const { exportSeason } = await import("@/portability/export-season.ts");
      const exported = await exportSeason(repo, selectedSeasonId, {
        filename: `stundenlauf-${season.label}`,
      });
      return asSuccess(
        `Saisonarchiv "${exported.filename}" wurde exportiert (${exported.events_total} Events).`,
      );
    }

    const file = await promptForFile(".zip,.stundenlauf-season.zip,application/zip");
    if (!file) {
      return asInfo("Import abgebrochen.");
    }
    const { importSeason } = await import("@/portability/import-season.ts");
    const imported = await importSeason(repo, file, {
      targetSeasonId: selectedSeasonId,
      replaceExisting: true,
      confirmSeasonId: selectedSeasonId,
      targetLabel: season.label,
    });
    return asSuccess(
      `Saison "${imported.label}" aus "${file.name}" importiert (${imported.events_imported} Events).`,
    );
  }

  async getStandings(seasonId: string): Promise<StandingsData> {
    const snapshot = await this.loadSnapshot(seasonId);
    const standings = computeStandings(snapshot.state);
    const races = [...snapshot.state.race_events.values()].filter((race) =>
      isEffectiveRace(snapshot.state, race.race_event_id),
    );
    const racesByCategory = new Map<string, RaceEvent[]>();
    for (const race of races) {
      const key = categoryKey(race.category);
      const current = racesByCategory.get(key) ?? [];
      current.push(race);
      racesByCategory.set(key, current);
    }

    const orderedRacesForCategory = (categoryKey: string): RaceEvent[] =>
      (racesByCategory.get(categoryKey) ?? [])
        .slice()
        .sort((a, b) => a.race_no - b.race_no || a.race_event_id.localeCompare(b.race_event_id));

    const categories = standings.category_tables.map((table) => {
      const orderedRaces = orderedRacesForCategory(table.category_key);
      return {
        key: table.category_key,
        label: categoryLabel(
          table.rows[0]?.race_contributions[0]
            ? races.find((race) => categoryKey(race.category) === table.category_key)?.category ?? {
                duration: "hour",
                division: "men",
              }
            : { duration: "hour", division: "men" },
        ),
        description: `Aktueller Wertungsstand für ${table.category_key}.`,
        participantCount: table.rows.length,
        importedRuns: orderedRaces.length,
        raceNos: orderedRaces.map((race) => race.race_no),
      };
    });

    const rowsByCategory = Object.fromEntries(
      standings.category_tables.map((table) => {
        const excludedTeamIds = exclusionsForCategory(snapshot.state, table.category_key);
        const marked = markExclusions(table, excludedTeamIds);
        const orderedRaces = orderedRacesForCategory(table.category_key);
        const rows: StandingsRow[] = marked.rows.map((row) => {
          const team = snapshot.state.teams.get(row.team_id);
          const label = team
            ? teamLabel(team, snapshot.state)
            : { name: row.team_id, club: "—" };
          const raceCells = orderedRaces.map((race) => {
            const contribution = row.race_contributions.find(
              (c) => c.race_event_id === race.race_event_id,
            ) ?? null;
            if (!contribution) return null;
            return {
              distanceKm: Math.round((contribution.distance_m / 1000) * 1000) / 1000,
              points: contribution.points,
              countsTowardTotal: contribution.counts_toward_total,
            };
          });
          return {
            rank: row.rank,
            team: label.name,
            teamId: row.team_id,
            club: label.club,
            ...(label.yob ? { yob: label.yob } : {}),
            ...(label.yobPair ? { yobPair: label.yobPair } : {}),
            points: row.total_points,
            distanceKm: Math.round((row.total_distance_m / 1000) * 1000) / 1000,
            races: row.race_contributions.filter((entry) => entry.counts_toward_total).length,
            raceCells,
            excluded: row.excluded,
          };
        });
        return [table.category_key, rows];
      }),
    );

    const importedRuns = races
      .slice()
      .sort((a, b) => a.race_no - b.race_no)
      .map((race) => ({
        raceLabel: `Lauf ${race.race_no}`,
        categoryLabel: categoryLabel(race.category),
        dateLabel: formatDateLabel(race.race_date),
        sourceLabel: snapshot.state.import_batches.get(race.import_batch_id)?.source_file ?? "Unbekannt",
        entries: race.entries.length,
      }));

    return {
      seasonId,
      summary: {
        seasonLabel: snapshot.descriptor.label,
        totalTeams: snapshot.state.teams.size,
        totalParticipants: snapshot.state.persons.size,
        totalRuns: races.length,
        lastUpdatedAt: snapshot.eventLog[snapshot.eventLog.length - 1]?.recorded_at ?? snapshot.descriptor.created_at,
      },
      categories,
      rowsByCategory,
      importedRuns,
      exportActions: [
        {
          id: "export_pdf",
          label: "PDF exportieren",
          description: "Laufübersicht als PDF exportieren.",
          availability: races.length > 0 ? "ready" : "planned",
        },
        {
          id: "export_excel",
          label: "Excel exportieren",
          description: "Gesamtwertung als Excel exportieren.",
          availability: races.length > 0 ? "ready" : "planned",
        },
      ],
    };
  }

  async runExportAction(
    seasonId: string,
    actionId: "export_pdf" | "export_excel" | "export_kids_excel",
    options?: { pdfLayoutPreset?: "default" | "compact" },
  ) {
    const snapshot = await this.loadSnapshot(seasonId);
    const seasonYear = resolveSeasonYear(snapshot.descriptor.label, snapshot.descriptor.created_at);
    if (actionId === "export_pdf") {
      const { exportLaufuebersichtDualPdfs } = await import("@/export/pdf.ts");
      const layoutPreset = options?.pdfLayoutPreset ?? "compact";
      const artifacts = exportLaufuebersichtDualPdfs(snapshot.state, {
        seasonYear,
        filenameBase: `stundenlauf-${seasonYear}-laufuebersicht`,
        layoutPreset,
      });
      for (const artifact of artifacts) {
        triggerDownload(artifact.blob, artifact.filename);
      }
      return asSuccess(`PDF-Export abgeschlossen (${artifacts.length} Datei(en)).`);
    }

    if (actionId === "export_kids_excel") {
      const { exportKidsParticipationWorkbook } = await import("@/export/excel.ts");
      const artifact = await exportKidsParticipationWorkbook(snapshot.state, {
        seasonYear,
        cutoffYear: seasonYear - 12,
        filenameBase: `stundenlauf-${seasonYear}-kids`,
      });
      triggerDownload(artifact.blob, artifact.filename);
      return asSuccess(`Kids Excel-Export "${artifact.filename}" wurde erstellt.`);
    }

    const { exportGesamtwertungWorkbook } = await import("@/export/excel.ts");
    const artifact = await exportGesamtwertungWorkbook(snapshot.state, {
      seasonYear,
      filenameBase: `stundenlauf-${seasonYear}-ergebnisse`,
    });
    triggerDownload(artifact.blob, artifact.filename);
    return asSuccess(`Excel-Export "${artifact.filename}" wurde erstellt.`);
  }

  async setStandingsRowExcluded(
    seasonId: string,
    input: { categoryKey: string; teamId: string; excluded: boolean },
  ): Promise<void> {
    const snapshot = await this.loadSnapshot(seasonId);
    if (!snapshot.state.teams.has(input.teamId)) {
      throw new Error("Der gewählte Wertungseintrag wurde nicht gefunden.");
    }

    const table = computeStandings(snapshot.state).category_tables.find(
      (entry) => entry.category_key === input.categoryKey,
    );
    const teamInCategory = table?.rows.some((row) => row.team_id === input.teamId) ?? false;
    if (!teamInCategory) {
      throw new Error("Der gewählte Wertungseintrag passt nicht zur Kategorie.");
    }

    const [duration, division] = input.categoryKey.split(":");
    if (
      (duration !== "half_hour" && duration !== "hour") ||
      (
        division !== "men" &&
        division !== "women" &&
        division !== "couples_men" &&
        division !== "couples_women" &&
        division !== "couples_mixed"
      )
    ) {
      throw new Error("Ungültige Kategorie.");
    }

    const repo = await this.repo();
    await repo.appendEvents(seasonId, [{
      event_id: crypto.randomUUID(),
      seq: snapshot.eventLog.length,
      recorded_at: new Date().toISOString(),
      type: "ranking.eligibility_set",
      schema_version: 1,
      payload: {
        category: { duration, division },
        team_id: input.teamId,
        eligible: !input.excluded,
      },
      metadata: {
        app_version: APP_VERSION,
      },
    }]);
  }

  async getStandingsRowIdentity(
    seasonId: string,
    input: { categoryKey: string; teamId: string },
  ): Promise<StandingsRowIdentity> {
    const snapshot = await this.loadSnapshot(seasonId);
    const team = snapshot.state.teams.get(input.teamId);
    if (!team) {
      throw new Error("Der gewählte Wertungseintrag wurde nicht gefunden.");
    }
    const members = team.member_person_ids.map((personId) => {
      const person = snapshot.state.persons.get(personId);
      if (!person) {
        throw new Error(`Person ${personId} wurde nicht gefunden.`);
      }
      return {
        personId: person.person_id,
        name: person.display_name,
        yob: person.yob,
        club: person.club ?? "",
      };
    });
    return {
      teamId: input.teamId,
      teamKind: team.team_kind === "couple" ? "couple" : "solo",
      members,
    };
  }

  async correctStandingsRowIdentity(
    seasonId: string,
    input: StandingsRowIdentityCorrectionInput,
  ): Promise<AppCommandResult> {
    const snapshot = await this.loadSnapshot(seasonId);
    const team = snapshot.state.teams.get(input.teamId);
    if (!team) {
      throw new Error("Der gewählte Wertungseintrag wurde nicht gefunden.");
    }

    const repo = await this.repo();
    const currentEvents = await repo.getEventLog(seasonId);
    let seqCursor = currentEvents.reduce((max, ev) => Math.max(max, ev.seq), -1) + 1;
    const events: DomainEvent[] = [];

    for (const member of input.members) {
      const existing = snapshot.state.persons.get(member.personId);
      if (!existing) {
        throw new Error(`Person ${member.personId} wurde nicht gefunden.`);
      }
      events.push(this.buildPersonCorrectedEvent(
        seqCursor++,
        member.personId,
        member.name,
        member.yob,
        member.club || null,
        "Korrektur über Korrekturen-Ansicht",
      ));
    }

    await repo.appendEvents(seasonId, events);
    return asSuccess("Teilnehmerdaten gespeichert.");
  }

  async createImportDraft(input: ImportDraftInput) {
    await this.ensureSeason(input.seasonId);
    const fileName = input.fileName.trim();
    if (!fileName) {
      throw new Error("Bitte eine Datei auswählen.");
    }
    if (!Number.isInteger(input.raceNumber) || input.raceNumber < 1) {
      throw new Error("Bitte eine gültige Laufnummer wählen.");
    }
    const file = consumeImportFile(fileName) ?? peekImportFile(fileName);
    if (!file) {
      throw new Error("Bitte die Importdatei erneut auswählen.");
    }

    const snapshot = await this.loadSnapshot(input.seasonId);
    const { startImport } = await import("@/import/start-import.ts");
    let session = await startImport(file, snapshot.state, {
      sourceType: toSourceType(input.category),
      raceNoOverride: input.raceNumber,
    });
    session = await runMatching(session, toMatchingConfig(input.matchingConfig));

    const draftId = crypto.randomUUID();
    const record: ImportDraftRecord = {
      draftId,
      session,
      decisionByReviewId: new Map(),
      typoFixReviewIds: new Set(),
      category: input.category,
      raceNumber: input.raceNumber,
      sourceFileName: fileName,
      correctionByReviewId: new Map(),
    };
    this.importDrafts.set(draftId, record);
    return this.toImportDraftState(record);
  }

  getImportDraft(draftId: string) {
    const draft = this.importDrafts.get(draftId);
    if (!draft) {
      throw new Error("Der Import-Entwurf wurde nicht gefunden.");
    }
    return Promise.resolve(this.toImportDraftState(draft));
  }

  setImportReviewDecision(draftId: string, decision: ImportReviewDecision) {
    const draft = this.importDrafts.get(draftId);
    if (!draft) {
      throw new Error("Der Import-Entwurf wurde nicht gefunden.");
    }
    if (draft.session.phase !== "reviewing") {
      throw new Error("Es gibt keine offenen Prüffälle mehr.");
    }
    const review = draft.session.review_queue.find((entry) => entry.entry_id === decision.reviewId);
    if (!review) {
      throw new Error("Die ausgewählte Prüfung wurde nicht gefunden.");
    }

    if (decision.action === "create_new") {
      draft.session = resolveReviewEntry(draft.session, decision.reviewId, { type: "create_new_identity" });
    } else {
      if (!decision.candidateId) {
        throw new Error("Bitte einen Kandidaten auswählen.");
      }
      draft.session = resolveReviewEntry(draft.session, decision.reviewId, {
        type: "link_existing",
        team_id: decision.candidateId,
      });
      if (decision.action === "merge_with_typo_fix") {
        draft.typoFixReviewIds.add(decision.reviewId);
      } else {
        draft.typoFixReviewIds.delete(decision.reviewId);
      }
    }
    draft.decisionByReviewId.set(decision.reviewId, { ...decision, updatedAt: Date.now() });
    return Promise.resolve(this.toImportDraftState(draft));
  }

  applyImportReviewCorrection(draftId: string, input: ImportReviewCorrectionInput) {
    const draft = this.importDrafts.get(draftId);
    if (!draft) {
      throw new Error("Der Import-Entwurf wurde nicht gefunden.");
    }
    if (draft.session.phase !== "reviewing") {
      throw new Error("Es gibt keine offenen Prüffälle mehr.");
    }
    const corrections = this.toDraftIdentityCorrections(draft, input);
    draft.correctionByReviewId.set(input.reviewId, corrections);
    draft.session = resolveReviewEntry(draft.session, input.reviewId, {
      type: "link_existing",
      team_id: input.candidateId,
    });
    draft.typoFixReviewIds.add(input.reviewId);
    draft.decisionByReviewId.set(input.reviewId, {
      reviewId: input.reviewId,
      action: "merge_with_typo_fix",
      candidateId: input.candidateId,
      updatedAt: Date.now(),
    });
    return Promise.resolve(this.toImportDraftState(draft));
  }

  async finalizeImportDraft(draftId: string) {
    const draft = this.importDrafts.get(draftId);
    if (!draft) {
      throw new Error("Der Import-Entwurf wurde nicht gefunden.");
    }
    if (draft.session.phase !== "committing") {
      throw new Error("Bitte erst alle offenen Zuordnungen abschließen.");
    }
    const repo = await this.repo();
    const currentEvents = await repo.getEventLog(draft.session.season_state_at_start.season_id);
    const nextSeq = currentEvents.reduce((max, event) => Math.max(max, event.seq), -1) + 1;
    const correctionEvents: DomainEvent[] = [];
    let seqCursor = nextSeq;
    for (const corrections of draft.correctionByReviewId.values()) {
      for (const correction of corrections) {
        correctionEvents.push(this.buildPersonCorrectedEvent(
          seqCursor++,
          correction.personId,
          correction.name,
          correction.yob,
          correction.club || null,
          correction.member == null
            ? "Import review merge_with_typo_fix"
            : `Import review merge_with_typo_fix member ${correction.member}`,
        ));
      }
    }
    const importEvents = finalizeOrchestratedImport(draft.session, { startSeq: seqCursor });
    await repo.appendEvents(draft.session.season_state_at_start.season_id, [...correctionEvents, ...importEvents]);
    this.importDrafts.delete(draftId);
    return asSuccess(
      `Import erfolgreich abgeschlossen: ${draft.sourceFileName} (${draft.session.report.rows_imported} Einträge).`,
    );
  }

  async getHistory(seasonId: string, query?: HistoryQuery): Promise<HistoryData> {
    const snapshot = await this.loadSnapshot(seasonId);
    const raceMap = raceById(snapshot.state);
    const raceEventId = query?.raceEventId ?? null;
    const rows = snapshot.eventLog
      .filter((event) => query?.includeNonRace || !raceEventId || (event.payload as { race_event_id?: string }).race_event_id === raceEventId)
      .map((event) => {
        const payload = event.payload as {
          race_event_id?: string;
          import_batch_id?: string;
        };
        const rowRaceEventId = payload.race_event_id ?? null;
        const rowImportBatchId = payload.import_batch_id ?? null;
        const effective =
          rowRaceEventId == null ? true : isEffectiveRace(snapshot.state, rowRaceEventId);
        return {
          seq: event.seq,
          recordedAt: event.recorded_at,
          eventId: event.event_id,
          type: event.type,
          summary: eventSummary(event),
          scope: eventScope(event.type),
          raceEventId: rowRaceEventId,
          importBatchId: rowImportBatchId,
          groupKey: rowImportBatchId,
          isEffectiveChange: effective,
          actionability: {
            canPreviewRollbackAtomic: Boolean(rowRaceEventId && effective),
            canPreviewRollbackGroup: Boolean(rowImportBatchId && effective),
            canHardResetToHere: true,
          },
        } satisfies HistoryRow;
      });

    const contextRace =
      (raceEventId ? raceMap.get(raceEventId) : null) ??
      [...raceMap.values()].find((race) => isEffectiveRace(snapshot.state, race.race_event_id)) ??
      null;

    const importBatches = snapshot.eventLog
      .filter((event) => event.type === "import_batch.recorded")
      .map((event) => {
        const payload = event.payload as { import_batch_id: string; source_file: string };
        const batchState = snapshot.state.import_batches.get(payload.import_batch_id)?.state ?? "active";
        const batchRace = [...snapshot.state.race_events.values()].find(
          (race) => race.import_batch_id === payload.import_batch_id,
        );
        return {
          importBatchId: payload.import_batch_id,
          sourceFile: payload.source_file,
          recordedAt: event.recorded_at,
          anchorSeq: event.seq,
          state: batchState,
          categoryLabel: batchRace ? categoryLabel(batchRace.category) : null,
        };
      });

    return {
      seasonId,
      seasonLabel: snapshot.descriptor.label,
      raceContext: contextRace
        ? {
            raceEventId: contextRace.race_event_id,
            raceLabel: `Lauf ${contextRace.race_no}`,
            categoryLabel: categoryLabel(contextRace.category),
            raceDateLabel: formatDateLabel(contextRace.race_date),
          }
        : null,
      rows,
      importBatches,
    };
  }

  async previewHistoryState(seasonId: string, input: HistoryPreviewInput): Promise<HistoryPreviewState> {
    const snapshot = await this.loadSnapshot(seasonId);
    const anchor = snapshot.eventLog.find((event) => event.seq === input.anchorSeq);
    if (!anchor) {
      throw new Error("Der ausgewählte Verlaufspunkt wurde nicht gefunden.");
    }
    return {
      anchorSeq: anchor.seq,
      isFrozen: true,
      derivedStateLabel: `Historischer Stand bis seq ${anchor.seq}`,
      blockedReason: "Vorschau aktiv: weitere Änderungen sind vorübergehend gesperrt.",
    };
  }

  async rollbackHistory(seasonId: string, input: HistoryRollbackInput): Promise<AppCommandResult> {
    const snapshot = await this.loadSnapshot(seasonId);
    const anchor = snapshot.eventLog.find((event) => event.seq === input.anchorSeq);
    if (!anchor) {
      throw new Error("Der ausgewählte Verlaufspunkt wurde nicht gefunden.");
    }
    const repo = await this.repo();
    let nextSeq = snapshot.eventLog.length;
    const newEvents: DomainEvent[] = [];
    const reason = input.reason.trim() || "ui.history.rollback";

    if (input.mode === "atomic") {
      const raceEventId = input.raceEventId ?? (anchor.payload as { race_event_id?: string }).race_event_id;
      if (!raceEventId) {
        throw new Error("Für Atomic-Rollback fehlt ein Laufkontext.");
      }
      newEvents.push({
        event_id: crypto.randomUUID(),
        seq: nextSeq++,
        recorded_at: new Date().toISOString(),
        type: "race.rolled_back",
        schema_version: 1,
        payload: {
          race_event_id: raceEventId,
          reason,
        },
        metadata: {
          app_version: APP_VERSION,
        },
      });
      await repo.appendEvents(seasonId, newEvents);
      return asSuccess(`Rollback für Laufkontext ab seq ${input.anchorSeq} wurde ausgeführt.`);
    }

    const importBatchId =
      input.importBatchId ?? (anchor.payload as { import_batch_id?: string }).import_batch_id;
    if (!importBatchId) {
      throw new Error("Für Gruppen-Rollback fehlt eine Importgruppe.");
    }
    const racesInBatch = [...snapshot.state.race_events.values()].filter(
      (race) => race.import_batch_id === importBatchId && race.state === "active",
    );
    for (const race of racesInBatch) {
      newEvents.push({
        event_id: crypto.randomUUID(),
        seq: nextSeq++,
        recorded_at: new Date().toISOString(),
        type: "race.rolled_back",
        schema_version: 1,
        payload: {
          race_event_id: race.race_event_id,
          reason,
        },
        metadata: {
          app_version: APP_VERSION,
          import_batch_id: importBatchId,
        },
      });
    }
    newEvents.push({
      event_id: crypto.randomUUID(),
      seq: nextSeq++,
      recorded_at: new Date().toISOString(),
      type: "import_batch.rolled_back",
      schema_version: 1,
      payload: {
        import_batch_id: importBatchId,
        reason,
      },
      metadata: {
        app_version: APP_VERSION,
        import_batch_id: importBatchId,
      },
    });
    await repo.appendEvents(seasonId, newEvents);
    return asSuccess(`Gruppen-Rollback für Importgruppe ab seq ${input.anchorSeq} wurde ausgeführt.`);
  }

  async hardResetHistoryToSeq(seasonId: string, input: HistoryHardResetInput): Promise<AppCommandResult> {
    await this.ensureSeason(seasonId);
    const repo = await this.repo();
    const eventLog = await repo.getEventLog(seasonId);
    const anchorIndex = eventLog.findIndex((event) => event.seq === input.anchorSeq);
    if (anchorIndex < 0) {
      throw new Error("Der ausgewählte Verlaufspunkt wurde nicht gefunden.");
    }
    const exclusive = input.truncateMode === "exclusive";
    const nextEvents = exclusive ? eventLog.slice(0, anchorIndex) : eventLog.slice(0, anchorIndex + 1);
    await repo.clearEventLog(seasonId);
    if (nextEvents.length > 0) {
      await repo.appendEvents(seasonId, nextEvents);
    }
    return asWarn(`Hard reset bis seq ${input.anchorSeq} durchgeführt. Nachfolgende Events wurden verworfen.`);
  }
}

export function createTsAppApi(): AppApi {
  return new TsAppApi();
}
