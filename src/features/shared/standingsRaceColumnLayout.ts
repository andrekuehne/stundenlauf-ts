import type { StandingsCategory } from "@/api/contracts/index.ts";

/** When no races exist yet, keep a fixed column count so the empty grid stays usable. */
export const STANDINGS_RACE_COLUMNS_WHEN_EMPTY = 5;

export function computeStandingsRaceColumnCount(
  categories: Pick<StandingsCategory, "importedRuns">[],
): number {
  let max = 0;
  for (const category of categories) {
    if (category.importedRuns > max) {
      max = category.importedRuns;
    }
  }
  return max === 0 ? STANDINGS_RACE_COLUMNS_WHEN_EMPTY : max;
}

/** Pad with `null` when the season table is wider than this category's effective races. */
export function buildStandingsRaceColumnHeaders(
  category: StandingsCategory | null,
  raceColumnCount: number,
): readonly (number | null)[] {
  const nos = category?.raceNos ?? [];
  return Array.from({ length: raceColumnCount }, (_, index) => nos[index] ?? null);
}
