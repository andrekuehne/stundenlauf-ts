import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryData, HistoryRow, HistoryRollbackMode } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { InfoCard } from "@/components/layout/InfoCard.tsx";
import { PageHeader } from "@/components/layout/PageHeader.tsx";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { useStatusStore } from "@/stores/status.ts";

type ConfirmDialogState =
  | { kind: "rollback"; row: HistoryRow; mode: HistoryRollbackMode }
  | { kind: "hard-reset"; row: HistoryRow };

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function scopeLabel(scope: HistoryRow["scope"]): string {
  if (scope === "race") return "Lauf";
  if (scope === "batch") return "Importgruppe";
  return "Saison";
}

export function HistoryPage() {
  const api = useAppApi();
  const { shellData } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HistoryData | null>(null);
  const [frozenSeq, setFrozenSeq] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [busySeq, setBusySeq] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    const seasonId = shellData.selectedSeasonId;
    if (!seasonId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const next = await api.getHistory(seasonId);
      setData(next);
      if (frozenSeq != null && !next.rows.some((row) => row.seq === frozenSeq)) {
        setFrozenSeq(null);
      }
    } finally {
      setLoading(false);
    }
  }, [api, frozenSeq, shellData.selectedSeasonId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const rows = useMemo(
    () => (frozenSeq == null ? data?.rows ?? [] : (data?.rows ?? []).filter((row) => row.seq <= frozenSeq)),
    [data?.rows, frozenSeq],
  );

  const previewSeq = useCallback(
    async (row: HistoryRow) => {
      if (!shellData.selectedSeasonId) {
        return;
      }
      setBusySeq(row.seq);
      try {
        const preview = await api.previewHistoryState(shellData.selectedSeasonId, { anchorSeq: row.seq });
        setFrozenSeq(preview.anchorSeq);
        setStatus({
          severity: "info",
          source: "history",
          message: `${preview.derivedStateLabel}. ${preview.blockedReason}`,
        });
      } finally {
        setBusySeq(null);
      }
    },
    [api, setStatus, shellData.selectedSeasonId],
  );

  const confirmRollback = useCallback(async () => {
    if (!confirmDialog || confirmDialog.kind !== "rollback" || !shellData.selectedSeasonId) {
      return;
    }
    setBusySeq(confirmDialog.row.seq);
    try {
      const result = await api.rollbackHistory(shellData.selectedSeasonId, {
        mode: confirmDialog.mode,
        anchorSeq: confirmDialog.row.seq,
        raceEventId: confirmDialog.row.raceEventId ?? undefined,
        importBatchId: confirmDialog.row.importBatchId ?? undefined,
        reason: "ui.history.rollback",
      });
      setStatus({ severity: result.severity, source: "history", message: result.message });
      setConfirmDialog(null);
      await loadHistory();
    } finally {
      setBusySeq(null);
    }
  }, [api, confirmDialog, loadHistory, setStatus, shellData.selectedSeasonId]);

  const confirmHardReset = useCallback(async () => {
    if (!confirmDialog || confirmDialog.kind !== "hard-reset" || !shellData.selectedSeasonId) {
      return;
    }
    setBusySeq(confirmDialog.row.seq);
    try {
      const result = await api.hardResetHistoryToSeq(shellData.selectedSeasonId, {
        anchorSeq: confirmDialog.row.seq,
        reason: "ui.history.hard_reset",
      });
      setFrozenSeq(null);
      setStatus({ severity: result.severity, source: "history", message: result.message });
      setConfirmDialog(null);
      await loadHistory();
    } finally {
      setBusySeq(null);
    }
  }, [api, confirmDialog, loadHistory, setStatus, shellData.selectedSeasonId]);

  const columns = useMemo<DataTableColumn<HistoryRow>[]>(
    () => [
      { key: "seq", header: STR.views.history.eventSeq, align: "right", cell: (row) => row.seq },
      { key: "recordedAt", header: STR.views.history.eventTime, cell: (row) => formatDateTime(row.recordedAt) },
      { key: "type", header: STR.views.history.eventType, cell: (row) => row.type },
      { key: "scope", header: STR.views.history.eventScope, cell: (row) => scopeLabel(row.scope) },
      { key: "summary", header: STR.views.history.eventSummary, cell: (row) => row.summary },
      {
        key: "effective",
        header: STR.views.history.eventEffective,
        align: "center",
        cell: (row) => (row.isEffectiveChange ? STR.views.history.effectiveYes : STR.views.history.effectiveNo),
      },
      {
        key: "actions",
        header: STR.views.history.eventActions,
        cell: (row) => {
          const inPreview = frozenSeq != null;
          return (
            <div className="inline-actions">
              <button type="button" className="button" disabled={busySeq === row.seq} onClick={() => void previewSeq(row)}>
                {STR.views.history.actionPreview}
              </button>
              <button
                type="button"
                className="button"
                disabled={inPreview || !row.actionability.canPreviewRollbackAtomic || busySeq === row.seq}
                title={inPreview ? STR.views.history.actionBlockedPreview : undefined}
                onClick={() => {
                  setConfirmDialog({ kind: "rollback", row, mode: "atomic" });
                }}
              >
                {STR.views.history.actionRollbackAtomic}
              </button>
              <button
                type="button"
                className="button"
                disabled={inPreview || !row.actionability.canPreviewRollbackGroup || busySeq === row.seq}
                title={inPreview ? STR.views.history.actionBlockedPreview : undefined}
                onClick={() => {
                  setConfirmDialog({ kind: "rollback", row, mode: "grouped" });
                }}
              >
                {STR.views.history.actionRollbackGroup}
              </button>
              <button
                type="button"
                className="button button--ghost"
                disabled={inPreview || !row.actionability.canHardResetToHere || busySeq === row.seq}
                title={inPreview ? STR.views.history.actionBlockedPreview : undefined}
                onClick={() => {
                  setConfirmDialog({ kind: "hard-reset", row });
                }}
              >
                {STR.views.history.actionHardReset}
              </button>
            </div>
          );
        },
      },
    ],
    [busySeq, frozenSeq, previewSeq],
  );

  return (
    <div className="page-stack">
      <PageHeader title={STR.views.history.title} description={STR.views.history.subtitle} />
      {!shellData.selectedSeasonId ? (
        <EmptyState title={STR.views.history.title} message={STR.views.history.noSeason} />
      ) : (
        <>
          <section className="surface-card history-view__context">
            <div className="sidebar-controls">
              <section className="sidebar-controls__section">
                <h4>{STR.views.history.selectedRaceTitle}</h4>
                {data?.raceContext ? (
                  <>
                    <p>
                      <strong>{data.raceContext.raceLabel}</strong> - {data.raceContext.categoryLabel}
                    </p>
                    <p>{data.raceContext.raceDateLabel}</p>
                    <p className="surface-card__note">
                      {frozenSeq == null
                        ? STR.views.history.selectedRaceLive
                        : STR.views.history.selectedRaceAsOf(frozenSeq)}
                    </p>
                    {frozenSeq != null ? (
                      <>
                        <p className="surface-card__note">{STR.views.history.freezeHint}</p>
                        <button
                          type="button"
                          className="button"
                          onClick={() => {
                            setFrozenSeq(null);
                          }}
                        >
                          {STR.views.history.leavePreview}
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p>{STR.views.history.selectedRaceEmpty}</p>
                )}
              </section>
              <section className="sidebar-controls__section">
                <InfoCard title={STR.views.history.auditTrailTitle}>
                  <p>
                    {rows.length} Events {frozenSeq == null ? "im Live-Stand" : `bis seq ${frozenSeq}`}
                  </p>
                </InfoCard>
              </section>
            </div>
          </section>
          {loading || !data ? (
            <section className="surface-card">
              <p className="surface-card__note">{STR.views.history.loading}</p>
            </section>
          ) : (
            <section className="surface-card">
              <div className="surface-card__header">
                <div>
                  <h2>{STR.views.history.historyTableTitle}</h2>
                  <p>
                    {data.seasonLabel}
                    {frozenSeq != null ? ` - ${STR.views.history.selectedRaceAsOf(frozenSeq)}` : ""}
                  </p>
                </div>
              </div>
              <DataTable columns={columns} rows={rows} rowKey={(row) => row.eventId} emptyMessage={STR.views.history.placeholder} />
            </section>
          )}
        </>
      )}

      {confirmDialog ? (
        <div className="confirm-modal__backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true">
            <div className="confirm-modal__header">
              <h2>
                {confirmDialog.kind === "rollback"
                  ? STR.views.history.rollbackConfirmTitle
                  : STR.views.history.hardResetConfirmTitle}
              </h2>
            </div>
            <div className="confirm-modal__body">
              <p>
                {confirmDialog.kind === "rollback"
                  ? confirmDialog.mode === "atomic"
                    ? STR.views.history.rollbackConfirmAtomicBody
                    : STR.views.history.rollbackConfirmGroupBody
                  : STR.views.history.hardResetConfirmBody}
              </p>
              <p>
                {STR.views.history.eventSeq}: {confirmDialog.row.seq}
              </p>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setConfirmDialog(null);
                }}
              >
                {STR.confirmModal.cancel}
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  if (confirmDialog.kind === "rollback") {
                    void confirmRollback();
                  } else {
                    void confirmHardReset();
                  }
                }}
              >
                {STR.confirmModal.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
