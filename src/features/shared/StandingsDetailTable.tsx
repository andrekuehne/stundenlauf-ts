import { Fragment } from "react";
import type { StandingsRow } from "@/api/contracts/index.ts";
import { formatKm } from "@/app/format.ts";
import { STR } from "@/app/strings.ts";

type RaceResult = { distanceKm: number; points: number } | null;
type StandingsViewRow = StandingsRow & { raceResults: RaceResult[] };
type StandingsColumnWidth = { key: string; width: string };

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

function buildColumnWidths(
  raceColumnCount: number,
  showExcludedColumn: boolean,
): StandingsColumnWidth[] {
  const widths: StandingsColumnWidth[] = [
    { key: "rank", width: "3.75rem" },
  ];
  if (showExcludedColumn) {
    widths.push({ key: "excluded", width: "3rem" });
  }
  widths.push({ key: "name", width: "13rem" });
  widths.push({ key: "club", width: "10rem" });

  for (let index = 0; index < raceColumnCount; index += 1) {
    widths.push({ key: `race-km-${index + 1}`, width: "3.5rem" });
    widths.push({ key: `race-points-${index + 1}`, width: "3.5rem" });
  }

  widths.push({ key: "total-km", width: "4.6rem" });
  widths.push({ key: "total-points", width: "4.6rem" });
  return widths;
}

function formatPoints(points: number): string {
  return points.toLocaleString("de-DE");
}

function formatYobLabel(row: StandingsRow): string {
  return row.yobPair ?? (typeof row.yob === "number" ? String(row.yob) : "");
}

interface StandingsDetailTableProps {
  rows: StandingsRow[];
  raceColumnCount: number;
  showExcludedColumn?: boolean;
  onToggleExcluded?: (row: StandingsRow) => void;
  onEditRow?: (row: StandingsRow) => void;
}

export function StandingsDetailTable({
  rows,
  raceColumnCount,
  showExcludedColumn = false,
  onToggleExcluded,
  onEditRow,
}: StandingsDetailTableProps) {
  const viewRows = partitionByExclusion(
    rows.map((row) => ({ ...row, raceResults: buildRaceResults(row) })),
  );

  const columnWidths = buildColumnWidths(raceColumnCount, showExcludedColumn);
  // rank + optional a.W. + name + club + (raceColumnCount * 2) + total km + total points
  const columnCount =
    1 + (showExcludedColumn ? 1 : 0) + 2 + raceColumnCount * 2 + 2;

  return (
    <div className="table-wrap table-wrap--standings-detail">
      <table className="ui-table ui-table--standings ui-table--standings-detail">
        <colgroup>
          {columnWidths.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="ui-table--standings-detail__header-row ui-table--standings-detail__header-row--primary">
            <th className="ui-table__cell--right ui-table--standings-detail__sticky-cell--rank">
              {STR.views.standings.headerRank}
            </th>
            {showExcludedColumn ? (
              <th className="ui-table__cell--center">{STR.views.standings.headerExcluded}</th>
            ) : null}
            <th className="ui-table--standings-detail__sticky-cell--name">
              {STR.views.standings.headerName}
            </th>
            <th>{STR.views.standings.club}</th>
            {Array.from({ length: raceColumnCount }, (_, index) => (
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
            {showExcludedColumn ? (
              <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
            ) : null}
            <th
              aria-hidden="true"
              className="ui-table--standings-detail__header-blank ui-table--standings-detail__sticky-cell--name"
            />
            <th aria-hidden="true" className="ui-table--standings-detail__header-blank" />
            {Array.from({ length: raceColumnCount + 1 }, (_, index) => (
              <Fragment key={`detail-units-${index}`}>
                <th>{STR.views.standings.headerUnitKm}</th>
                <th>{STR.views.standings.headerUnitPoints}</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {viewRows.length > 0 ? (
            viewRows.map((row) => {
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
              const rowKey = `${row.teamId ?? row.team}-detail`;

              return (
                <tr key={rowKey} className={rowClass}>
                  <td className="ui-table__cell--right ui-table--standings-detail__sticky-cell--rank">
                    {row.excluded ? "—" : row.rank}
                  </td>
                  {showExcludedColumn ? (
                    <td className="ui-table__cell--center">
                      <input
                        type="checkbox"
                        checked={row.excluded ?? false}
                        aria-label={STR.views.standings.excludedAria(row.team)}
                        onChange={(event) => {
                          if (onToggleExcluded) {
                            onToggleExcluded({ ...row, excluded: event.target.checked });
                          }
                        }}
                      />
                    </td>
                  ) : null}
                  <td className="ui-table--standings-detail__sticky-cell--name">
                    {onEditRow ? (
                      <button
                        type="button"
                        className="standings-team-edit-trigger"
                        onClick={() => { onEditRow(row); }}
                      >
                        <span className="standings-team" data-testid="standings-team-name">
                          {row.team}
                        </span>
                        {yobLabel ? (
                          <span className="standings-team-yob">({yobLabel})</span>
                        ) : null}
                      </button>
                    ) : (
                      <>
                        <span className="standings-team" data-testid="standings-team-name">
                          {row.team}
                        </span>
                        {yobLabel ? (
                          <span className="standings-team-yob">({yobLabel})</span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="standings-club" title={row.club || undefined}>
                    {onEditRow ? (
                      <button
                        type="button"
                        className="standings-team-edit-trigger"
                        onClick={() => { onEditRow(row); }}
                      >
                        {row.club || "—"}
                      </button>
                    ) : (
                      row.club || "—"
                    )}
                  </td>
                  {Array.from({ length: raceColumnCount }, (_, index) => {
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
            })
          ) : (
            <tr>
              <td colSpan={columnCount}>{STR.views.standings.noRows}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
