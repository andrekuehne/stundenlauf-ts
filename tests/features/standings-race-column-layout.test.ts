import { describe, expect, it } from "vitest";
import type { StandingsCategory } from "@/api/contracts/index.ts";
import {
  buildStandingsRaceColumnHeaders,
  computeStandingsRaceColumnCount,
  STANDINGS_RACE_COLUMNS_WHEN_EMPTY,
} from "@/features/shared/standingsRaceColumnLayout.ts";

describe("computeStandingsRaceColumnCount", () => {
  it("matches the largest per-category effective race count (no fixed floor)", () => {
    expect(computeStandingsRaceColumnCount([{ importedRuns: 4 }])).toBe(4);
    expect(computeStandingsRaceColumnCount([{ importedRuns: 2 }, { importedRuns: 4 }])).toBe(4);
  });

  it("uses a fixed width only while no races exist yet", () => {
    expect(computeStandingsRaceColumnCount([{ importedRuns: 0 }])).toBe(STANDINGS_RACE_COLUMNS_WHEN_EMPTY);
  });
});

describe("buildStandingsRaceColumnHeaders", () => {
  const cat = (raceNos: readonly number[]): StandingsCategory => ({
    key: "hour:men",
    label: "H",
    description: "d",
    participantCount: 1,
    importedRuns: raceNos.length,
    raceNos,
  });

  it("pads with null when the table is wider than this category's races", () => {
    expect(buildStandingsRaceColumnHeaders(cat([1, 2]), 4)).toEqual([1, 2, null, null]);
  });

  it("returns actual race numbers after a gap (e.g. rolled-back middle race)", () => {
    expect(buildStandingsRaceColumnHeaders(cat([1, 2, 4, 5]), 4)).toEqual([1, 2, 4, 5]);
  });
});
