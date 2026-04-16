import type { ImportedRunRow } from "@/api/contracts/index.ts";
import { STR } from "@/app/strings.ts";

const DEFAULT_RACE_COUNT = 5;

type Category = "singles" | "doubles";

type CategoryRow = {
  key: Category;
  label: string;
  modifier: string;
};

const CATEGORY_ROWS: CategoryRow[] = [
  { key: "singles", label: STR.views.import.seasonOverviewSinglesLabel, modifier: "singles" },
  { key: "doubles", label: STR.views.import.seasonOverviewDoublesLabel, modifier: "doubles" },
];

function parseRaceFromLabel(raceLabel: string): number {
  const normalized = raceLabel.toLowerCase().replace("lauf", "").trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDoublesEntry(entry: ImportedRunRow): boolean {
  return entry.categoryLabel.includes("Paare");
}

function buildImportedRaceSet(importedRuns: ImportedRunRow[], category: Category): Set<number> {
  const wantsDoubles = category === "doubles";
  const races = new Set<number>();
  for (const entry of importedRuns) {
    if (isDoublesEntry(entry) !== wantsDoubles) {
      continue;
    }
    const race = parseRaceFromLabel(entry.raceLabel);
    if (race > 0) {
      races.add(race);
    }
  }
  return races;
}

function computeRaceCount(importedRuns: ImportedRunRow[]): number {
  let max = DEFAULT_RACE_COUNT;
  for (const entry of importedRuns) {
    const race = parseRaceFromLabel(entry.raceLabel);
    if (race > max) {
      max = race;
    }
  }
  return max;
}

type ImportSeasonOverviewProps = {
  importedRuns: ImportedRunRow[];
  selectedCategory: Category;
  selectedRaceNumber: string;
  disabled?: boolean;
  onSelectRace: (category: Category, raceNumber: number) => void;
};

export function ImportSeasonOverview({
  importedRuns,
  selectedCategory,
  selectedRaceNumber,
  disabled = false,
  onSelectRace,
}: ImportSeasonOverviewProps) {
  const raceCount = computeRaceCount(importedRuns);
  const races = Array.from({ length: raceCount }, (_, index) => index + 1);
  const selectedRace = Number.parseInt(selectedRaceNumber, 10);
  const hasSelectedRace = Number.isFinite(selectedRace) && selectedRace > 0;

  return (
    <section
      className="surface-card import-season-overview"
      aria-label={STR.views.import.seasonOverviewTitle}
    >
      <div className="surface-card__header import-season-overview__header">
        <h2>{STR.views.import.seasonOverviewTitle}</h2>
        <p>{STR.views.import.seasonOverviewHint}</p>
      </div>
      <div className="import-season-overview__rows">
        {CATEGORY_ROWS.map((row) => {
          const importedRaces = buildImportedRaceSet(importedRuns, row.key);
          return (
            <div
              key={row.key}
              className={`import-season-overview__row import-season-overview__row--${row.modifier}`}
            >
              <span className="import-season-overview__row-label">{row.label}</span>
              <div className="import-season-overview__chips">
                {races.map((race) => {
                  const isImported = importedRaces.has(race);
                  const isSelected =
                    hasSelectedRace && selectedRace === race && selectedCategory === row.key;
                  const className = [
                    "import-season-overview__chip",
                    isImported ? "is-imported" : "is-free",
                    isSelected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const ariaLabel = isImported
                    ? STR.views.import.seasonOverviewChipImported(race, row.label)
                    : STR.views.import.seasonOverviewChipFree(race, row.label);
                  return (
                    <button
                      key={race}
                      type="button"
                      className={className}
                      data-race={race}
                      data-category={row.key}
                      aria-label={ariaLabel}
                      aria-pressed={isSelected}
                      title={ariaLabel}
                      disabled={disabled}
                      onClick={() => {
                        onSelectRace(row.key, race);
                      }}
                    >
                      <span className="import-season-overview__chip-number">{race}</span>
                      <span className="import-season-overview__chip-status" aria-hidden="true">
                        {isImported ? "✓" : "·"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="import-season-overview__legend" aria-hidden="true">
        <span className="import-season-overview__legend-item">
          <span className="import-season-overview__legend-swatch is-imported">✓</span>
          {STR.views.import.seasonOverviewLegendImported}
        </span>
        <span className="import-season-overview__legend-item">
          <span className="import-season-overview__legend-swatch is-free">·</span>
          {STR.views.import.seasonOverviewLegendFree}
        </span>
      </div>
    </section>
  );
}
