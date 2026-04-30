import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rememberImportFile } from "@/api/import-file-registry.ts";
import { createTsAppApi } from "@/api/ts/index.ts";
import { EXPECTED_HEADER_COUPLES, EXPECTED_HEADER_SINGLES } from "@/ingestion/constants";
import type { DomainEvent } from "@/domain/events.ts";
import type { SeasonDescriptor } from "@/domain/types.ts";
import {
  getSeasonRepository,
  setSeasonRepositoryForTests,
  type SeasonRepository,
} from "@/services/season-repository.ts";
import {
  defaultEntry,
  importBatchRecorded,
  personRegistered,
  raceRegistered,
  raceRolledBack,
  resetSeqCounter,
  teamRegistered,
} from "../helpers/event-factories.ts";
import { buildXlsx } from "../ingestion/xlsx-test-helpers.ts";

class InMemorySeasonRepository implements SeasonRepository {
  private readonly seasons = new Map<string, SeasonDescriptor>();
  private readonly eventLogs = new Map<string, DomainEvent[]>();
  private counter = 0;

  listSeasons(): Promise<SeasonDescriptor[]> {
    return Promise.resolve([...this.seasons.values()]);
  }

  getSeason(seasonId: string): Promise<SeasonDescriptor | null> {
    return Promise.resolve(this.seasons.get(seasonId) ?? null);
  }

  createSeason(label: string): Promise<SeasonDescriptor> {
    const season: SeasonDescriptor = {
      season_id: `season-${++this.counter}`,
      label,
      created_at: new Date(`2026-04-${10 + this.counter}T12:00:00.000Z`).toISOString(),
    };
    this.seasons.set(season.season_id, season);
    this.eventLogs.set(season.season_id, []);
    return Promise.resolve(season);
  }

  deleteSeason(seasonId: string): Promise<void> {
    this.seasons.delete(seasonId);
    this.eventLogs.delete(seasonId);
    return Promise.resolve();
  }

  getEventLog(seasonId: string): Promise<DomainEvent[]> {
    return Promise.resolve([...(this.eventLogs.get(seasonId) ?? [])]);
  }

  appendEvents(seasonId: string, events: DomainEvent[]): Promise<void> {
    const current = this.eventLogs.get(seasonId) ?? [];
    this.eventLogs.set(seasonId, [...current, ...events]);
    return Promise.resolve();
  }

  clearEventLog(seasonId: string): Promise<void> {
    this.eventLogs.set(seasonId, []);
    return Promise.resolve();
  }

  saveImportedSeason(season: SeasonDescriptor, events: DomainEvent[]): Promise<void> {
    this.seasons.set(season.season_id, season);
    this.eventLogs.set(season.season_id, [...events]);
    return Promise.resolve();
  }
}

function buildSinglesImportFile(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  name = "Ergebnisliste MW Lauf 2.xlsx",
): File {
  const buffer = buildXlsx(rows.map((row) => [...row]));
  const file = new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(buffer.slice(0)),
  });
  return file;
}

function buildCouplesImportFile(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  name = "Ergebnisliste MW_Paare Lauf 2.xlsx",
): File {
  const buffer = buildXlsx(rows.map((row) => [...row]));
  const file = new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(buffer.slice(0)),
  });
  return file;
}

beforeEach(() => {
  resetSeqCounter();
  setSeasonRepositoryForTests(new InMemorySeasonRepository());
});

afterEach(() => {
  setSeasonRepositoryForTests(null);
  vi.restoreAllMocks();
});

describe("TsAppApi season and shell flows", () => {
  it("creates, opens, lists, and deletes seasons with shell synchronization", async () => {
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Stundenlauf 2026" });
    expect(created.label).toBe("Stundenlauf 2026");

    let shell = await api.getShellData();
    expect(shell.selectedSeasonId).toBe(created.seasonId);
    expect(shell.availableSeasons).toHaveLength(1);

    const createdSecond = await api.createSeason({ label: "Stundenlauf 2027" });
    await api.openSeason(created.seasonId);

    shell = await api.getShellData();
    expect(shell.selectedSeasonId).toBe(created.seasonId);

    const seasons = await api.listSeasons();
    expect(seasons.map((season) => season.label)).toEqual(
      expect.arrayContaining(["Stundenlauf 2026", "Stundenlauf 2027"]),
    );

    await api.deleteSeason(createdSecond.seasonId);
    const seasonsAfterDelete = await api.listSeasons();
    expect(seasonsAfterDelete.map((season) => season.seasonId)).not.toContain(createdSecond.seasonId);
  });
});

describe("TsAppApi standings and exports", () => {
  it("projects live standings payload and triggers export actions", async () => {
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Stundenlauf 2028" });
    const repo = await getSeasonRepository();
    await repo.saveImportedSeason(
      {
        season_id: created.seasonId,
        label: created.label,
        created_at: new Date().toISOString(),
      },
      [
        personRegistered({
          person_id: "person-export",
          given_name: "Anna",
          family_name: "Alpha",
          display_name: "Anna Alpha",
          name_normalized: "anna alpha",
          club: "Club A",
          club_normalized: "club a",
        }),
        teamRegistered({
          team_id: "team-export",
          member_person_ids: ["person-export"],
          team_kind: "solo",
        }),
        importBatchRecorded({
          import_batch_id: "batch-export",
          source_file: "lauf-1.xlsx",
          source_sha256: "sha-export",
        }),
        raceRegistered({
          race_event_id: "race-export",
          import_batch_id: "batch-export",
          category: { duration: "hour", division: "men" },
          race_no: 1,
          entries: [
            defaultEntry({
              entry_id: "entry-export",
              team_id: "team-export",
              points: 12,
              distance_m: 7000,
            }),
          ],
        }),
      ],
    );

    const liveApi = createTsAppApi();
    await liveApi.openSeason(created.seasonId);
    const standings = await liveApi.getStandings(created.seasonId);
    expect(standings.summary.totalRuns).toBe(1);
    expect(standings.categories.length).toBeGreaterThan(0);

    const triggerDownloadSpy = vi
      .spyOn(await import("@/portability/download.ts"), "triggerDownload")
      .mockImplementation(() => {});

    const exportResult = await liveApi.runExportAction(created.seasonId, "export_excel");
    expect(exportResult.severity).toBe("success");
    expect(triggerDownloadSpy).toHaveBeenCalledTimes(1);

    const kidsExportResult = await liveApi.runExportAction(created.seasonId, "export_kids_excel");
    expect(kidsExportResult.severity).toBe("success");
    expect(triggerDownloadSpy).toHaveBeenCalledTimes(2);
    expect(triggerDownloadSpy.mock.calls[1]?.[1]).toBe("stundenlauf-2028-kids.xlsx");
  }, 30_000);

  it("getStandings raceCells reflect real per-race distance and points, not averaged totals", async () => {
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Stundenlauf 2029" });
    const repo = await getSeasonRepository();
    await repo.saveImportedSeason(
      { season_id: created.seasonId, label: created.label, created_at: new Date().toISOString() },
      [
        personRegistered({
          person_id: "person-cells",
          given_name: "Test",
          family_name: "Runner",
          display_name: "Test Runner",
          name_normalized: "test runner",
          club: "Club X",
          club_normalized: "club x",
        }),
        teamRegistered({ team_id: "team-cells", member_person_ids: ["person-cells"], team_kind: "solo" }),
        importBatchRecorded({ import_batch_id: "batch-cells-1", source_file: "lauf1.xlsx", source_sha256: "sha1" }),
        raceRegistered({
          race_event_id: "race-cells-1",
          import_batch_id: "batch-cells-1",
          category: { duration: "hour", division: "men" },
          race_no: 1,
          entries: [defaultEntry({ entry_id: "e1", team_id: "team-cells", points: 10, distance_m: 5000 })],
        }),
        importBatchRecorded({ import_batch_id: "batch-cells-2", source_file: "lauf2.xlsx", source_sha256: "sha2" }),
        raceRegistered({
          race_event_id: "race-cells-2",
          import_batch_id: "batch-cells-2",
          category: { duration: "hour", division: "men" },
          race_no: 2,
          entries: [defaultEntry({ entry_id: "e2", team_id: "team-cells", points: 14, distance_m: 8000 })],
        }),
      ],
    );

    await api.openSeason(created.seasonId);
    const standings = await api.getStandings(created.seasonId);
    const rows = standings.rowsByCategory["hour:men"] ?? [];
    const row = rows.find((r) => r.teamId === "team-cells");
    expect(row).toBeDefined();
    expect(row!.raceCells).toHaveLength(2);

    const cell0 = row!.raceCells[0];
    const cell1 = row!.raceCells[1];
    expect(cell0).not.toBeNull();
    expect(cell1).not.toBeNull();
    expect(cell0!.distanceKm).toBe(5);
    expect(cell0!.points).toBe(10);
    expect(cell1!.distanceKm).toBe(8);
    expect(cell1!.points).toBe(14);
  }, 30_000);

  it("getStandings raceNos list skips rolled-back races but preserves later race_no values", async () => {
    resetSeqCounter();
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Rollback raceNos" });
    const repo = await getSeasonRepository();
    const category = { duration: "hour" as const, division: "men" as const };
    await repo.saveImportedSeason(
      { season_id: created.seasonId, label: created.label, created_at: new Date().toISOString() },
      [
        personRegistered({ person_id: "p-rbnos" }),
        teamRegistered({ team_id: "t-rbnos", member_person_ids: ["p-rbnos"], team_kind: "solo" }),
        ...([1, 2, 3, 4, 5] as const).flatMap((n) => {
          const batch = `batch-rb-${n}`;
          const raceId = `race-rb-${n}`;
          return [
            importBatchRecorded({ import_batch_id: batch }),
            raceRegistered({
              race_event_id: raceId,
              import_batch_id: batch,
              category,
              race_no: n,
              entries: [
                defaultEntry({
                  entry_id: `e-rb-${n}`,
                  team_id: "t-rbnos",
                  points: 10,
                  distance_m: 5000,
                }),
              ],
            }),
          ];
        }),
        raceRolledBack({ race_event_id: "race-rb-3", reason: "test" }),
      ],
    );

    await api.openSeason(created.seasonId);
    const standings = await api.getStandings(created.seasonId);
    const cat = standings.categories.find((c) => c.key === "hour:men");
    expect(cat?.raceNos).toEqual([1, 2, 4, 5]);
    const rows = standings.rowsByCategory["hour:men"] ?? [];
    expect(rows[0]?.raceCells).toHaveLength(4);
  }, 30_000);
});

describe("TsAppApi history workflows", () => {
  it("supports history preview, rollback, and hard reset on persisted logs", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await repo.createSeason("Stundenlauf 2030");
    await repo.appendEvents(season.season_id, [
      importBatchRecorded({
        import_batch_id: "batch-history",
        source_file: "lauf-2.xlsx",
        source_sha256: "sha-history",
      }),
      raceRegistered({
        race_event_id: "race-history",
        import_batch_id: "batch-history",
        category: { duration: "hour", division: "men" },
        race_no: 2,
        entries: [],
      }),
    ]);

    const api = createTsAppApi();
    await api.openSeason(season.season_id);
    const history = await api.getHistory(season.season_id);
    expect(history.rows.length).toBeGreaterThan(0);

    const anchorSeq = history.rows[0]?.seq;
    if (anchorSeq == null) {
      throw new Error("Expected at least one history row.");
    }

    const preview = await api.previewHistoryState(season.season_id, { anchorSeq });
    expect(preview.isFrozen).toBe(true);

    const rollbackResult = await api.rollbackHistory(season.season_id, {
      mode: "grouped",
      anchorSeq,
      importBatchId: "batch-history",
      reason: "test.rollback",
    });
    expect(rollbackResult.severity).toBe("success");

    const afterRollback = await api.getHistory(season.season_id);
    const latestSeq = afterRollback.rows[afterRollback.rows.length - 1]?.seq;
    if (latestSeq == null) {
      throw new Error("Expected history rows after rollback.");
    }
    const hardResetResult = await api.hardResetHistoryToSeq(season.season_id, {
      anchorSeq: latestSeq - 1,
      reason: "test.hard-reset",
    });
    expect(hardResetResult.severity).toBe("warn");
  });

  it("exposes importBatches derived from import_batch.recorded events", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await repo.createSeason("Stundenlauf 2031");
    await repo.appendEvents(season.season_id, [
      importBatchRecorded({
        import_batch_id: "batch-a",
        source_file: "lauf-1.xlsx",
        source_sha256: "sha-a",
      }),
      raceRegistered({
        race_event_id: "race-a",
        import_batch_id: "batch-a",
        category: { duration: "hour", division: "men" },
        race_no: 1,
        entries: [],
      }),
      importBatchRecorded({
        import_batch_id: "batch-b",
        source_file: "lauf-2.xlsx",
        source_sha256: "sha-b",
      }),
      raceRegistered({
        race_event_id: "race-b",
        import_batch_id: "batch-b",
        category: { duration: "hour", division: "women" },
        race_no: 2,
        entries: [],
      }),
    ]);
    const api = createTsAppApi();
    await api.openSeason(season.season_id);
    const history = await api.getHistory(season.season_id);
    expect(history.importBatches).toHaveLength(2);
    expect(history.importBatches[0]?.importBatchId).toBe("batch-a");
    expect(history.importBatches[0]?.sourceFile).toBe("lauf-1.xlsx");
    expect(history.importBatches[1]?.importBatchId).toBe("batch-b");
    expect(history.importBatches[1]?.sourceFile).toBe("lauf-2.xlsx");
  });

  it("exclusive hard reset removes the anchor event and all later events", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await repo.createSeason("Stundenlauf 2032");
    await repo.appendEvents(season.season_id, [
      importBatchRecorded({ import_batch_id: "batch-x1", source_file: "lauf-1.xlsx", source_sha256: "sha-x1" }),
      raceRegistered({ race_event_id: "race-x1", import_batch_id: "batch-x1", category: { duration: "hour", division: "men" }, race_no: 1, entries: [] }),
      importBatchRecorded({ import_batch_id: "batch-x2", source_file: "lauf-2.xlsx", source_sha256: "sha-x2" }),
      raceRegistered({ race_event_id: "race-x2", import_batch_id: "batch-x2", category: { duration: "hour", division: "women" }, race_no: 2, entries: [] }),
    ]);
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    const before = await api.getHistory(season.season_id);
    const secondBatch = before.importBatches.find((b) => b.importBatchId === "batch-x2");
    if (!secondBatch) throw new Error("Expected batch-x2");

    const result = await api.hardResetHistoryToSeq(season.season_id, {
      anchorSeq: secondBatch.anchorSeq,
      truncateMode: "exclusive",
      reason: "test.exclusive-reset",
    });
    expect(result.severity).toBe("warn");

    const after = await api.getHistory(season.season_id);
    expect(after.importBatches).toHaveLength(1);
    expect(after.importBatches[0]?.importBatchId).toBe("batch-x1");
    expect(after.rows.every((r) => !r.importBatchId?.includes("batch-x2"))).toBe(true);
  });

  it("exclusive hard reset on the first import yields an empty event log", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await repo.createSeason("Stundenlauf 2033");
    await repo.appendEvents(season.season_id, [
      importBatchRecorded({ import_batch_id: "batch-only", source_file: "lauf-1.xlsx", source_sha256: "sha-only" }),
      raceRegistered({ race_event_id: "race-only", import_batch_id: "batch-only", category: { duration: "hour", division: "men" }, race_no: 1, entries: [] }),
    ]);
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    const before = await api.getHistory(season.season_id);
    const onlyBatch = before.importBatches[0];
    if (!onlyBatch) throw new Error("Expected at least one import batch");

    await api.hardResetHistoryToSeq(season.season_id, {
      anchorSeq: onlyBatch.anchorSeq,
      truncateMode: "exclusive",
      reason: "test.exclusive-reset-first",
    });

    const after = await api.getHistory(season.season_id);
    expect(after.importBatches).toHaveLength(0);
    expect(after.rows).toHaveLength(0);
  });

  it("grouped rollback of one batch leaves later batches intact (cross-category safe)", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await repo.createSeason("Stundenlauf 2034");
    await repo.appendEvents(season.season_id, [
      importBatchRecorded({ import_batch_id: "batch-couples", source_file: "paare-lauf1.xlsx", source_sha256: "sha-c1" }),
      raceRegistered({
        race_event_id: "race-couples",
        import_batch_id: "batch-couples",
        category: { duration: "hour", division: "couples_mixed" },
        race_no: 1,
        entries: [],
      }),
      importBatchRecorded({ import_batch_id: "batch-singles", source_file: "einzel-lauf1.xlsx", source_sha256: "sha-s1" }),
      raceRegistered({
        race_event_id: "race-singles",
        import_batch_id: "batch-singles",
        category: { duration: "hour", division: "men" },
        race_no: 1,
        entries: [],
      }),
    ]);
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    const before = await api.getHistory(season.season_id);
    expect(before.importBatches).toHaveLength(2);
    const couplesBatch = before.importBatches.find((b) => b.importBatchId === "batch-couples");
    if (!couplesBatch) throw new Error("Expected batch-couples");
    expect(couplesBatch.state).toBe("active");
    expect(couplesBatch.categoryLabel).toBe("60 Minuten Paare Mixed");

    const result = await api.rollbackHistory(season.season_id, {
      mode: "grouped",
      anchorSeq: couplesBatch.anchorSeq,
      importBatchId: "batch-couples",
      reason: "test.cross-category-rollback",
    });
    expect(result.severity).toBe("success");

    const after = await api.getHistory(season.season_id);
    // Event log grows (append-only), not shrinks
    expect(after.rows.length).toBeGreaterThan(before.rows.length);
    // Singles batch is still present and active
    expect(after.importBatches).toHaveLength(2);
    const singlesBatchAfter = after.importBatches.find((b) => b.importBatchId === "batch-singles");
    expect(singlesBatchAfter?.state).toBe("active");
    // Couples batch is now rolled_back
    const couplesBatchAfter = after.importBatches.find((b) => b.importBatchId === "batch-couples");
    expect(couplesBatchAfter?.state).toBe("rolled_back");
  });
});

describe("TsAppApi import workflows", () => {
  it("uses legacy default fuzzy-perfect matching when no config is provided", async () => {
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Stundenlauf 2032" });
    await api.openSeason(created.seasonId);
    const repo = await getSeasonRepository();
    await repo.saveImportedSeason(
      {
        season_id: created.seasonId,
        label: created.label,
        created_at: new Date().toISOString(),
      },
      [
        personRegistered({
          person_id: "person-exact",
          given_name: "Anna",
          family_name: "Exact",
          display_name: "Anna Exact",
          name_normalized: "anna exact",
          yob: 1999,
          club: "Club A",
          club_normalized: "club a",
        }),
        teamRegistered({
          team_id: "team-exact",
          member_person_ids: ["person-exact"],
          team_kind: "solo",
        }),
      ],
    );

    const file = buildSinglesImportFile([
      EXPECTED_HEADER_SINGLES,
      ["h-Lauf", "", "", "", "", "", "", ""],
      ["Männer", "", "", "", "", "", "", ""],
      [1, "10", "Exact, Anna", 1999, "Club A", "10,2", "", "11"],
    ]);
    rememberImportFile(file);

    const draft = await api.createImportDraft({
      seasonId: created.seasonId,
      fileName: file.name,
      category: "singles",
      raceNumber: 1,
    });
    expect(draft.reviewItems).toHaveLength(0);
  });

  it("creates draft, resolves review, finalizes import, and refreshes standings", async () => {
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Stundenlauf 2031" });
    await api.openSeason(created.seasonId);
    const repo = await getSeasonRepository();
    await repo.saveImportedSeason(
      {
        season_id: created.seasonId,
        label: created.label,
        created_at: new Date().toISOString(),
      },
      [
        personRegistered({
          person_id: "person-existing",
          given_name: "Runner",
          family_name: "Existing",
          display_name: "Runner Existing",
          name_normalized: "runner existing",
          yob: 2000,
          club: "Club A",
          club_normalized: "club a",
        }),
        teamRegistered({
          team_id: "team-existing",
          member_person_ids: ["person-existing"],
          team_kind: "solo",
        }),
        importBatchRecorded({
          import_batch_id: "batch-existing",
          source_file: "lauf-1.xlsx",
          source_sha256: "sha-existing",
        }),
        raceRegistered({
          race_event_id: "race-existing",
          import_batch_id: "batch-existing",
          category: { duration: "hour", division: "men" },
          race_no: 1,
          entries: [
            defaultEntry({
              entry_id: "entry-existing",
              team_id: "team-existing",
              points: 9,
              distance_m: 5000,
            }),
          ],
        }),
      ],
    );

    const file = buildSinglesImportFile([
      EXPECTED_HEADER_SINGLES,
      ["h-Lauf", "", "", "", "", "", "", ""],
      ["Männer", "", "", "", "", "", "", ""],
      [1, "11", "Existing, Runner", 2000, "Club Z", "11,5", "", "15"],
      [2, "10", "New, Runner", 2002, "Club B", "10,1", "", "12"],
    ]);
    rememberImportFile(file);

    const draft = await api.createImportDraft({
      seasonId: created.seasonId,
      fileName: file.name,
      category: "singles",
      raceNumber: 2,
      matchingConfig: {
        autoMin: 0.5,
        reviewMin: 0.5,
        autoMergeEnabled: false,
        perfectMatchAutoMerge: false,
        strictNormalizedAutoOnly: false,
      },
    });
    expect(draft.seasonId).toBe(created.seasonId);
    expect(draft.reviewItems.length).toBe(1);

    const firstReview = draft.reviewItems[0];
    if (!firstReview) {
      throw new Error("Expected review item in import draft.");
    }
    const selectedCandidate = firstReview.candidates[0];
    if (!selectedCandidate) {
      throw new Error("Expected candidate for first review item.");
    }

    const reviewed = await api.setImportReviewDecision(draft.draftId, {
      reviewId: firstReview.reviewId,
      action: "merge",
      candidateId: selectedCandidate.candidateId,
    });
    expect(reviewed.decisions.length).toBe(1);
    expect(reviewed.summary.importedEntries).toBe(2);

    const finalized = await api.finalizeImportDraft(draft.draftId);
    expect(finalized.severity).toBe("success");

    const standings = await api.getStandings(created.seasonId);
    expect(standings.summary.totalRuns).toBe(2);
    expect(standings.importedRuns.some((row) => row.raceLabel === "Lauf 2")).toBe(true);
    const menRows = standings.rowsByCategory["hour:men"] ?? [];
    expect(menRows.some((row) => row.yob != null && row.yob > 0)).toBe(true);

    const shell = await api.getShellData();
    expect(shell.unresolvedReviews).toBe(0);
  });

  it("preserves candidate YOB pair text for doubles review items", async () => {
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Stundenlauf 2033" });
    await api.openSeason(created.seasonId);
    const repo = await getSeasonRepository();
    await repo.saveImportedSeason(
      {
        season_id: created.seasonId,
        label: created.label,
        created_at: new Date().toISOString(),
      },
      [
        personRegistered({
          person_id: "person-couple-a",
          given_name: "Lea",
          family_name: "Beispiel",
          display_name: "Lea Beispiel",
          name_normalized: "lea beispiel",
          yob: 1992,
          gender: "F",
          club: "Club A",
          club_normalized: "club a",
        }),
        personRegistered({
          person_id: "person-couple-b",
          given_name: "Tom",
          family_name: "Beispiel",
          display_name: "Tom Beispiel",
          name_normalized: "tom beispiel",
          yob: 1990,
          gender: "M",
          club: "Club B",
          club_normalized: "club b",
        }),
        teamRegistered({
          team_id: "team-couple-existing",
          member_person_ids: ["person-couple-a", "person-couple-b"],
          team_kind: "couple",
        }),
        importBatchRecorded({
          import_batch_id: "batch-couple-existing",
          source_file: "paare-lauf-1.xlsx",
          source_sha256: "sha-couple-existing",
        }),
        raceRegistered({
          race_event_id: "race-couple-existing",
          import_batch_id: "batch-couple-existing",
          category: { duration: "hour", division: "couples_mixed" },
          race_no: 1,
          entries: [
            defaultEntry({
              entry_id: "entry-couple-existing",
              team_id: "team-couple-existing",
              incoming: {
                display_name: "Lea Beispiel / Tom Beispiel",
                yob: null,
                yob_text: "1992 / 1990",
                club: "Club A / Club B",
                row_kind: "team",
                sheet_name: "paare-lauf-1.xlsx",
                section_name: "Paare Mix",
                row_index: 0,
              },
            }),
          ],
        }),
      ],
    );

    const file = buildCouplesImportFile([
      EXPECTED_HEADER_COUPLES,
      ["h-Lauf", "", "", "", "", "", "", "", "", "", ""],
      ["Paare Mix", "", "", "", "", "", "", "", "", "", ""],
      [1, "12", "Lea Beispel", 1992, "Club A", "Tom Beispiel", 1990, "Club B", "8,0", "", "23"],
    ]);
    rememberImportFile(file);

    const draft = await api.createImportDraft({
      seasonId: created.seasonId,
      fileName: file.name,
      category: "doubles",
      raceNumber: 2,
      matchingConfig: {
        autoMin: 0.5,
        reviewMin: 0.5,
        autoMergeEnabled: false,
        perfectMatchAutoMerge: false,
        strictNormalizedAutoOnly: false,
      },
    });

    expect(draft.reviewItems.length).toBe(1);
    const firstReview = draft.reviewItems[0];
    if (!firstReview) {
      throw new Error("Expected doubles review item.");
    }
    const firstCandidate = firstReview.candidates[0];
    if (!firstCandidate) {
      throw new Error("Expected doubles candidate.");
    }
    const yobComparison = firstCandidate.fieldComparisons.find((item) => item.fieldKey === "yob");
    expect(yobComparison?.candidateValue).toBe("1992 / 1990");
  });

  it("aligns doubles comparison values when stored team member order is swapped", async () => {
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Stundenlauf 2034" });
    await api.openSeason(created.seasonId);
    const repo = await getSeasonRepository();
    await repo.saveImportedSeason(
      {
        season_id: created.seasonId,
        label: created.label,
        created_at: new Date().toISOString(),
      },
      [
        personRegistered({
          person_id: "person-swapped-a",
          given_name: "Tom",
          family_name: "Beispiel",
          display_name: "Tom Beispiel",
          name_normalized: "tom beispiel",
          yob: 1990,
          gender: "M",
          club: "Club B",
          club_normalized: "club b",
        }),
        personRegistered({
          person_id: "person-swapped-b",
          given_name: "Lea",
          family_name: "Beispiel",
          display_name: "Lea Beispiel",
          name_normalized: "lea beispiel",
          yob: 1992,
          gender: "F",
          club: "Club A",
          club_normalized: "club a",
        }),
        teamRegistered({
          team_id: "team-couple-swapped",
          member_person_ids: ["person-swapped-a", "person-swapped-b"],
          team_kind: "couple",
        }),
        importBatchRecorded({
          import_batch_id: "batch-couple-swapped",
          source_file: "paare-lauf-1.xlsx",
          source_sha256: "sha-couple-swapped",
        }),
        raceRegistered({
          race_event_id: "race-couple-swapped",
          import_batch_id: "batch-couple-swapped",
          category: { duration: "hour", division: "couples_mixed" },
          race_no: 1,
          entries: [
            defaultEntry({
              entry_id: "entry-couple-swapped",
              team_id: "team-couple-swapped",
              incoming: {
                display_name: "Tom Beispiel / Lea Beispiel",
                yob: null,
                yob_text: "1990 / 1992",
                club: "Club B / Club A",
                row_kind: "team",
                sheet_name: "paare-lauf-1.xlsx",
                section_name: "Paare Mix",
                row_index: 0,
              },
            }),
          ],
        }),
      ],
    );

    const file = buildCouplesImportFile([
      EXPECTED_HEADER_COUPLES,
      ["h-Lauf", "", "", "", "", "", "", "", "", "", ""],
      ["Paare Mix", "", "", "", "", "", "", "", "", "", ""],
      [1, "14", "Lea Beispel", 1992, "Club A", "Tom Beispiel", 1990, "Club B", "8,3", "", "20"],
    ]);
    rememberImportFile(file);

    const draft = await api.createImportDraft({
      seasonId: created.seasonId,
      fileName: file.name,
      category: "doubles",
      raceNumber: 3,
      matchingConfig: {
        autoMin: 0.5,
        reviewMin: 0.5,
        autoMergeEnabled: false,
        perfectMatchAutoMerge: false,
        strictNormalizedAutoOnly: false,
      },
    });

    expect(draft.reviewItems.length).toBe(1);
    const firstReview = draft.reviewItems[0];
    if (!firstReview) {
      throw new Error("Expected doubles review item.");
    }
    const firstCandidate = firstReview.candidates[0];
    if (!firstCandidate) {
      throw new Error("Expected doubles candidate.");
    }

    const nameComparison = firstCandidate.fieldComparisons.find((item) => item.fieldKey === "name");
    const yobComparison = firstCandidate.fieldComparisons.find((item) => item.fieldKey === "yob");
    const clubComparison = firstCandidate.fieldComparisons.find((item) => item.fieldKey === "club");
    expect(nameComparison?.candidateValue).toBe("Lea Beispiel / Tom Beispiel");
    expect(yobComparison?.candidateValue).toBe("1992 / 1990");
    expect(clubComparison?.candidateValue).toBe("Club A / Club B");
  });

  it("applies merge_with_typo_fix correction for a single review candidate", async () => {
    const api = createTsAppApi();
    const created = await api.createSeason({ label: "Stundenlauf 2035" });
    await api.openSeason(created.seasonId);
    const repo = await getSeasonRepository();
    await repo.saveImportedSeason(
      {
        season_id: created.seasonId,
        label: created.label,
        created_at: new Date().toISOString(),
      },
      [
        personRegistered({
          person_id: "person-correction-existing",
          given_name: "Katharina",
          family_name: "Moller",
          display_name: "Katharina Moller",
          name_normalized: "katharina|moller",
          yob: 1991,
          club: "Altverein",
          club_normalized: "altverein",
        }),
        teamRegistered({
          team_id: "team-correction-existing",
          member_person_ids: ["person-correction-existing"],
          team_kind: "solo",
        }),
        // A historical race entry is required so that the person appears in the
        // category-scoped candidate pool during matching (hour + men).
        importBatchRecorded({
          import_batch_id: "batch-hist-correction",
          source_sha256: "sha-hist-correction",
        }),
        raceRegistered({
          import_batch_id: "batch-hist-correction",
          category: { duration: "hour", division: "men" },
          race_no: 99,
          entries: [
            defaultEntry({
              team_id: "team-correction-existing",
              incoming: {
                display_name: "Katharina Moller",
                yob: 1991,
                yob_text: null,
                club: "Altverein",
                row_kind: "solo",
                sheet_name: "hist.xlsx",
                section_name: "Männer 60min",
                row_index: 0,
              },
            }),
          ],
        }),
      ],
    );

    const file = buildSinglesImportFile([
      EXPECTED_HEADER_SINGLES,
      ["h-Lauf", "", "", "", "", "", "", ""],
      ["Männer", "", "", "", "", "", "", ""],
      [1, "10", "Moller, Katharina", 1991, "Altverein", "10,2", "", "11"],
    ]);
    rememberImportFile(file);

    const draft = await api.createImportDraft({
      seasonId: created.seasonId,
      fileName: file.name,
      category: "singles",
      raceNumber: 1,
      matchingConfig: {
        autoMin: 0.5,
        reviewMin: 0.5,
        autoMergeEnabled: false,
        perfectMatchAutoMerge: false,
        strictNormalizedAutoOnly: false,
      },
    });
    const review = draft.reviewItems[0];
    if (!review) {
      throw new Error("Expected single review item.");
    }
    const candidate = review.candidates[0];
    if (!candidate) {
      throw new Error("Expected candidate for correction review.");
    }

    const corrected = await api.applyImportReviewCorrection(draft.draftId, {
      reviewId: review.reviewId,
      candidateId: candidate.candidateId,
      correction: {
        type: "single",
        name: "Müller, Katharina",
        yob: 1993,
        club: "  SV Nord  ",
      },
    });

    expect(corrected.decisions).toEqual([
      { reviewId: review.reviewId, action: "merge_with_typo_fix", candidateId: candidate.candidateId },
    ]);
    expect(corrected.summary.typoCorrections).toBe(1);

    const finalized = await api.finalizeImportDraft(draft.draftId);
    expect(finalized.severity).toBe("success");

    const events = await repo.getEventLog(created.seasonId);
    const correctionEvent = events.find((event) => event.type === "person.corrected");
    expect(correctionEvent).toBeDefined();
    const payload = correctionEvent?.payload as {
      person_id: string;
      rationale: string;
      updated_fields: {
        given_name?: string;
        family_name?: string;
        display_name?: string;
        name_normalized?: string;
        yob?: number;
        club?: string | null;
        club_normalized?: string;
      };
    };
    expect(payload.person_id).toBe("person-correction-existing");
    expect(payload.updated_fields).toMatchObject({
      given_name: "Katharina",
      family_name: "Müller",
      display_name: "Müller, Katharina",
      name_normalized: "katharina|muller",
      yob: 1993,
      club: "SV Nord",
      club_normalized: "sv nord",
    });
    expect(payload.rationale).toContain("merge_with_typo_fix");
  });
});

describe("TsAppApi corrections – identity lookup and correction", () => {
  async function buildSeasonWithTeam(repo: InMemorySeasonRepository, seasonLabel: string) {
    const season = await repo.createSeason(seasonLabel);
    await repo.appendEvents(season.season_id, [
      personRegistered({
        person_id: "person-solo",
        given_name: "Anna",
        family_name: "Alpha",
        display_name: "Anna Alpha",
        name_normalized: "anna alpha",
        yob: 1990,
        club: "Club A",
        club_normalized: "club a",
      }),
      teamRegistered({
        team_id: "team-solo",
        member_person_ids: ["person-solo"],
        team_kind: "solo",
      }),
      importBatchRecorded({ import_batch_id: "batch-corr", source_file: "lauf.xlsx", source_sha256: "sha" }),
      raceRegistered({
        race_event_id: "race-corr",
        import_batch_id: "batch-corr",
        category: { duration: "hour", division: "women" },
        race_no: 1,
        entries: [defaultEntry({ entry_id: "entry-corr", team_id: "team-solo", points: 10, distance_m: 5000 })],
      }),
    ]);
    return season;
  }

  async function buildSeasonWithCoupleTeam(repo: InMemorySeasonRepository, seasonLabel: string) {
    const season = await repo.createSeason(seasonLabel);
    await repo.appendEvents(season.season_id, [
      personRegistered({
        person_id: "person-a",
        given_name: "Maria",
        family_name: "Muster",
        display_name: "Maria Muster",
        name_normalized: "maria muster",
        yob: 1988,
        club: "SV Paar",
        club_normalized: "sv paar",
      }),
      personRegistered({
        person_id: "person-b",
        given_name: "Josef",
        family_name: "Muster",
        display_name: "Josef Muster",
        name_normalized: "josef muster",
        yob: 1985,
        club: "SV Paar",
        club_normalized: "sv paar",
      }),
      teamRegistered({
        team_id: "team-couple",
        member_person_ids: ["person-a", "person-b"],
        team_kind: "couple",
      }),
      importBatchRecorded({ import_batch_id: "batch-couple", source_file: "paare.xlsx", source_sha256: "sha2" }),
      raceRegistered({
        race_event_id: "race-couple",
        import_batch_id: "batch-couple",
        category: { duration: "hour", division: "couples_mixed" },
        race_no: 1,
        entries: [defaultEntry({ entry_id: "entry-couple", team_id: "team-couple", points: 15, distance_m: 8000 })],
      }),
    ]);
    return season;
  }

  it("getStandingsRowIdentity returns solo member data", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await buildSeasonWithTeam(repo, "Stundenlauf Identity 2031");
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    const identity = await api.getStandingsRowIdentity(season.season_id, {
      categoryKey: "hour:women",
      teamId: "team-solo",
    });

    expect(identity.teamId).toBe("team-solo");
    expect(identity.teamKind).toBe("solo");
    expect(identity.members).toHaveLength(1);
    expect(identity.members[0]).toMatchObject({
      personId: "person-solo",
      name: "Anna Alpha",
      yob: 1990,
      club: "Club A",
    });
  });

  it("getStandingsRowIdentity returns couple member data with both persons", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await buildSeasonWithCoupleTeam(repo, "Stundenlauf Couple Identity 2032");
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    const identity = await api.getStandingsRowIdentity(season.season_id, {
      categoryKey: "hour:couples_mixed",
      teamId: "team-couple",
    });

    expect(identity.teamKind).toBe("couple");
    expect(identity.members).toHaveLength(2);
    expect(identity.members[0]).toMatchObject({ personId: "person-a", name: "Maria Muster" });
    expect(identity.members[1]).toMatchObject({ personId: "person-b", name: "Josef Muster" });
  });

  it("getStandingsRowIdentity throws when teamId is unknown", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await buildSeasonWithTeam(repo, "Stundenlauf Identity Error 2033");
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    await expect(
      api.getStandingsRowIdentity(season.season_id, {
        categoryKey: "hour:women",
        teamId: "team-nonexistent",
      }),
    ).rejects.toThrow(/nicht gefunden/i);
  });

  it("correctStandingsRowIdentity appends a person.corrected event and returns success", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await buildSeasonWithTeam(repo, "Stundenlauf Correct 2034");
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    const result = await api.correctStandingsRowIdentity(season.season_id, {
      categoryKey: "hour:women",
      teamId: "team-solo",
      members: [{ personId: "person-solo", name: "Beta, Anna", yob: 1991, club: "  Club B  " }],
    });

    expect(result.severity).toBe("success");

    const events = await repo.getEventLog(season.season_id);
    const correctionEvent = events.find((ev) => ev.type === "person.corrected");
    expect(correctionEvent).toBeDefined();
    const payload = correctionEvent?.payload as {
      person_id: string;
      updated_fields: {
        given_name?: string;
        family_name?: string;
        display_name?: string;
        name_normalized?: string;
        yob?: number;
        club?: string | null;
        club_normalized?: string;
      };
      rationale: string;
    };
    expect(payload.person_id).toBe("person-solo");
    expect(payload.updated_fields).toMatchObject({
      given_name: "Anna",
      family_name: "Beta",
      display_name: "Beta, Anna",
      name_normalized: "anna|beta",
      yob: 1991,
      club: "Club B",
      club_normalized: "club b",
    });
    expect(payload.rationale).toMatch(/Korrekturen-Ansicht/);
  });

  it("correctStandingsRowIdentity updates both persons for a couple team", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await buildSeasonWithCoupleTeam(repo, "Stundenlauf Couple Correct 2035");
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    const result = await api.correctStandingsRowIdentity(season.season_id, {
      categoryKey: "hour:couples_mixed",
      teamId: "team-couple",
      members: [
        { personId: "person-a", name: "Maria K.", yob: 1988, club: "TuS Neu" },
        { personId: "person-b", name: "Josef K.", yob: 1985, club: "TuS Neu" },
      ],
    });

    expect(result.severity).toBe("success");

    const events = await repo.getEventLog(season.season_id);
    const corrections = events.filter((ev) => ev.type === "person.corrected");
    expect(corrections).toHaveLength(2);
    const personIds = corrections.map((ev) => (ev.payload as { person_id: string }).person_id);
    expect(personIds).toContain("person-a");
    expect(personIds).toContain("person-b");
  });

  it("correctStandingsRowIdentity reflects changes in subsequent getStandings call", async () => {
    const repo = new InMemorySeasonRepository();
    setSeasonRepositoryForTests(repo);
    const season = await buildSeasonWithTeam(repo, "Stundenlauf Reflect 2036");
    const api = createTsAppApi();
    await api.openSeason(season.season_id);

    await api.correctStandingsRowIdentity(season.season_id, {
      categoryKey: "hour:women",
      teamId: "team-solo",
      members: [{ personId: "person-solo", name: "Anna Gamma", yob: 1992, club: "Club C" }],
    });

    const standings = await api.getStandings(season.season_id);
    const row = standings.rowsByCategory["hour:women"]?.find((r) => r.teamId === "team-solo");
    expect(row?.team).toBe("Anna Gamma");
    expect(row?.club).toBe("Club C");
  });
});
