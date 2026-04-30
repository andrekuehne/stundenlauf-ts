import { describe, expect, it } from "vitest";
import { defaultMatchingConfig } from "@/matching/config.ts";
import { processCouplesSection, processSinglesSection } from "@/matching/workflow.ts";
import type { ImportBatch, PersonIdentity, RaceCategory, RaceEntry, RaceEvent, SeasonState, Team } from "@/domain/types.ts";
import type { ParsedSectionCouples, ParsedSectionSingles } from "@/ingestion/types.ts";

function emptyState(overrides?: Partial<SeasonState>): SeasonState {
  return {
    season_id: "test-season",
    persons: new Map(),
    teams: new Map(),
    import_batches: new Map(),
    race_events: new Map(),
    exclusions: new Map(),
    ...overrides,
  };
}

function makePerson(
  overrides: Partial<PersonIdentity> & { person_id: string },
): PersonIdentity {
  return {
    given_name: "",
    family_name: "",
    display_name: "",
    name_normalized: "",
    yob: 0,
    gender: "M",
    club: null,
    club_normalized: "",
    ...overrides,
  };
}

/**
 * Build a SeasonState containing a committed race event for the given category,
 * so that all provided teams appear in the category-scoped candidate pool.
 *
 * Matching now requires persons to have historical race entries in the target
 * category — this helper makes that relationship explicit in unit tests.
 */
function stateWithHistoricalRace(
  persons: Map<string, PersonIdentity>,
  teams: Map<string, Team>,
  category: RaceCategory,
): SeasonState {
  const batchId = "batch-history";
  const batch: ImportBatch = {
    import_batch_id: batchId,
    source_file: "history.xlsx",
    source_sha256: "sha-history",
    parser_version: "1",
    state: "active",
  };

  const entries: RaceEntry[] = [...teams.values()].map((t, i) => {
    const members = t.member_person_ids
      .map((personId) => persons.get(personId))
      .filter((person): person is PersonIdentity => person != null);
    const displayName = members.map((person) => person.display_name).join(" / ");
    const yobText = members.map((person) => String(person.yob)).join(" / ");
    const club = members
      .map((person) => person.club)
      .filter(Boolean)
      .join(" / ") || null;

    return {
      entry_id: `entry-hist-${i}`,
      startnr: String(i + 1),
      team_id: t.team_id,
      distance_m: 10000,
      points: 10,
      incoming: {
        display_name: displayName,
        yob: t.team_kind === "solo" ? members[0]?.yob ?? 0 : null,
        yob_text: t.team_kind === "couple" ? yobText : null,
        club,
        row_kind: t.team_kind === "solo" ? "solo" : "team",
        sheet_name: "history.xlsx",
        section_name: "hist",
        row_index: i,
      },
      resolution: { method: "new_identity", confidence: null, candidate_count: 0 },
    };
  });

  const raceEvent: RaceEvent = {
    race_event_id: "race-history",
    import_batch_id: batchId,
    category,
    race_no: 0,
    race_date: "2024-01-01",
    state: "active",
    imported_at: "2024-01-01T00:00:00Z",
    entries,
  };

  return emptyState({
    persons,
    teams,
    import_batches: new Map([[batchId, batch]]),
    race_events: new Map([["race-history", raceEvent]]),
  });
}

describe("processSinglesSection", () => {
  it("creates new identities for all rows in empty state", async () => {
    const state = emptyState();
    const section: ParsedSectionSingles = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      rows: [
        { startnr: "1", name: "Hans Mueller", yob: 1990, club: null, distance_km: 10, points: 1 },
        { startnr: "2", name: "Peter Schmidt", yob: 1985, club: "TSV", distance_km: 12, points: 2 },
      ],
    };
    const config = defaultMatchingConfig();
    const result = await processSinglesSection(state, section, config);
    expect(result.resolved_entries).toHaveLength(2);
    expect(result.report.new_identities).toBe(2);
    expect(result.new_person_payloads).toHaveLength(2);
    expect(result.new_team_payloads).toHaveLength(2);
    expect(result.review_items).toHaveLength(0);
  });

  it("auto-links to existing persons", async () => {
    const anna = makePerson({
      person_id: "p-anna",
      given_name: "anna",
      family_name: "schmidt",
      display_name: "Anna Schmidt",
      name_normalized: "anna schmidt",
      yob: 1988,
      gender: "F",
      club: "TSV",
      club_normalized: "tsv",
    });
    const annaTeam: Team = {
      team_id: "t-anna",
      member_person_ids: ["p-anna"],
      team_kind: "solo",
    };
    // Person must have race history in the same category to appear as a candidate.
    const state = stateWithHistoricalRace(
      new Map([["p-anna", anna]]),
      new Map([["t-anna", annaTeam]]),
      { duration: "hour", division: "women" },
    );
    const section: ParsedSectionSingles = {
      context: { race_no: 2, duration: "hour", division: "women", event_date: null },
      rows: [
        { startnr: "1", name: "Anna Schmidt", yob: 1988, club: "TSV", distance_km: 10, points: 1 },
      ],
    };
    const config = defaultMatchingConfig();
    const result = await processSinglesSection(state, section, config);
    expect(result.resolved_entries[0]!.route).toBe("auto");
    expect(result.resolved_entries[0]!.team_id).toBe("t-anna");
    expect(result.report.auto_links).toBe(1);
  });

  it("throws on duplicate rows", async () => {
    const state = emptyState();
    const section: ParsedSectionSingles = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      rows: [
        { startnr: "1", name: "Hans Mueller", yob: 1990, club: null, distance_km: 10, points: 1 },
        { startnr: "1", name: "Hans Mueller", yob: 1990, club: null, distance_km: 10, points: 1 },
      ],
    };
    const config = defaultMatchingConfig();
    await expect(processSinglesSection(state, section, config)).rejects.toThrow(
      /Doppelte Teilnehmerzeile/,
    );
  });

  it("strict mode: auto-links exact match", async () => {
    const anna = makePerson({
      person_id: "p-anna",
      given_name: "anna",
      family_name: "schmidt",
      yob: 1988,
      gender: "F",
      club: "TSV",
      club_normalized: "tsv",
    });
    const annaTeam: Team = {
      team_id: "t-anna",
      member_person_ids: ["p-anna"],
      team_kind: "solo",
    };
    const state = stateWithHistoricalRace(
      new Map([["p-anna", anna]]),
      new Map([["t-anna", annaTeam]]),
      { duration: "hour", division: "women" },
    );
    const section: ParsedSectionSingles = {
      context: { race_no: 2, duration: "hour", division: "women", event_date: null },
      rows: [
        { startnr: "1", name: "Anna Schmidt", yob: 1988, club: "TSV", distance_km: 10, points: 1 },
      ],
    };
    const config = defaultMatchingConfig({ strict_normalized_auto_only: true });
    const result = await processSinglesSection(state, section, config);
    expect(result.resolved_entries[0]!.route).toBe("auto");
    expect(result.resolved_entries[0]!.features.strict_identity_auto).toBe(1.0);
  });

  it("strict mode: typo forces review", async () => {
    const anna = makePerson({
      person_id: "p-anna",
      given_name: "anna",
      family_name: "schmidt",
      yob: 1988,
      gender: "F",
      club: "TSV",
      club_normalized: "tsv",
    });
    const annaTeam: Team = {
      team_id: "t-anna",
      member_person_ids: ["p-anna"],
      team_kind: "solo",
    };
    const state = stateWithHistoricalRace(
      new Map([["p-anna", anna]]),
      new Map([["t-anna", annaTeam]]),
      { duration: "hour", division: "women" },
    );
    const section: ParsedSectionSingles = {
      context: { race_no: 2, duration: "hour", division: "women", event_date: null },
      rows: [
        { startnr: "1", name: "Anna Schmidta", yob: 1988, club: "TSV", distance_km: 10, points: 1 },
      ],
    };
    const config = defaultMatchingConfig({ strict_normalized_auto_only: true, auto_min: 0.88 });
    const result = await processSinglesSection(state, section, config);
    expect(result.resolved_entries[0]!.route).toBe("review");
  });

  it("manuell mode: nothing auto-links", async () => {
    const anna = makePerson({
      person_id: "p-anna",
      given_name: "anna",
      family_name: "schmidt",
      yob: 1988,
      gender: "F",
      club: "TSV",
      club_normalized: "tsv",
    });
    const annaTeam: Team = {
      team_id: "t-anna",
      member_person_ids: ["p-anna"],
      team_kind: "solo",
    };
    const state = stateWithHistoricalRace(
      new Map([["p-anna", anna]]),
      new Map([["t-anna", annaTeam]]),
      { duration: "hour", division: "women" },
    );
    const section: ParsedSectionSingles = {
      context: { race_no: 2, duration: "hour", division: "women", event_date: null },
      rows: [
        { startnr: "1", name: "Anna Schmidt", yob: 1988, club: "TSV", distance_km: 10, points: 1 },
      ],
    };
    const config = defaultMatchingConfig({
      auto_min: 0.88,
      review_min: 0.72,
      auto_merge_enabled: false,
      perfect_match_auto_merge: false,
    });
    const result = await processSinglesSection(state, section, config);
    expect(result.resolved_entries[0]!.route).toBe("review");
  });

  it("uses team_id for singles review candidates", async () => {
    const anna = makePerson({
      person_id: "p-anna",
      given_name: "anna",
      family_name: "schmidt",
      display_name: "Anna Schmidt",
      name_normalized: "anna|schmidt",
      yob: 1988,
      gender: "F",
      club: "TSV",
      club_normalized: "tsv",
    });
    const annaTeam: Team = {
      team_id: "t-anna",
      member_person_ids: ["p-anna"],
      team_kind: "solo",
    };
    const state = stateWithHistoricalRace(
      new Map([["p-anna", anna]]),
      new Map([["t-anna", annaTeam]]),
      { duration: "hour", division: "women" },
    );
    const section: ParsedSectionSingles = {
      context: { race_no: 2, duration: "hour", division: "women", event_date: null },
      rows: [
        { startnr: "1", name: "Anna Schmidt", yob: 1988, club: "TSV", distance_km: 10, points: 1 },
      ],
    };
    const config = defaultMatchingConfig({
      auto_min: 0.88,
      review_min: 0.72,
      auto_merge_enabled: false,
      perfect_match_auto_merge: false,
    });
    const result = await processSinglesSection(state, section, config);
    expect(result.review_items).toHaveLength(1);
    expect(result.review_items[0]!.candidates[0]!.team_id).toBe("t-anna");
    expect(result.review_items[0]!.candidates[0]!.display_name).toBe("Anna Schmidt");
  });
});

describe("processCouplesSection", () => {
  it("creates new identities for couples in empty state", async () => {
    const state = emptyState();
    const section: ParsedSectionCouples = {
      context: { race_no: 1, duration: "hour", division: "couples_mixed", event_date: null },
      rows: [
        {
          startnr: "1",
          name_a: "Max Mueller",
          yob_a: 1988,
          club_a: null,
          name_b: "Eva Schmidt",
          yob_b: 1990,
          club_b: null,
          distance_km: 20,
          points: 2,
        },
      ],
    };
    const config = defaultMatchingConfig();
    const result = await processCouplesSection(state, section, config);
    expect(result.resolved_entries).toHaveLength(1);
    expect(result.report.new_identities).toBe(1);
    expect(result.new_person_payloads).toHaveLength(2);
    expect(result.new_team_payloads).toHaveLength(1);
    expect(result.new_team_payloads[0]!.team_kind).toBe("couple");
  });

  it("auto-links to existing couple", async () => {
    const ma = makePerson({
      person_id: "pa",
      given_name: "max",
      family_name: "mustermann",
      display_name: "Max Mustermann",
      yob: 1988,
      gender: "M",
    });
    const mb = makePerson({
      person_id: "pb",
      given_name: "eva",
      family_name: "beispiel",
      display_name: "Eva Beispiel",
      yob: 1990,
      gender: "F",
    });
    const coupleTeam: Team = {
      team_id: "t-couple",
      member_person_ids: ["pa", "pb"],
      team_kind: "couple",
    };
    const state = stateWithHistoricalRace(
      new Map([["pa", ma], ["pb", mb]]),
      new Map([["t-couple", coupleTeam]]),
      { duration: "hour", division: "couples_mixed" },
    );
    const section: ParsedSectionCouples = {
      context: { race_no: 2, duration: "hour", division: "couples_mixed", event_date: null },
      rows: [
        {
          startnr: "1",
          name_a: "Max Mustermann",
          yob_a: 1988,
          club_a: null,
          name_b: "Eva Beispiel",
          yob_b: 1990,
          club_b: null,
          distance_km: 20,
          points: 2,
        },
      ],
    };
    const config = defaultMatchingConfig();
    const result = await processCouplesSection(state, section, config);
    expect(result.resolved_entries[0]!.route).toBe("auto");
    expect(result.resolved_entries[0]!.team_id).toBe("t-couple");
    expect(result.report.auto_links).toBe(1);
  });

  it("does not offer couple teams whose only race history is rolled back", async () => {
    const ma = makePerson({
      person_id: "pa",
      given_name: "max",
      family_name: "mustermann",
      display_name: "Max Mustermann",
      yob: 1988,
      gender: "M",
    });
    const mb = makePerson({
      person_id: "pb",
      given_name: "eva",
      family_name: "beispiel",
      display_name: "Eva Beispiel",
      yob: 1990,
      gender: "F",
    });
    const staleTeam: Team = {
      team_id: "t-rolled-back-couple",
      member_person_ids: ["pa", "pb"],
      team_kind: "couple",
    };
    const state = stateWithHistoricalRace(
      new Map([["pa", ma], ["pb", mb]]),
      new Map([["t-rolled-back-couple", staleTeam]]),
      { duration: "hour", division: "couples_mixed" },
    );
    const race = state.race_events.get("race-history");
    if (!race) throw new Error("Expected historical race");
    state.race_events.set("race-history", { ...race, state: "rolled_back" });

    const section: ParsedSectionCouples = {
      context: { race_no: 2, duration: "hour", division: "couples_mixed", event_date: null },
      rows: [
        {
          startnr: "1",
          name_a: "Max Mustermann",
          yob_a: 1988,
          club_a: null,
          name_b: "Eva Beispiel",
          yob_b: 1990,
          club_b: null,
          distance_km: 20,
          points: 2,
        },
      ],
    };
    const config = defaultMatchingConfig();
    const result = await processCouplesSection(state, section, config);
    expect(result.resolved_entries[0]!.route).toBe("new_identity");
    expect(result.resolved_entries[0]!.candidate_uids).not.toContain("t-rolled-back-couple");
    expect(result.review_items).toHaveLength(0);
  });

  it("does not offer couple teams from other categories", async () => {
    const ma = makePerson({
      person_id: "pa",
      given_name: "max",
      family_name: "mustermann",
      display_name: "Max Mustermann",
      yob: 1988,
      gender: "M",
    });
    const mb = makePerson({
      person_id: "pb",
      given_name: "eva",
      family_name: "beispiel",
      display_name: "Eva Beispiel",
      yob: 1990,
      gender: "F",
    });
    const otherCategoryTeam: Team = {
      team_id: "t-other-category-couple",
      member_person_ids: ["pa", "pb"],
      team_kind: "couple",
    };
    const state = stateWithHistoricalRace(
      new Map([["pa", ma], ["pb", mb]]),
      new Map([["t-other-category-couple", otherCategoryTeam]]),
      { duration: "half_hour", division: "couples_mixed" },
    );

    const section: ParsedSectionCouples = {
      context: { race_no: 2, duration: "hour", division: "couples_mixed", event_date: null },
      rows: [
        {
          startnr: "1",
          name_a: "Max Mustermann",
          yob_a: 1988,
          club_a: null,
          name_b: "Eva Beispiel",
          yob_b: 1990,
          club_b: null,
          distance_km: 20,
          points: 2,
        },
      ],
    };
    const config = defaultMatchingConfig();
    const result = await processCouplesSection(state, section, config);
    expect(result.resolved_entries[0]!.route).toBe("new_identity");
    expect(result.resolved_entries[0]!.candidate_uids).not.toContain("t-other-category-couple");
  });
});
