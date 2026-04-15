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

    expect(standings.categories.length).toBeGreaterThan(0);
    expect(exportResult.message).toContain("Mock-Modus");
  });
});
