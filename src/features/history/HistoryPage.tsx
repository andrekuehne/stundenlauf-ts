import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryData, ImportBatchSummary } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { PageHeader } from "@/components/layout/PageHeader.tsx";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { useStatusStore } from "@/stores/status.ts";

type ConfirmDialogState = { batch: ImportBatchSummary };

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function HistoryPage() {
  const api = useAppApi();
  const { shellData } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HistoryData | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  }, [api, shellData.selectedSeasonId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const confirmReset = useCallback(async () => {
    if (!confirmDialog || !shellData.selectedSeasonId) return;
    const { batch } = confirmDialog;
    setBusyBatchId(batch.importBatchId);
    try {
      const result = await api.rollbackHistory(shellData.selectedSeasonId, {
        mode: "grouped",
        anchorSeq: batch.anchorSeq,
        importBatchId: batch.importBatchId,
        reason: "ui.history.rollback_batch",
      });
      setStatus({ severity: result.severity, source: "history", message: result.message });
      setConfirmDialog(null);
      await loadHistory();
    } finally {
      setBusyBatchId(null);
    }
  }, [api, confirmDialog, loadHistory, setStatus, shellData.selectedSeasonId]);

  const columns = useMemo<DataTableColumn<ImportBatchSummary>[]>(
    () => [
      {
        key: "sourceFile",
        header: STR.views.history.sourceFile,
        cell: (row) => row.sourceFile,
      },
      {
        key: "importedAt",
        header: STR.views.history.importedAt,
        cell: (row) => formatDateTime(row.recordedAt),
      },
      {
        key: "actions",
        header: STR.views.history.eventActions,
        cell: (row) => (
          <button
            type="button"
            className="button button--ghost button--danger"
            disabled={busyBatchId === row.importBatchId || row.state !== "active"}
            onClick={() => {
              setConfirmDialog({ batch: row });
            }}
          >
            {row.state === "rolled_back"
              ? STR.views.history.rolledBack
              : STR.views.history.actionHardReset}
          </button>
        ),
      },
    ],
    [busyBatchId],
  );

  return (
    <div className="page-stack">
      <PageHeader title={STR.views.history.title} description={STR.views.history.subtitle} />
      {!shellData.selectedSeasonId ? (
        <EmptyState title={STR.views.history.title} message={STR.views.history.noSeason} />
      ) : loading || !data ? (
        <section className="surface-card">
          <p className="surface-card__note">{STR.views.history.loading}</p>
        </section>
      ) : (
        <section className="surface-card">
          <div className="surface-card__header">
            <div>
              <h2>{STR.views.history.historyTableTitle}</h2>
              <p>{data.seasonLabel}</p>
            </div>
          </div>
          <DataTable
            columns={columns}
            rows={data.importBatches}
            rowKey={(row) => row.importBatchId}
            emptyMessage={STR.views.history.noImports}
          />
        </section>
      )}

      {confirmDialog ? (
        <div className="confirm-modal__backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title">
            <div className="confirm-modal__header">
              <h2 id="reset-confirm-title">{STR.views.history.importRollbackConfirmTitle}</h2>
            </div>
            <div className="confirm-modal__body">
              <p>{STR.views.history.importRollbackConfirmBody}</p>
              <p>
                <strong>{STR.views.history.hardResetConfirmFile(confirmDialog.batch.sourceFile)}</strong>
              </p>
              <p className="surface-card__note">
                {STR.views.history.importedAt}: {formatDateTime(confirmDialog.batch.recordedAt)}
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
                disabled={busyBatchId === confirmDialog.batch.importBatchId}
                onClick={() => {
                  void confirmReset();
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
