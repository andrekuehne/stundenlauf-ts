import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ExportActionDescriptor, StandingsCategory, StandingsData } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { CategoryChipsBar } from "@/features/shared/CategoryChipsBar.tsx";
import { StandingsDetailTable } from "@/features/shared/StandingsDetailTable.tsx";
import { useStandingsStore } from "@/stores/standings.ts";
import { useStatusStore } from "@/stores/status.ts";

const RACE_COLUMN_FLOOR = 5;

function computeSeasonRaceColumnCount(categories: StandingsCategory[]): number {
  let max = 0;
  for (const category of categories) {
    if (category.importedRuns > max) {
      max = category.importedRuns;
    }
  }
  return Math.max(RACE_COLUMN_FLOOR, max);
}

function formatLastUpdated(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StandingsPage() {
  const api = useAppApi();
  const { shellData, setSidebarControls } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const selectedCategoryKey = useStandingsStore((state) => state.selectedCategoryKey);
  const selectCategory = useStandingsStore((state) => state.selectCategory);
  const [data, setData] = useState<StandingsData | null>(null);

  const loadStandings = useCallback(async (seasonId: string) => {
    const next = await api.getStandings(seasonId);
    setData(next);
  }, [api]);

  useEffect(() => {
    const seasonId = shellData.selectedSeasonId;
    if (!seasonId) {
      setData(null);
      return;
    }
    void loadStandings(seasonId);
  }, [loadStandings, shellData.selectedSeasonId]);

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
    () => (selectedCategory ? [...(data?.rowsByCategory[selectedCategory.key] ?? [])] : []),
    [data, selectedCategory],
  );

  const seasonRaceColumnCount = useMemo(
    () => (data ? computeSeasonRaceColumnCount(data.categories) : RACE_COLUMN_FLOOR),
    [data],
  );

  const includedTeamsCount = useMemo(
    () => selectedRows.filter((row) => !row.excluded).length,
    [selectedRows],
  );
  const excludedTeamsCount = useMemo(
    () => selectedRows.filter((row) => row.excluded).length,
    [selectedRows],
  );

  const handleExport = useCallback(
    async (seasonId: string, action: ExportActionDescriptor) => {
      const result =
        action.id === "export_pdf"
          ? await api.runExportAction(seasonId, action.id, { pdfLayoutPreset: "compact" })
          : await api.runExportAction(seasonId, action.id);
      setStatus({
        severity: result.severity,
        message: result.message,
        source: "standings",
      });
    },
    [api, setStatus],
  );

  useLayoutEffect(() => {
    setSidebarControls(null);
    return () => {
      setSidebarControls(null);
    };
  }, [setSidebarControls]);

  const lastUpdatedFormatted = data ? formatLastUpdated(data.summary.lastUpdatedAt) : "";
  const importedRunsForCategory = selectedCategory?.importedRuns ?? 0;

  return (
    <div className="page-stack">
      {!shellData.selectedSeasonId ? (
        <EmptyState title={STR.views.standings.title} message={STR.views.standings.noSeason} />
      ) : !data ? (
        <section className="surface-card">
          <p className="surface-card__note">{STR.views.standings.loading}</p>
        </section>
      ) : (
        <section className="surface-card standings-overview">
          <p className="standings-overview__meta" data-testid="standings-meta">
            <span>{data.summary.seasonLabel}</span>
            <span aria-hidden="true">{STR.views.standings.metaSeparator}</span>
            <span>
              {STR.views.standings.metaLastUpdatedLabel} {lastUpdatedFormatted}
            </span>
          </p>

          <div className="standings-overview__kpis" role="group" aria-label={STR.views.standings.summaryTitle}>
            <div
              className="summary-card standings-overview__kpi standings-overview__kpi--teams"
              data-testid="standings-kpi-teams"
            >
              <span>{STR.views.standings.kpiTeamsLabel}</span>
              <strong>{includedTeamsCount}</strong>
            </div>
            <div
              className="summary-card standings-overview__kpi standings-overview__kpi--races"
              data-testid="standings-kpi-races"
            >
              <span>{STR.views.standings.kpiRacesLabel}</span>
              <strong>
                {STR.views.standings.kpiRacesValue(importedRunsForCategory, seasonRaceColumnCount)}
              </strong>
            </div>
            <div
              className="summary-card standings-overview__kpi standings-overview__kpi--excluded"
              data-testid="standings-kpi-excluded"
            >
              <span>{STR.views.standings.kpiExcludedLabel}</span>
              <strong>{excludedTeamsCount}</strong>
            </div>
          </div>

          <div className="standings-overview__category-bar">
            <CategoryChipsBar
              categories={data.categories}
              selectedCategoryKey={selectedCategoryKey}
              onSelect={selectCategory}
            />

            <div className="standings-overview__exports standings-overview__exports--divided">
              {data.exportActions.map((action) => {
                const isPdf = action.id === "export_pdf";
                const exportClass = [
                  "standings-overview__export-button",
                  isPdf
                    ? "standings-overview__export-button--pdf"
                    : "standings-overview__export-button--excel",
                ].join(" ");
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={exportClass}
                    onClick={() => void handleExport(data.seasonId, action)}
                  >
                    {isPdf
                      ? STR.views.standings.exportPdf
                      : STR.views.standings.exportExcel}
                  </button>
                );
              })}
            </div>
          </div>

          <StandingsDetailTable
            rows={selectedRows}
            raceColumnCount={seasonRaceColumnCount}
          />
        </section>
      )}
    </div>
  );
}
