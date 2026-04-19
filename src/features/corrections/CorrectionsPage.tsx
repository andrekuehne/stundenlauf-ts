import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { StandingsData, StandingsRow, StandingsRowIdentity, StandingsRowIdentityMember } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { CorrectionModal } from "@/features/corrections/CorrectionModal.tsx";
import { CategoryChipsBar } from "@/features/shared/CategoryChipsBar.tsx";
import { StandingsDetailTable } from "@/features/shared/StandingsDetailTable.tsx";
import {
  buildStandingsRaceColumnHeaders,
  computeStandingsRaceColumnCount,
  STANDINGS_RACE_COLUMNS_WHEN_EMPTY,
} from "@/features/shared/standingsRaceColumnLayout.ts";
import { useStandingsStore } from "@/stores/standings.ts";
import { useStatusStore } from "@/stores/status.ts";

export function CorrectionsPage() {
  const api = useAppApi();
  const { shellData, setSidebarControls } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const selectedCategoryKey = useStandingsStore((state) => state.selectedCategoryKey);
  const selectCategory = useStandingsStore((state) => state.selectCategory);

  const [data, setData] = useState<StandingsData | null>(null);
  const [busy, setBusy] = useState(false);

  // Correction modal state
  const [editIdentity, setEditIdentity] = useState<StandingsRowIdentity | null>(null);
  const [editRow, setEditRow] = useState<StandingsRow | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  useLayoutEffect(() => {
    setSidebarControls(null);
    return () => {
      setSidebarControls(null);
    };
  }, [setSidebarControls]);

  const selectedCategory = data?.categories.find((entry) => entry.key === selectedCategoryKey) ?? null;
  const selectedRows = useMemo(
    () => (selectedCategory ? [...(data?.rowsByCategory[selectedCategory.key] ?? [])] : []),
    [data, selectedCategory],
  );
  const seasonRaceColumnCount = useMemo(
    () => (data ? computeStandingsRaceColumnCount(data.categories) : STANDINGS_RACE_COLUMNS_WHEN_EMPTY),
    [data],
  );

  const raceColumnHeaders = useMemo(() => {
    if (!selectedCategory) {
      return undefined;
    }
    return buildStandingsRaceColumnHeaders(selectedCategory, seasonRaceColumnCount);
  }, [selectedCategory, seasonRaceColumnCount]);
  const includedTeamsCount = useMemo(
    () => selectedRows.filter((row) => !row.excluded).length,
    [selectedRows],
  );
  const excludedTeamsCount = useMemo(
    () => selectedRows.filter((row) => row.excluded).length,
    [selectedRows],
  );
  const importedRunsForCategory = selectedCategory?.importedRuns ?? 0;

  const handleToggleExcluded = useCallback(
    async (row: StandingsRow) => {
      const seasonId = shellData.selectedSeasonId;
      const categoryKey = selectedCategoryKey;
      const teamId = row.teamId;
      if (!seasonId || !categoryKey || !teamId) return;
      setBusy(true);
      try {
        await api.setStandingsRowExcluded(seasonId, {
          categoryKey,
          teamId,
          excluded: row.excluded ?? false,
        });
        const next = await api.getStandings(seasonId);
        setData(next);
        setStatus({
          severity: "success",
          message: row.excluded
            ? STR.views.standings.excludedTeamLabel(row.team)
            : STR.views.standings.statusIncluded,
          source: "corrections",
        });
      } catch (reason) {
        setStatus({
          severity: "error",
          message: reason instanceof Error ? reason.message : "Fehler beim Ändern der Wertungsstellung.",
          source: "corrections",
        });
      } finally {
        setBusy(false);
      }
    },
    [api, shellData.selectedSeasonId, selectedCategoryKey, setStatus],
  );

  const handleEditRow = useCallback(
    async (row: StandingsRow) => {
      const seasonId = shellData.selectedSeasonId;
      const categoryKey = selectedCategoryKey;
      const teamId = row.teamId;
      if (!seasonId || !categoryKey || !teamId) return;
      setBusy(true);
      try {
        const identity = await api.getStandingsRowIdentity(seasonId, { categoryKey, teamId });
        setEditRow(row);
        setEditIdentity(identity);
        setSaveError(null);
      } catch (reason) {
        setStatus({
          severity: "error",
          message: reason instanceof Error ? reason.message : "Identität konnte nicht geladen werden.",
          source: "corrections",
        });
      } finally {
        setBusy(false);
      }
    },
    [api, shellData.selectedSeasonId, selectedCategoryKey, setStatus],
  );

  const handleSaveCorrection = useCallback(
    async (members: StandingsRowIdentityMember[]) => {
      const seasonId = shellData.selectedSeasonId;
      const categoryKey = selectedCategoryKey;
      const teamId = editRow?.teamId;
      if (!seasonId || !categoryKey || !teamId) return;
      setBusy(true);
      setSaveError(null);
      try {
        const result = await api.correctStandingsRowIdentity(seasonId, { categoryKey, teamId, members });
        const next = await api.getStandings(seasonId);
        setData(next);
        setEditIdentity(null);
        setEditRow(null);
        setStatus({ severity: result.severity, message: result.message, source: "corrections" });
      } catch (reason) {
        setSaveError(reason instanceof Error ? reason.message : "Korrektur fehlgeschlagen.");
      } finally {
        setBusy(false);
      }
    },
    [api, shellData.selectedSeasonId, selectedCategoryKey, editRow, setStatus],
  );

  const handleCancelCorrection = useCallback(() => {
    setEditIdentity(null);
    setEditRow(null);
    setSaveError(null);
  }, []);

  return (
    <div className="page-stack">
      {!shellData.selectedSeasonId ? (
        <EmptyState title={STR.views.corrections.title} message={STR.views.corrections.noSeason} />
      ) : !data ? (
        <p className="surface-card__note">{STR.views.corrections.loading}</p>
      ) : (
        <section className="standings-overview">
          <p className="surface-card__note">{STR.views.corrections.guidance}</p>

          <div className="standings-overview__kpis" role="group" aria-label={STR.views.standings.summaryTitle}>
            <div
              className="summary-card standings-overview__kpi standings-overview__kpi--teams"
              data-testid="corrections-kpi-teams"
            >
              <span>{STR.views.standings.kpiTeamsLabel}</span>
              <strong>{includedTeamsCount}</strong>
            </div>
            <div
              className="summary-card standings-overview__kpi standings-overview__kpi--races"
              data-testid="corrections-kpi-races"
            >
              <span>{STR.views.standings.kpiRacesLabel}</span>
              <strong>
                {STR.views.standings.kpiRacesValue(importedRunsForCategory, seasonRaceColumnCount)}
              </strong>
            </div>
            <div
              className="summary-card standings-overview__kpi standings-overview__kpi--excluded"
              data-testid="corrections-kpi-excluded"
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
          </div>

          <StandingsDetailTable
            rows={selectedRows}
            raceColumnCount={seasonRaceColumnCount}
            raceColumnHeaders={raceColumnHeaders}
            showExcludedColumn
            onToggleExcluded={
              busy
                ? undefined
                : (row) => {
                    void handleToggleExcluded(row);
                  }
            }
            onEditRow={
              busy
                ? undefined
                : (row) => {
                    void handleEditRow(row);
                  }
            }
          />
        </section>
      )}

      {editIdentity ? (
        <CorrectionModal
          identity={editIdentity}
          busy={busy}
          saveError={saveError}
          onSave={(members) => {
            void handleSaveCorrection(members);
          }}
          onCancel={handleCancelCorrection}
        />
      ) : null}
    </div>
  );
}
