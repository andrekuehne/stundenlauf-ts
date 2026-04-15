import { useEffect, useState } from "react";
import type { ImportedRunRow } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { PhasePlaceholderPage } from "@/features/shared/PhasePlaceholderPage.tsx";

export function ImportPage() {
  const api = useAppApi();
  const { shellData, setSidebarControls } = useAppShellContext();
  const [importedRuns, setImportedRuns] = useState<ImportedRunRow[]>([]);

  useEffect(() => {
    const seasonId = shellData.selectedSeasonId;
    if (!seasonId) {
      setImportedRuns([]);
      return;
    }
    const activeSeasonId = seasonId;

    let cancelled = false;
    async function loadImportedRuns() {
      try {
        const standings = await api.getStandings(activeSeasonId);
        if (!cancelled) {
          setImportedRuns(standings.importedRuns);
        }
      } catch {
        if (!cancelled) {
          setImportedRuns([]);
        }
      }
    }

    void loadImportedRuns();
    return () => {
      cancelled = true;
    };
  }, [api, shellData.selectedSeasonId]);

  useEffect(() => {
    if (!shellData.selectedSeasonId) {
      setSidebarControls(null);
      return;
    }

    setSidebarControls(
      <div className="sidebar-controls">
        <section className="sidebar-controls__section">
          <h4>{STR.views.standings.importedRunsTitle}</h4>
          {importedRuns.length === 0 ? (
            <p>{STR.views.standings.noRows}</p>
          ) : (
            <div className="table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>{STR.views.standings.importedRunsRaceCol}</th>
                    {importedRuns.map((entry) => (
                      <th key={entry.raceLabel} className="ui-table__cell--center">
                        {entry.raceLabel.replace("Lauf ", "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>{STR.views.standings.importedRunsRowSingles}</th>
                    {importedRuns.map((entry) => (
                      <td key={`single-${entry.raceLabel}`} className="ui-table__cell--center">
                        {entry.categoryLabel.includes("Paare") ? "—" : "x"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>{STR.views.standings.importedRunsRowCouples}</th>
                    {importedRuns.map((entry) => (
                      <td key={`couples-${entry.raceLabel}`} className="ui-table__cell--center">
                        {entry.categoryLabel.includes("Paare") ? "x" : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>,
    );

    return () => {
      setSidebarControls(null);
    };
  }, [importedRuns, setSidebarControls, shellData.selectedSeasonId]);

  return (
    <PhasePlaceholderPage
      title={STR.views.import.title}
      description={STR.views.import.subtitle}
      emptyTitle="Import folgt in Phase 2"
      emptyMessage="Der gefuehrte Import- und Matching-Ablauf wird im naechsten Migrationsschritt in diese Route verlagert."
    />
  );
}
