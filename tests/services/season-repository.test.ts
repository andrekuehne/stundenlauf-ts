import { beforeEach, describe, expect, it, vi } from "vitest";

const eventStoreMock = {
  getWorkspaceSeasons: vi.fn(async () => new Map<string, { season_id: string; label: string; created_at: string }>()),
  saveWorkspaceSeasons: vi.fn(async () => {}),
  deleteEventLog: vi.fn(async () => {}),
  getEventLog: vi.fn(async () => []),
  appendEvents: vi.fn(async () => {}),
  writeEventLog: vi.fn(async () => {}),
  saveWorkspaceSeasonsAndEventLog: vi.fn(async () => {}),
};

vi.mock("@/storage/db.ts", () => ({
  openStundenlaufDB: vi.fn(async () => ({})),
}));
vi.mock("@/storage/event-store.ts", () => ({
  createEventStore: () => eventStoreMock,
}));
vi.mock("@/domain/workspace.ts", () => ({
  emptyWorkspaceState: () => ({ seasons: new Map() }),
  createSeason: (_ws: unknown, label: string) => {
    const seasonId = "s-new";
    return {
      seasonId,
      ws: {
        seasons: new Map([[seasonId, { season_id: seasonId, label, created_at: "2026-01-01T00:00:00.000Z" }]]),
      },
    };
  },
  deleteSeason: ({ seasons }: { seasons: Map<string, unknown> }, seasonId: string) => {
    const next = new Map(seasons);
    next.delete(seasonId);
    return { seasons: next };
  },
}));

describe("season repository", () => {
  beforeEach(async () => {
    vi.resetModules();
    Object.values(eventStoreMock).forEach((fn) => fn.mockClear());
    const { setSeasonRepositoryForTests } = await import("@/services/season-repository.ts");
    setSeasonRepositoryForTests(null);
  });

  it("creates season with trimmed label", async () => {
    const { getSeasonRepository } = await import("@/services/season-repository.ts");
    const repo = await getSeasonRepository();
    const created = await repo.createSeason("  Sommer  ");
    expect(created.label).toBe("Sommer");
    expect(eventStoreMock.saveWorkspaceSeasons).toHaveBeenCalled();
  });

  it("deletes season and associated event log", async () => {
    eventStoreMock.getWorkspaceSeasons.mockResolvedValueOnce(
      new Map([["s-old", { season_id: "s-old", label: "Old", created_at: "2026-01-01T00:00:00.000Z" }]]),
    );
    const { getSeasonRepository } = await import("@/services/season-repository.ts");
    const repo = await getSeasonRepository();
    await repo.deleteSeason("s-old");
    expect(eventStoreMock.deleteEventLog).toHaveBeenCalledWith("s-old");
  });

  it("saves imported season with events in one call", async () => {
    const { getSeasonRepository } = await import("@/services/season-repository.ts");
    const repo = await getSeasonRepository();
    const season = { season_id: "s-imported", label: "Imported", created_at: "2026-01-01T00:00:00.000Z" };
    await repo.saveImportedSeason(season, []);
    expect(eventStoreMock.saveWorkspaceSeasonsAndEventLog).toHaveBeenCalledWith(expect.any(Map), "s-imported", []);
  });
});
