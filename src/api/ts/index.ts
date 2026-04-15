import {
  exportGesamtwertungWorkbook,
  exportLaufuebersichtDualPdfs,
} from "@/export/index.ts";
import { categoryKey, isEffectiveRace, projectState } from "@/domain/projection.ts";
import type { DomainEvent } from "@/domain/events.ts";
import type {
  RaceCategory,
  RaceEvent,
  SeasonDescriptor,
  SeasonState,
  Team,
} from "@/domain/types.ts";
import { importSeason, exportSeason } from "@/portability/index.ts";
import { triggerDownload } from "@/portability/download.ts";
import { computeStandings } from "@/ranking/index.ts";
import { getSeasonRepository, type SeasonRepository } from "@/services/season-repository.ts";
import { createMockAppApi } from "../mock/index.ts";
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
  ImportReviewDecision,
  SeasonListItem,
  StandingsData,
  StandingsRow,
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

function extractSeasonYear(label: string, createdAt: string): number {
  const explicit = label.match(/\b(19|20)\d{2}\b/);
  if (explicit) {
    return Number(explicit[0]);
  }
  const created = new Date(createdAt);
  if (!Number.isNaN(created.getTime())) {
    return created.getFullYear();
  }
  return new Date().getFullYear();
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

function teamLabel(team: Team, state: SeasonState): { name: string; yobPair?: string; club: string } {
  if (team.team_kind === "solo") {
    const person = state.persons.get(team.member_person_ids[0] ?? "");
    return {
      name: person?.display_name ?? team.team_id,
      club: person?.club ?? "—",
      yobPair: person?.yob ? String(person.yob) : undefined,
    };
  }
  const members = team.member_person_ids.map((personId) => state.persons.get(personId)).filter(Boolean);
  const names = members.map((person) => person!.display_name);
  const yobPair = members.map((person) => String(person!.yob)).join(" / ");
  const clubs = [...new Set(members.map((person) => person!.club).filter(Boolean))].join(" / ");
  return {
    name: names.join(" + ") || team.team_id,
    yobPair: yobPair || undefined,
    club: clubs || "—",
  };
}

class TsAppApi implements AppApi {
  private readonly repoPromise: Promise<SeasonRepository>;
  private readonly mockImportApi = createMockAppApi();
  private activeSeasonId: string | null = null;

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
    return {
      selectedSeasonId,
      selectedSeasonLabel: selected?.label ?? null,
      unresolvedReviews: 0,
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

    const categories = standings.category_tables.map((table) => ({
      key: table.category_key,
      label: categoryLabel(table.rows[0]?.race_contributions[0] ? races.find((race) => categoryKey(race.category) === table.category_key)?.category ?? { duration: "hour", division: "men" } : { duration: "hour", division: "men" }),
      description: `Aktueller Wertungsstand für ${table.category_key}.`,
      participantCount: table.rows.length,
      importedRuns: racesByCategory.get(table.category_key)?.length ?? 0,
    }));

    const rowsByCategory = Object.fromEntries(
      standings.category_tables.map((table) => {
        const rows: StandingsRow[] = table.rows.map((row) => {
          const team = snapshot.state.teams.get(row.team_id);
          const label = team
            ? teamLabel(team, snapshot.state)
            : { name: row.team_id, club: "—" };
          return {
            rank: row.rank,
            team: label.name,
            club: label.club,
            points: row.total_points,
            distanceKm: Math.round((row.total_distance_m / 1000) * 1000) / 1000,
            races: row.race_contributions.filter((entry) => entry.counts_toward_total).length,
            ...(label.yobPair ? { note: `Jg: ${label.yobPair}` } : {}),
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

  async runExportAction(seasonId: string, actionId: "export_pdf" | "export_excel") {
    const snapshot = await this.loadSnapshot(seasonId);
    const seasonYear = extractSeasonYear(snapshot.descriptor.label, snapshot.descriptor.created_at);
    if (actionId === "export_pdf") {
      const artifacts = exportLaufuebersichtDualPdfs(snapshot.state, {
        seasonYear,
        filenameBase: `stundenlauf-${seasonYear}-laufuebersicht`,
      });
      for (const artifact of artifacts) {
        triggerDownload(artifact.blob, artifact.filename);
      }
      return asSuccess(`PDF-Export abgeschlossen (${artifacts.length} Datei(en)).`);
    }

    const artifact = await exportGesamtwertungWorkbook(snapshot.state, {
      seasonYear,
      filenameBase: `stundenlauf-${seasonYear}-ergebnisse`,
    });
    triggerDownload(artifact.blob, artifact.filename);
    return asSuccess(`Excel-Export "${artifact.filename}" wurde erstellt.`);
  }

  async createImportDraft(input: ImportDraftInput) {
    return this.mockImportApi.createImportDraft(input);
  }

  async getImportDraft(draftId: string) {
    return this.mockImportApi.getImportDraft(draftId);
  }

  async setImportReviewDecision(draftId: string, decision: ImportReviewDecision) {
    return this.mockImportApi.setImportReviewDecision(draftId, decision);
  }

  async finalizeImportDraft(draftId: string) {
    return this.mockImportApi.finalizeImportDraft(draftId);
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
    const nextEvents = eventLog.slice(0, anchorIndex + 1);
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
