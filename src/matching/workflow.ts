/**
 * Section-level matching workflow: process all rows in a parsed section,
 * producing resolved entries and a matching report.
 *
 * Direct port of process_singles_section / process_couples_section from
 * backend/matching/workflow.py.
 * Reference: F-TS03 §7 (Resolution Pipeline), §10 (Workflow)
 */

import type { Division, PersonIdentity, RaceDuration, SeasonState, Team } from "@/domain/types.ts";
import type { ParsedSectionCouples, ParsedSectionSingles } from "@/ingestion/types.ts";
import type { MatchingConfig } from "./config.ts";
import {
  buildFingerprintReplayIndex,
  emptyRunStats,
  genderForDivision,
  memberGendersForCouples,
  resolvePerson,
  resolveTeamRow,
} from "./resolve.ts";
import type { MatchingReport, ReviewItem, SectionMatchResult } from "./types.ts";

/**
 * Build the pool of candidate persons for matching in a given section.
 *
 * Only persons who have participated in at least one active, committed race
 * of the exact same category (`duration` + `division`) are considered. This
 * enforces two invariants:
 *  1. Category isolation — a person from a different duration/division is
 *     never a candidate for the current section.
 *  2. Same-file isolation — identities introduced by earlier sections of the
 *     current import have no race history yet and are therefore invisible.
 */
function buildCategoryHistoryPersonPool(
  state: SeasonState,
  duration: RaceDuration,
  division: Division,
): PersonIdentity[] {
  const personIdsSeen = new Set<string>();
  const result: PersonIdentity[] = [];

  for (const raceEvent of state.race_events.values()) {
    if (raceEvent.state !== "active") continue;
    const batch = state.import_batches.get(raceEvent.import_batch_id);
    if (batch?.state === "rolled_back") continue;
    if (raceEvent.category.duration !== duration || raceEvent.category.division !== division) continue;

    for (const entry of raceEvent.entries) {
      const team = state.teams.get(entry.team_id);
      if (!team || team.team_kind !== "solo") continue;
      const personId = team.member_person_ids[0];
      if (!personId || personIdsSeen.has(personId)) continue;
      const person = state.persons.get(personId);
      if (!person) continue;
      personIdsSeen.add(personId);
      result.push(person);
    }
  }

  return result;
}

function buildCategoryHistoryCoupleTeamPool(
  state: SeasonState,
  duration: RaceDuration,
  division: Division,
): Team[] {
  const teamIdsSeen = new Set<string>();
  const result: Team[] = [];

  for (const raceEvent of state.race_events.values()) {
    if (raceEvent.state !== "active") continue;
    const batch = state.import_batches.get(raceEvent.import_batch_id);
    if (batch?.state === "rolled_back") continue;
    if (raceEvent.category.duration !== duration || raceEvent.category.division !== division) continue;

    for (const entry of raceEvent.entries) {
      const team = state.teams.get(entry.team_id);
      if (!team || team.team_kind !== "couple") continue;
      if (teamIdsSeen.has(team.team_id)) continue;
      teamIdsSeen.add(team.team_id);
      result.push(team);
    }
  }

  return result;
}

function buildReviewItemForSingles(
  entry: { route: string; confidence: number; features: Record<string, number>; conflict_flags: string[]; top_candidate_uid: string | null; candidate_uids: string[]; candidate_confidences: number[] },
  entryId: string,
  rawName: string,
  yob: number,
  club: string | null,
  gender: "M" | "F" | "X",
  persons: ReadonlyMap<string, PersonIdentity>,
  teams: ReadonlyMap<string, Team>,
): ReviewItem | null {
  if (entry.route !== "review") return null;
  const candidates = entry.candidate_uids.map((teamId, i) => {
    let displayName = teamId;
    let candYob = 0;
    let candClub: string | null = null;
    const team = teams.get(teamId);
    if (team?.team_kind === "solo") {
      const personId = team.member_person_ids[0];
      if (personId) {
        const person = persons.get(personId);
        if (person) {
          displayName = person.display_name;
          candYob = person.yob;
          candClub = person.club;
        }
      }
    }
    return {
      team_id: teamId,
      score: entry.candidate_confidences[i] ?? 0,
      features: entry.features,
      display_name: displayName,
      yob: candYob,
      club: candClub,
    };
  });
  return {
    entry_id: entryId,
    incoming_display_name: rawName.trim(),
    incoming_yob: yob,
    incoming_club: club,
    incoming_kind: "solo",
    route: "review",
    confidence: entry.confidence,
    candidates,
    conflict_flags: entry.conflict_flags,
    gender,
  };
}

export async function processSinglesSection(
  state: SeasonState,
  section: ParsedSectionSingles,
  config: MatchingConfig,
): Promise<SectionMatchResult> {
  const { duration, division } = section.context;
  const replayIndex = await buildFingerprintReplayIndex(state, { duration, division });
  const stats = emptyRunStats();
  const usedTeamIds = new Map<string, string>();

  const gender = genderForDivision(division);

  // Duplicate row detection
  const incomingKeys = new Map<string, number>();
  for (const row of section.rows) {
    const rowKey = [
      row.name.trim().toLowerCase(),
      String(row.yob || 0),
      (row.club || "").trim().toLowerCase(),
      row.startnr.trim(),
    ].join("|");
    incomingKeys.set(rowKey, (incomingKeys.get(rowKey) ?? 0) + 1);
  }
  for (const [, count] of incomingKeys) {
    if (count > 1) {
      throw new Error(
        "Importkonflikt: Doppelte Teilnehmerzeile im selben Lauf (Name/Jahrgang/Verein/Startnr).",
      );
    }
  }

  // Candidates scoped to same-category race history only.
  const candidatePeople = buildCategoryHistoryPersonPool(state, duration, division);
  const resolvedEntries: SectionMatchResult["resolved_entries"] = [];
  const reviewItems: ReviewItem[] = [];
  const newPersonPayloads: SectionMatchResult["new_person_payloads"] = [];
  const newTeamPayloads: SectionMatchResult["new_team_payloads"] = [];

  for (const row of section.rows) {
    const entryId = crypto.randomUUID();
    const result = await resolvePerson({
      rawName: row.name,
      yob: row.yob,
      clubRaw: row.club,
      gender,
      candidatePeople,
      replayIndex,
      usedTeamIds,
      config,
      entryId,
      stats,
      teams: state.teams,
    });

    resolvedEntries.push(result);
    newPersonPayloads.push(...result.new_persons);
    newTeamPayloads.push(...result.new_teams);

    const reviewItem = buildReviewItemForSingles(
      result, entryId, row.name, row.yob, row.club, gender,
      state.persons, state.teams,
    );
    if (reviewItem) reviewItems.push(reviewItem);
  }

  const report: MatchingReport = {
    auto_links: stats.auto_links,
    review_queue: stats.review_queue,
    new_identities: stats.new_identities,
    conflicts: stats.conflicts,
    replay_overrides: stats.replay_overrides,
    candidate_counts: stats.candidate_counts,
  };

  return {
    resolved_entries: resolvedEntries,
    review_items: reviewItems,
    new_person_payloads: newPersonPayloads,
    new_team_payloads: newTeamPayloads,
    report,
  };
}

export async function processCouplesSection(
  state: SeasonState,
  section: ParsedSectionCouples,
  config: MatchingConfig,
): Promise<SectionMatchResult> {
  const { duration, division } = section.context;
  const replayIndex = await buildFingerprintReplayIndex(state, { duration, division });
  const stats = emptyRunStats();
  const usedTeamUids = new Map<string, string>();

  const [genderA, genderB] = memberGendersForCouples(section.context.division);
  const candidateTeams = buildCategoryHistoryCoupleTeamPool(state, duration, division);

  const resolvedEntries: SectionMatchResult["resolved_entries"] = [];
  const reviewItems: ReviewItem[] = [];
  const newPersonPayloads: SectionMatchResult["new_person_payloads"] = [];
  const newTeamPayloads: SectionMatchResult["new_team_payloads"] = [];
  const displayNameByTeamId = new Map<string, {
    display_name: string;
    yob: number;
    yob_text: string | null;
    club: string | null;
  }>();

  for (const team of candidateTeams) {
    const memberA = state.persons.get(team.member_person_ids[0] ?? "");
    const memberB = state.persons.get(team.member_person_ids[1] ?? "");
    if (!memberA || !memberB) continue;
    const yobText =
      memberA.yob > 0 || memberB.yob > 0
        ? `${memberA.yob > 0 ? memberA.yob : "—"} / ${memberB.yob > 0 ? memberB.yob : "—"}`
        : null;
    displayNameByTeamId.set(team.team_id, {
      display_name: `${memberA.display_name} / ${memberB.display_name}`,
      yob: 0,
      yob_text: yobText,
      club: [memberA.club, memberB.club].filter(Boolean).join(" / ") || null,
    });
  }

  for (const row of section.rows) {
    const entryId = crypto.randomUUID();
    const result = await resolveTeamRow({
      row,
      division: section.context.division,
      genderA,
      genderB,
      persons: state.persons,
      teams: state.teams,
      candidateTeams,
      replayIndex,
      usedTeamUids,
      config,
      entryId,
      stats,
    });

    resolvedEntries.push(result);
    newPersonPayloads.push(...result.new_persons);
    newTeamPayloads.push(...result.new_teams);

    if (result.route === "review") {
      reviewItems.push({
        entry_id: entryId,
        incoming_display_name: `${row.name_a.trim()} / ${row.name_b.trim()}`,
        incoming_yob: 0,
        incoming_club: [row.club_a, row.club_b].filter(Boolean).join(" / ") || null,
        incoming_kind: "team",
        route: "review",
        confidence: result.confidence,
        candidates: result.candidate_uids.map((uid, i) => ({
          ...(displayNameByTeamId.get(uid) ?? { display_name: uid, yob: 0, yob_text: null, club: null }),
          team_id: uid,
          score: result.candidate_confidences[i] ?? 0,
          features: result.features,
        })),
        conflict_flags: result.conflict_flags,
        gender: genderA,
      });
    }
  }

  const report: MatchingReport = {
    auto_links: stats.auto_links,
    review_queue: stats.review_queue,
    new_identities: stats.new_identities,
    conflicts: stats.conflicts,
    replay_overrides: stats.replay_overrides,
    candidate_counts: stats.candidate_counts,
  };

  return {
    resolved_entries: resolvedEntries,
    review_items: reviewItems,
    new_person_payloads: newPersonPayloads,
    new_team_payloads: newTeamPayloads,
    report,
  };
}
