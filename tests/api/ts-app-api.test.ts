import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTsAppApi } from "@/api/ts/index.ts";
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
  resetSeqCounter,
  teamRegistered,
} from "../helpers/event-factories.ts";

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
  });
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
});
