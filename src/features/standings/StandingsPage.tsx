import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ExportActionDescriptor, StandingsCategory, StandingsData, StandingsRow } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { formatKm } from "@/app/format.ts";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { useStandingsStore } from "@/stores/standings.ts";
import { useStatusStore } from "@/stores/status.ts";

type RaceResult = { distanceKm: number; points: number } | null;
type StandingsViewRow = StandingsRow & { raceResults: RaceResult[] };
type StandingsColumnWidth = { key: string; width: string };

const RACE_COLUMN_FLOOR = 5;

type CategoryRowDescriptor = {
  id: "half_hour" | "hour";
  label: string;
  keys: string[];
};

const CATEGORY_ROWS: CategoryRowDescriptor[] = [
  {
    id: "half_hour",
    label: STR.views.standings.categoryRowHalfHour,
    keys: [
      "half_hour:women",
      "half_hour:men",
      "half_hour:couples_women",
      "half_hour:couples_men",
      "half_hour:couples_mixed",
    ],
  },
  {
    id: "hour",
    label: STR.views.standings.categoryRowHour,
    keys: [
      "hour:women",
      "hour:men",
      "hour:couples_women",
      "hour:couples_men",
      "hour:couples_mixed",
    ],
  },
];

function categoryButtonLabel(key: string): string {
  const [duration, division] = key.split(":");
  const durationLabel = duration === "half_hour" ? "1/2 h" : "1 h";
  const divisionLabel = division?.startsWith("couples_")
    ? division === "couples_women"
      ? "Paare F"
      : division === "couples_men"
        ? "Paare M"
        : "Paare Mix"
    : division === "women"
      ? "Frauen"
      : "Männer";
  return `${durationLabel} - ${divisionLabel}`;
}

function formatPoints(points: number): string {
  return points.toLocaleString("de-DE");
}

function formatYobLabel(row: StandingsRow): string {
  return row.yobPair ?? (typeof row.yob === "number" ? String(row.yob) : "");
}

function buildStandingsColumnWidths(raceColumnCount: number): StandingsColumnWidth[] {
  const widths: StandingsColumnWidth[] = [
    { key: "rank", width: "3.75rem" },
    { key: "name", width: "13rem" },
    { key: "club", width: "10rem" },
  ];

  for (let index = 0; index < raceColumnCount; index += 1) {
    widths.push({ key: `race-km-${index + 1}`, width: "3.5rem" });
    widths.push({ key: `race-points-${index + 1}`, width: "3.5rem" });
  }

  widths.push({ key: "total-km", width: "4.6rem" });
  widths.push({ key: "total-points", width: "4.6rem" });
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

function computeSeasonRaceColumnCount(categories: StandingsCategory[]): number {
  let max = 0;
  for (const category of categories) {
    if (category.importedRuns > max) {
      max = category.importedRuns;
    }
  }
  return Math.max(RACE_COLUMN_FLOOR, max);
}

function partitionByExclusion(rows: StandingsViewRow[]): StandingsViewRow[] {
  const included: StandingsViewRow[] = [];
  const excluded: StandingsViewRow[] = [];
  for (const row of rows) {
    if (row.excluded) {
      excluded.push(row);
    } else {
      included.push(row);
    }
  }
  return [...included, ...excluded];
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

  const selectedViewRows = useMemo<StandingsViewRow[]>(
    () =>
      partitionByExclusion(
        selectedRows.map((row) => ({
          ...row,
          raceResults: buildRaceResults(row),
        })),
      ),
    [selectedRows],
  );

  const seasonRaceColumnCount = useMemo(
    () => (data ? computeSeasonRaceColumnCount(data.categories) : RACE_COLUMN_FLOOR),
    [data],
  );
  const detailColumnWidths = useMemo(
    () => buildStandingsColumnWidths(seasonRaceColumnCount),
    [seasonRaceColumnCount],
  );
  const detailColumnCount = 3 + seasonRaceColumnCount * 2 + 2;

  const includedTeamsCount = useMemo(
    () => selectedViewRows.filter((row) => !row.excluded).length,
    [selectedViewRows],
  );
  const excludedTeamsCount = useMemo(
    () => selectedViewRows.filter((row) => row.excluded).length,
    [selectedViewRows],
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
            <div
              className="standings-overview__category-rows"
              role="group"
              aria-label={STR.views.standings.categoriesTitle}
            >
              {CATEGORY_ROWS.map((row) => (
                <div key={row.id} className="standings-overview__category-row">
                  <span className="standings-overview__category-row-label">{row.label}</span>
                  <div className="standings-overview__category-row-chips">
                    {row.keys.map((categoryKey) => {
                      const category = data.categories.find((entry) => entry.key === categoryKey) ?? null;
                      const isDisabled = !category || category.participantCount === 0;
                      const isActive = selectedCategory?.key === categoryKey;
                      const className = [
                        "standings-overview__category-chip",
                        isActive ? "is-active" : "",
                        isDisabled ? "is-disabled" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <button
                          key={categoryKey}
                          type="button"
                          className={className}
                          aria-pressed={isActive}
                          disabled={isDisabled}
                          onClick={() => {
                            if (category) {
                              selectCategory(category.key);
                            }
                          }}
                        >
                          <strong>{categoryButtonLabel(categoryKey).split(" - ")[1]}</strong>
                          <span className="standings-overview__category-chip-meta">
                            {category && category.participantCount > 0
                              ? `${category.participantCount} Teams`
                              : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="standings-overview__exports standings-overview__exports--divided">
              {data.exportActions.map((action) => {
                const isPdf = action.id === "export_pdf";
                const className = [
                  "standings-overview__export-button",
                  isPdf
                    ? "standings-overview__export-button--pdf"
                    : "standings-overview__export-button--excel",
                ].join(" ");
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={className}
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

          <div className="table-wrap table-wrap--standings-detail">
            <table className="ui-table ui-table--standings ui-table--standings-detail">
              <colgroup>
                {detailColumnWidths.map((column) => (
                  <col key={column.key} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead>
                <tr className="ui-table--standings-detail__header-row ui-table--standings-detail__header-row--primary">
                  <th className="ui-table__cell--right ui-table--standings-detail__sticky-cell--rank">
                    {STR.views.standings.headerRank}
                  </th>
                  <th className="ui-table--standings-detail__sticky-cell--name">
                    {STR.views.standings.headerName}
                  </th>
                  <th>{STR.views.standings.club}</th>
                  {Array.from({ length: seasonRaceColumnCount }, (_, index) => (
                    <th
                      key={`group-race-${index + 1}`}
                      colSpan={2}
                      className="ui-table--standings-detail__group"
                    >
                      {STR.views.standings.headerRaceGroup(index + 1)}
                    </th>
                  ))}
                  <th colSpan={2} className="ui-table--standings-detail__group ui-table--standings-detail__group--total">
                    {STR.views.standings.headerTotalGroup}
                  </th>
                </tr>
                <tr className="ui-table--standings-detail__header-row ui-table--standings-detail__header-row--units">
                  <th
                    aria-hidden="true"
                    className="ui-table--standings-detail__header-blank ui-table--standings-detail__sticky-cell--rank"
                  />
                  <th
                    aria-hidden="true"
                    className="ui-table--standings-detail__header-blank ui-table--standings-detail__sticky-cell--name"
                  />
                  <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
                  {Array.from({ length: seasonRaceColumnCount + 1 }, (_, index) => (
                    <Fragment key={`detail-units-${index}`}>
                      <th>{STR.views.standings.headerUnitKm}</th>
                      <th>{STR.views.standings.headerUnitPoints}</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedViewRows.length > 0 ? selectedViewRows.map((row) => {
                  const yobLabel = formatYobLabel(row);
                  const podiumClass =
                    !row.excluded && row.rank === 1
                      ? "is-podium-gold"
                      : !row.excluded && row.rank === 2
                        ? "is-podium-silver"
                        : !row.excluded && row.rank === 3
                          ? "is-podium-bronze"
                          : "";
                  const rowClass = [row.excluded ? "is-excluded" : "", podiumClass]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr key={`${row.teamId ?? row.team}-detail`} className={rowClass}>
                      <td className="ui-table__cell--right ui-table--standings-detail__sticky-cell--rank">
                        {row.excluded ? "—" : row.rank}
                      </td>
                      <td className="ui-table--standings-detail__sticky-cell--name">
                        <span className="standings-team" data-testid="standings-team-name">
                          {row.team}
                        </span>
                        {yobLabel ? (
                          <span className="standings-team-yob">({yobLabel})</span>
                        ) : null}
                      </td>
                      <td className="standings-club" title={row.club || undefined}>
                        {row.club || "—"}
                      </td>
                      {Array.from({ length: seasonRaceColumnCount }, (_, index) => {
                        const result = row.raceResults[index] ?? null;
                        const isPlaceholder = result == null;
                        const placeholderClass = isPlaceholder
                          ? " ui-table--standings-detail__cell--placeholder"
                          : "";
                        return (
                          <Fragment key={`${row.teamId ?? row.team}-race-${index + 1}`}>
                            <td className={`ui-table__cell--right${placeholderClass}`}>
                              {result ? formatKm(result.distanceKm) : "—"}
                            </td>
                            <td
                              className={`ui-table__cell--right ui-table--standings-detail__points${placeholderClass}`}
                            >
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
