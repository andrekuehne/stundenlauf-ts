import { useEffect, useMemo, useState } from "react";
import type { ExportActionDescriptor, StandingsData } from "@/api/contracts/index.ts";
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

export function StandingsPage() {
  const api = useAppApi();
  const { shellData } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const selectedCategoryKey = useStandingsStore((state) => state.selectedCategoryKey);
  const selectCategory = useStandingsStore((state) => state.selectCategory);
  const [data, setData] = useState<StandingsData | null>(null);
  const [loading, setLoading] = useState(false);

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
    () => (selectedCategory ? data?.rowsByCategory[selectedCategory.key] ?? [] : []),
    [data, selectedCategory],
  );

  const standingsColumns = useMemo<DataTableColumn<(typeof selectedRows)[number]>[]>(
    () => [
      { key: "rank", header: STR.views.standings.rank, cell: (row) => row.rank },
      { key: "team", header: STR.views.standings.team, cell: (row) => row.team },
      { key: "club", header: STR.views.standings.club, cell: (row) => row.club },
      { key: "points", header: STR.views.standings.points, cell: (row) => row.points },
      { key: "distanceKm", header: STR.views.standings.distance, cell: (row) => formatKm(row.distanceKm) },
      { key: "races", header: STR.views.standings.races, cell: (row) => row.races },
      { key: "note", header: STR.views.standings.note, cell: (row) => row.note ?? " " },
    ],
    [],
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
                columns={standingsColumns}
                rows={selectedRows}
                emptyMessage={STR.views.standings.noRows}
              />
            </section>
          </div>
      )}
    </div>
  );
}
