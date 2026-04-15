import { useEffect, useMemo, useState } from "react";
import type { ExportActionDescriptor, StandingsData, StandingsRow } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { formatKm } from "@/app/format.ts";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { PageHeader } from "@/components/layout/PageHeader.tsx";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { useStandingsStore } from "@/stores/standings.ts";
import { useStatusStore } from "@/stores/status.ts";

type CategoryGroupKey = "single" | "couples";
type RaceResult = { distanceKm: number; points: number } | null;
type StandingsViewRow = StandingsRow & {
  yob?: number;
  yobPair?: string;
  raceResults: RaceResult[];
};

const CATEGORY_GROUPS: Array<{
  key: CategoryGroupKey;
  title: string;
  rows: string[][];
}> = [
  {
    key: "single",
    title: "Einzel",
    rows: [
      ["half_hour:women", "hour:women"],
      ["half_hour:men", "hour:men"],
    ],
  },
  {
    key: "couples",
    title: "Paare",
    rows: [
      ["half_hour:couples_women", "hour:couples_women"],
      ["half_hour:couples_men", "hour:couples_men"],
      ["half_hour:couples_mixed", "hour:couples_mixed"],
    ],
  },
];

function categoryButtonLabel(key: string): string {
  const [duration, division] = key.split(":");
  const durationLabel = duration === "half_hour" ? "1/2 h" : "1 h";
  const normalizedDivision = division?.replace("couples_", "") ?? division ?? "";
  const divisionLabel =
    normalizedDivision === "women" ? "Frauen" : normalizedDivision === "men" ? "Männer" : "Mix";
  return `${durationLabel} - ${divisionLabel}`;
}

function isCouplesCategory(categoryKey: string): boolean {
  return categoryKey.includes("couples_");
}

function formatRaceCell(result: RaceResult): string {
  if (!result) {
    return "—";
  }
  return `${formatKm(result.distanceKm)} km / ${result.points.toLocaleString("de-DE")} P`;
}

function buildRaceResults(row: StandingsRow): RaceResult[] {
  const totalRaces = Math.max(0, row.races);
  if (totalRaces === 0) {
    return [];
  }

  const evenlyDistributedDistance = row.distanceKm / totalRaces;
  const evenlyDistributedPoints = Math.floor(row.points / totalRaces);
  const remainderPoints = row.points - evenlyDistributedPoints * totalRaces;

  return Array.from({ length: totalRaces }, (_, index) => ({
    distanceKm: evenlyDistributedDistance,
    points: evenlyDistributedPoints + (index < remainderPoints ? 1 : 0),
  }));
}

export function StandingsPage() {
  const api = useAppApi();
  const { shellData } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const selectedCategoryKey = useStandingsStore((state) => state.selectedCategoryKey);
  const selectCategory = useStandingsStore((state) => state.selectCategory);
  const [data, setData] = useState<StandingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [excludedRows, setExcludedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const seasonId = shellData.selectedSeasonId;
    if (!seasonId) {
      setData(null);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!seasonId) {
        return;
      }
      setLoading(true);
      try {
        const next = await api.getStandings(seasonId);
        if (!cancelled) {
          setData(next);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, shellData.selectedSeasonId]);

  useEffect(() => {
    if (!data || data.categories.length === 0) {
      return;
    }

    const hasSelection = data.categories.some((entry) => entry.key === selectedCategoryKey);
    if (!hasSelection) {
      const firstCategory = data.categories[0];
      if (firstCategory) {
        selectCategory(firstCategory.key);
      }
    }
  }, [data, selectedCategoryKey, selectCategory]);

  const selectedCategory = data?.categories.find((entry) => entry.key === selectedCategoryKey) ?? null;
  const selectedRows = useMemo(
    () => (selectedCategory ? [...(data?.rowsByCategory[selectedCategory.key] ?? [])].sort((a, b) => a.rank - b.rank) : []),
    [data, selectedCategory],
  );

  const selectedViewRows = useMemo<StandingsViewRow[]>(
    () =>
      selectedRows.map((row) => ({
        ...row,
        raceResults: buildRaceResults(row),
      })),
    [selectedRows],
  );

  const maxRaceColumns = useMemo(
    () => selectedCategory?.importedRuns ?? Math.max(0, ...selectedViewRows.map((row) => row.raceResults.length)),
    [selectedCategory?.importedRuns, selectedViewRows],
  );

  const summaryColumns = useMemo<DataTableColumn<StandingsViewRow>[]>(
    () => {
      const couples = selectedCategory ? isCouplesCategory(selectedCategory.key) : false;
      return [
        { key: "rank", header: "Platz", align: "right", cell: (row) => row.rank },
        { key: "team", header: "Name", cell: (row) => row.team },
        {
          key: "yob",
          header: "Jahrgang",
          align: "right",
          cell: (row) => (couples ? row.yobPair ?? "—" : row.yob?.toString() ?? "—"),
        },
        { key: "club", header: "Verein", cell: (row) => row.club || "—" },
        { key: "distanceKm", header: "Gesamtdistanz (km)", align: "right", cell: (row) => formatKm(row.distanceKm) },
        {
          key: "points",
          header: "Gesamtpunkte",
          align: "right",
          cell: (row) => row.points.toLocaleString("de-DE"),
        },
      ];
    },
    [selectedCategory],
  );

  const detailedColumns = useMemo<DataTableColumn<StandingsViewRow>[]>(
    () => [
      { key: "rank", header: "Platz", align: "right", cell: (row) => row.rank },
      {
        key: "excluded",
        header: "a.W.",
        align: "center",
        cell: (row) => {
          const categoryPrefix = selectedCategory?.key ?? "unknown";
          const exclusionKey = `${categoryPrefix}:${row.team}`;
          return (
            <input
              type="checkbox"
              checked={Boolean(excludedRows[exclusionKey])}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setExcludedRows((prev) => ({ ...prev, [exclusionKey]: checked }));
              }}
              aria-label={`a.W. ${row.team}`}
            />
          );
        },
      },
      { key: "team", header: "Name", cell: (row) => row.team },
      ...Array.from({ length: maxRaceColumns }, (_, index) => ({
        key: `race_${index + 1}`,
        header: `Lauf ${index + 1}`,
        align: "right" as const,
        cell: (row: StandingsViewRow) => formatRaceCell(row.raceResults[index] ?? null),
      })),
      { key: "distanceKm", header: "Gesamtdistanz", align: "right", cell: (row) => formatKm(row.distanceKm) },
      {
        key: "points",
        header: "Gesamtpunkte",
        align: "right",
        cell: (row) => row.points.toLocaleString("de-DE"),
      },
    ],
    [excludedRows, maxRaceColumns, selectedCategory?.key],
  );

  async function handleExport(action: ExportActionDescriptor) {
    if (!shellData.selectedSeasonId) {
      setStatus({
        severity: "warn",
        message: STR.views.standings.noSeason,
        source: "standings",
      });
      return;
    }

    const result = await api.runExportAction(shellData.selectedSeasonId, action.id);
    setStatus({
      severity: result.severity,
      message: result.message,
      source: "standings",
    });
  }

  return (
    <div className="page-stack">
      <PageHeader title={STR.views.standings.title} description={STR.views.standings.subtitle} />

      {!shellData.selectedSeasonId ? (
        <EmptyState title={STR.views.standings.title} message={STR.views.standings.noSeason} />
      ) : loading || !data ? (
        <section className="surface-card">
          <p className="surface-card__note">Wertungen werden geladen...</p>
        </section>
      ) : (
        <div className="page-grid page-grid--standings">
            <aside className="surface-card">
              <div className="surface-card__header">
                <div>
                  <h2>{STR.views.standings.categoriesTitle}</h2>
                  <p>Die Auswahl steuert die Tabelle im Hauptbereich.</p>
                </div>
              </div>

              <div className="category-group-list">
                {CATEGORY_GROUPS.map((group) => (
                  <section key={group.key} className="category-group">
                    <h3>{group.title}</h3>
                    <div className="category-matrix">
                      {group.rows.flat().map((categoryKey) => {
                        const category = data.categories.find((entry) => entry.key === categoryKey) ?? null;
                        const isDisabled = !category || category.participantCount === 0;
                        return (
                          <button
                            key={categoryKey}
                            type="button"
                            className={`category-button category-button--compact ${
                              selectedCategory?.key === categoryKey ? "is-active" : ""
                            }`}
                            disabled={isDisabled}
                            onClick={() => {
                              if (category) {
                                selectCategory(category.key);
                              }
                            }}
                          >
                            <strong>{categoryButtonLabel(categoryKey)}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div className="surface-card__section">
                <h3>{STR.views.standings.exportTitle}</h3>
                <div className="stack-actions">
                  {data.exportActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={`button ${action.availability === "ready" ? "button--primary" : ""}`}
                      onClick={() => void handleExport(action)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className="surface-card">
              <div className="surface-card__header">
                <div>
                  <h2>{selectedCategory?.label ?? STR.views.standings.title}</h2>
                  <p>{selectedCategory?.description ?? STR.views.standings.placeholder}</p>
                </div>
              </div>
              <DataTable
                className="ui-table--standings"
                columns={summaryColumns}
                rows={selectedViewRows}
                rowKey={(row) => `${row.rank}-${row.team}`}
                emptyMessage={STR.views.standings.noRows}
              />
              <div className="surface-card__section">
                <h3>Detailergebnisse</h3>
              </div>
              <DataTable
                className="ui-table--standings ui-table--standings-detail"
                columns={detailedColumns}
                rows={selectedViewRows}
                rowKey={(row) => `${row.rank}-${row.team}-detail`}
                emptyMessage={STR.views.standings.noRows}
              />
            </section>
          </div>
      )}
    </div>
  );
}
