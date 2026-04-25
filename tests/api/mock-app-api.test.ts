import { describe, expect, it } from "vitest";
import { createMockAppApi } from "@/api/mock/index.ts";

describe("MockAppApi", () => {
  it("creates and selects a new season", async () => {
    const api = createMockAppApi();

    const created = await api.createSeason({ label: "Stundenlauf 2027" });
    const shell = await api.getShellData();
    const seasons = await api.listSeasons();

    expect(created.label).toBe("Stundenlauf 2027");
    expect(shell.selectedSeasonId).toBe(created.seasonId);
    expect(seasons[0]?.label).toBe("Stundenlauf 2027");
  });

  it("opens and deletes seasons while keeping shell data in sync", async () => {
    const api = createMockAppApi();
    const seasons = await api.listSeasons();
    const fallback = seasons[1];
    expect(fallback).toBeDefined();

    if (!fallback) {
      throw new Error("Expected fallback season fixture.");
    }

    await api.openSeason(fallback.seasonId);
    let shell = await api.getShellData();
    expect(shell.selectedSeasonId).toBe(fallback.seasonId);

    await api.deleteSeason(fallback.seasonId);
    shell = await api.getShellData();
    expect(shell.selectedSeasonId).not.toBe(fallback.seasonId);
  });

  it("returns standings and export feedback for the active season", async () => {
    const api = createMockAppApi();
    const shell = await api.getShellData();
    expect(shell.selectedSeasonId).toBeTruthy();

    if (!shell.selectedSeasonId) {
      throw new Error("Expected initial active season.");
    }

    const standings = await api.getStandings(shell.selectedSeasonId);
    const exportResult = await api.runExportAction(shell.selectedSeasonId, "export_pdf");
    const kidsExportResult = await api.runExportAction(shell.selectedSeasonId, "export_kids_excel");

    expect(standings.categories.length).toBeGreaterThan(0);
    expect(exportResult.message).toContain("Mock-Modus");
    expect(kidsExportResult.message).toContain("Kids Excel");
  });

  it("re-ranks eligible rows when exclusion toggles", async () => {
    const api = createMockAppApi();
    const shell = await api.getShellData();
    if (!shell.selectedSeasonId) {
      throw new Error("Expected initial active season.");
    }

    const seasonId = shell.selectedSeasonId;
    const categoryKey = "hour:men";
    const before = await api.getStandings(seasonId);
    const rowsBefore = before.rowsByCategory[categoryKey];
    expect(rowsBefore).toBeDefined();
    const target = rowsBefore?.[0];
    const next = rowsBefore?.[1];
    if (!target || !next) {
      throw new Error("Expected fixture rows for hour:men.");
    }

    await api.setStandingsRowExcluded(seasonId, {
      categoryKey,
      teamId: target.teamId ?? target.team,
      excluded: true,
    });

    const after = await api.getStandings(seasonId);
    const rowsAfter = after.rowsByCategory[categoryKey] ?? [];
    const targetAfter = rowsAfter.find((row) => row.team === target.team);
    const nextAfter = rowsAfter.find((row) => row.team === next.team);
    expect(targetAfter?.excluded).toBe(true);
    expect(targetAfter?.rank).toBeNull();
    expect(nextAfter?.rank).toBe(1);
  });
});
