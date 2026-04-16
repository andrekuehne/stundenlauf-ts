import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ExportActionDescriptor, StandingsData, StandingsRow } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { formatKm } from "@/app/format.ts";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { PageHeader } from "@/components/layout/PageHeader.tsx";
import { useStandingsStore } from "@/stores/standings.ts";
import { useStatusStore } from "@/stores/status.ts";

type CategoryGroupKey = "single" | "couples";
type PdfLayoutPreset = "default" | "compact";
type RaceResult = { distanceKm: number; points: number } | null;
type StandingsViewRow = StandingsRow & { raceResults: RaceResult[] };
type StandingsColumnWidth = { key: string; width: string };

const CATEGORY_GROUPS: Array<{
  key: CategoryGroupKey;
  title: string;
  rows: string[][];
}> = [
  {
    key: "single",
    title: STR.views.standings.sectionSingles,
    rows: [
      ["half_hour:women", "hour:women"],
      ["half_hour:men", "hour:men"],
    ],
  },
  {
    key: "couples",
    title: STR.views.standings.sectionCouples,
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

function formatPoints(points: number): string {
  return points.toLocaleString("de-DE");
}

function formatStandingsName(row: StandingsRow): string {
  const yobLabel = row.yobPair ?? (typeof row.yob === "number" ? String(row.yob) : "");
  return yobLabel ? `${row.team} (${yobLabel})` : row.team;
}

function buildStandingsColumnWidths(maxRaceColumns: number): StandingsColumnWidth[] {
  const widths: StandingsColumnWidth[] = [
    { key: "rank", width: "4.25rem" },
    { key: "excluded", width: "3.5rem" },
    { key: "name", width: "18rem" },
    { key: "club", width: "14rem" },
  ];

  for (let index = 0; index < maxRaceColumns; index += 1) {
    widths.push({ key: `race-km-${index + 1}`, width: "5.1rem" });
    widths.push({ key: `race-points-${index + 1}`, width: "5.1rem" });
  }

  widths.push({ key: "total-km", width: "5.1rem" });
  widths.push({ key: "total-points", width: "5.1rem" });
  return widths;
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
  const { shellData, setSidebarControls } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const selectedCategoryKey = useStandingsStore((state) => state.selectedCategoryKey);
  const selectCategory = useStandingsStore((state) => state.selectCategory);
  const [data, setData] = useState<StandingsData | null>(null);
  const [pendingExcludedRows, setPendingExcludedRows] = useState<Record<string, boolean>>({});
  const [pdfLayoutPreset, setPdfLayoutPreset] = useState<PdfLayoutPreset>("compact");

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
  const detailColumnWidths = useMemo(() => buildStandingsColumnWidths(maxRaceColumns), [maxRaceColumns]);

  const handleExcludedChange = useCallback(
    async (row: StandingsViewRow, excluded: boolean) => {
      const seasonId = shellData.selectedSeasonId;
      const categoryKey = selectedCategory?.key;
      const teamId = row.teamId;
      if (!seasonId || !categoryKey || !teamId) {
        return;
      }
      const exclusionKey = `${categoryKey}:${teamId}`;
      setPendingExcludedRows((prev) => ({ ...prev, [exclusionKey]: true }));
      try {
        await api.setStandingsRowExcluded(seasonId, { categoryKey, teamId, excluded });
        await loadStandings(seasonId);
        setStatus({
          severity: "success",
          message: excluded ? STR.views.standings.statusExcluded : STR.views.standings.statusIncluded,
          source: "standings",
        });
      } catch (error) {
        setStatus({
          severity: "error",
          message: error instanceof Error ? error.message : "Änderung konnte nicht gespeichert werden.",
          source: "standings",
        });
      } finally {
        setPendingExcludedRows((prev) => {
          return Object.fromEntries(
            Object.entries(prev).filter(([key]) => key !== exclusionKey),
          );
        });
      }
    },
    [api, loadStandings, selectedCategory?.key, setStatus, shellData.selectedSeasonId],
  );

  const detailColumnCount = 6 + maxRaceColumns * 2;

  const handleExport = useCallback(
    async (action: ExportActionDescriptor) => {
      if (!shellData.selectedSeasonId) {
        setStatus({
          severity: "warn",
          message: STR.views.standings.noSeason,
          source: "standings",
        });
        return;
      }

      const result =
        action.id === "export_pdf"
          ? await api.runExportAction(shellData.selectedSeasonId, action.id, { pdfLayoutPreset })
          : await api.runExportAction(shellData.selectedSeasonId, action.id);
      setStatus({
        severity: result.severity,
        message: result.message,
        source: "standings",
      });
    },
    [api, pdfLayoutPreset, setStatus, shellData.selectedSeasonId],
  );

  useLayoutEffect(() => {
    if (!shellData.selectedSeasonId) {
      setSidebarControls(null);
      return;
    }

    setSidebarControls(
      <div className="sidebar-controls">
        <section className="sidebar-controls__section">
          <h4>{STR.views.standings.sectionSingles}</h4>
          <div className="category-matrix">
            {CATEGORY_GROUPS[0]?.rows.flat().map((categoryKey) => {
              const category = data?.categories.find((entry) => entry.key === categoryKey) ?? null;
              const isDisabled = !category || category.participantCount === 0;
              return (
                <button
                  key={categoryKey}
                  type="button"
                  className={`category-button category-button--compact ${selectedCategory?.key === categoryKey ? "is-active" : ""}`}
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

        <section className="sidebar-controls__section">
          <h4>{STR.views.standings.sectionCouples}</h4>
          <div className="category-matrix">
            {CATEGORY_GROUPS[1]?.rows.flat().map((categoryKey) => {
              const category = data?.categories.find((entry) => entry.key === categoryKey) ?? null;
              const isDisabled = !category || category.participantCount === 0;
              return (
                <button
                  key={categoryKey}
                  type="button"
                  className={`category-button category-button--compact ${selectedCategory?.key === categoryKey ? "is-active" : ""}`}
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

        <section className="sidebar-controls__section">
          <h4>{STR.views.standings.exportTitle}</h4>
          {data?.exportActions.some((action) => action.id === "export_pdf") ? (
            <label className="field-stack">
              <span>{STR.views.standings.pdfStyleLabel}</span>
              <select
                aria-label={STR.views.standings.pdfStyleLabel}
                value={pdfLayoutPreset}
                onChange={(event) => { setPdfLayoutPreset(event.currentTarget.value as PdfLayoutPreset); }}
              >
                <option value="default">{STR.views.standings.pdfStyleNormal}</option>
                <option value="compact">{STR.views.standings.pdfStyleCompact}</option>
              </select>
            </label>
          ) : null}
          <div className="stack-actions">
            {data?.exportActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`button ${action.availability === "ready" ? "button--primary" : ""}`}
                onClick={() => void handleExport(action)}
              >
                {action.id === "export_pdf" ? STR.views.standings.exportPdfLong : STR.views.standings.exportExcelLong}
              </button>
            ))}
          </div>
        </section>
      </div>,
    );

    return () => {
      setSidebarControls(null);
    };
  }, [data, handleExport, selectCategory, selectedCategory?.key, setSidebarControls, shellData.selectedSeasonId]);

  return (
    <div className="page-stack">
      <PageHeader title={STR.views.standings.title} description={STR.views.standings.subtitle} />

      {!shellData.selectedSeasonId ? (
        <EmptyState title={STR.views.standings.title} message={STR.views.standings.noSeason} />
      ) : !data ? (
        <section className="surface-card">
          <p className="surface-card__note">{STR.views.standings.loading}</p>
        </section>
      ) : (
        <section className="surface-card">
          <div className="surface-card__header">
            <div>
              <h2>{selectedCategory?.label ?? STR.views.standings.title}</h2>
              <p>{selectedCategory?.description ?? STR.views.standings.placeholder}</p>
            </div>
          </div>
          <div className="surface-card__section">
            <h3>{STR.views.standings.detailResultsTitle}</h3>
          </div>
          <div className="table-wrap table-wrap--standings-detail">
            <table className="ui-table ui-table--standings ui-table--standings-detail">
              <colgroup>
                {detailColumnWidths.map((column) => (
                  <col key={column.key} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead>
                <tr className="ui-table--standings-detail__header-row ui-table--standings-detail__header-row--primary">
                  <th className="ui-table__cell--right">{STR.views.standings.headerRank}</th>
                  <th className="ui-table__cell--center">{STR.views.standings.headerExcluded}</th>
                  <th>{STR.views.standings.headerName}</th>
                  <th>{STR.views.standings.club}</th>
                  {Array.from({ length: maxRaceColumns }, (_, index) => (
                    <th
                      key={`group-race-${index + 1}`}
                      colSpan={2}
                      className="ui-table--standings-detail__group"
                    >
                      {index + 1}. Lauf
                    </th>
                  ))}
                  <th colSpan={2} className="ui-table--standings-detail__group">Gesamt</th>
                </tr>
                <tr className="ui-table--standings-detail__header-row ui-table--standings-detail__header-row--secondary">
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  {Array.from({ length: maxRaceColumns + 1 }, (_, index) => (
                    <Fragment key={`detail-subhead-${index}`}>
                      <th>Laufstr.</th>
                      <th>Wertung</th>
                    </Fragment>
                  ))}
                </tr>
                <tr className="ui-table--standings-detail__header-row ui-table--standings-detail__header-row--units">
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  {Array.from({ length: maxRaceColumns + 1 }, (_, index) => (
                    <Fragment key={`detail-units-${index}`}>
                      <th>(km)</th>
                      <th>(Punkte)</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedViewRows.length > 0 ? selectedViewRows.map((row) => {
                  const categoryPrefix = selectedCategory?.key ?? "unknown";
                  const exclusionKey = `${categoryPrefix}:${row.teamId ?? row.team}`;
                  return (
                    <tr key={`${row.teamId ?? row.team}-detail`} className={row.excluded ? "is-excluded" : ""}>
                      <td className="ui-table__cell--right">{row.excluded ? "—" : row.rank}</td>
                      <td className="ui-table__cell--center">
                        <input
                          type="checkbox"
                          checked={Boolean(row.excluded)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            void handleExcludedChange(row, checked);
                          }}
                          aria-label={STR.views.standings.excludedAria(row.team)}
                          disabled={Boolean(pendingExcludedRows[exclusionKey])}
                        />
                      </td>
                      <td>{formatStandingsName(row)}</td>
                      <td>{row.club || "—"}</td>
                      {Array.from({ length: maxRaceColumns }, (_, index) => {
                        const result = row.raceResults[index] ?? null;
                        return (
                          <Fragment key={`${row.teamId ?? row.team}-race-${index + 1}`}>
                            <td className="ui-table__cell--right">{result ? formatKm(result.distanceKm) : "—"}</td>
                            <td className="ui-table__cell--right ui-table--standings-detail__points">
                              {result ? formatPoints(result.points) : "—"}
                            </td>
                          </Fragment>
                        );
                      })}
                      <td className="ui-table__cell--right">{formatKm(row.distanceKm)}</td>
                      <td className="ui-table__cell--right ui-table--standings-detail__points">
                        {formatPoints(row.points)}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={detailColumnCount}>{STR.views.standings.noRows}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
