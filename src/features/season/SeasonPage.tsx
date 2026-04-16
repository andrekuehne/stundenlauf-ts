import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SeasonListItem } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { useStatusStore } from "@/stores/status.ts";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SeasonPage() {
  const api = useAppApi();
  const navigate = useNavigate();
  const { shellData, refreshShellData } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const [seasons, setSeasons] = useState<SeasonListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionSeasonId, setActionSeasonId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [seasonPendingDelete, setSeasonPendingDelete] = useState<SeasonListItem | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [newSeasonLabel, setNewSeasonLabel] = useState("");

  const loadSeasons = useCallback(async () => {
    setLoading(true);
    try {
      setSeasons(await api.listSeasons());
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadSeasons();
  }, [loadSeasons]);

  const columns = useMemo<DataTableColumn<SeasonListItem>[]>(
    () => [
      {
        key: "label",
        header: STR.views.season.nameHeader,
        cell: (row) => (
          <div className="season-table__name">
            <strong>{row.label}</strong>
            {row.isActive ? <span className="season-pill">{STR.views.season.activeTag}</span> : null}
          </div>
        ),
      },
      {
        key: "importedEvents",
        header: STR.views.season.importedEvents,
        cell: (row) => row.importedEvents,
      },
      {
        key: "lastModifiedAt",
        header: STR.views.season.lastModified,
        cell: (row) => formatDateTime(row.lastModifiedAt),
      },
      {
        key: "actions",
        header: STR.views.season.actions,
        cell: (row) => (
          <div className="inline-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={actionSeasonId === row.seasonId}
              onClick={() => {
                void handleOpen(row);
              }}
            >
              {STR.views.season.openAction}
            </button>
            <button
              type="button"
              className="button"
              disabled={actionSeasonId === row.seasonId}
              onClick={() => {
                void handleSeasonCommand("export_backup", row);
              }}
            >
              {STR.views.season.exportAction}
            </button>
            <button
              type="button"
              className="button"
              disabled={actionSeasonId === row.seasonId}
              onClick={() => {
                void handleExport(row.seasonId, "export_excel");
              }}
            >
              {STR.views.season.exportExcelAction}
            </button>
            <button
              type="button"
              className="button"
              disabled={actionSeasonId === row.seasonId}
              onClick={() => {
                void handleExport(row.seasonId, "export_pdf");
              }}
            >
              {STR.views.season.exportPdfAction}
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={actionSeasonId === row.seasonId}
              onClick={() => {
                setDeleteConfirmInput("");
                setSeasonPendingDelete(row);
              }}
            >
              {STR.views.season.deleteAction}
            </button>
          </div>
        ),
      },
    ],
    [actionSeasonId],
  );

  async function refreshAll() {
    await refreshShellData();
    await loadSeasons();
  }

  async function handleOpen(row: SeasonListItem) {
    setActionSeasonId(row.seasonId);
    try {
      await api.openSeason(row.seasonId);
      await refreshAll();
      setStatus({
        severity: "info",
        message: STR.views.season.openedDone(row.label),
        source: "season",
      });
      void navigate(row.importedEvents > 0 ? "/standings" : "/import");
    } finally {
      setActionSeasonId(null);
    }
  }

  async function handleDelete() {
    if (!seasonPendingDelete) {
      return;
    }
    if (deleteConfirmInput !== seasonPendingDelete.label) {
      return;
    }

    setActionSeasonId(seasonPendingDelete.seasonId);
    try {
      await api.deleteSeason(seasonPendingDelete.seasonId);
      await refreshAll();
      setStatus({
        severity: "success",
        message: STR.views.season.deletedDone,
        source: "season",
      });
      setSeasonPendingDelete(null);
      setDeleteConfirmInput("");
    } finally {
      setActionSeasonId(null);
    }
  }

  const handleSeasonCommand = useCallback(
    async (command: "import_backup" | "export_backup", row?: SeasonListItem) => {
      setActionSeasonId(row?.seasonId ?? "global");
      try {
        const result = await api.runSeasonCommand(command, row?.seasonId ?? shellData.selectedSeasonId ?? undefined);
        setStatus({
          severity: result.severity,
          message: result.message,
          source: "season",
        });
      } finally {
        setActionSeasonId(null);
      }
    },
    [api, setStatus, shellData.selectedSeasonId],
  );

  const handleExport = useCallback(
    async (seasonId: string, actionId: "export_excel" | "export_pdf") => {
      setActionSeasonId(seasonId);
      try {
        const result =
          actionId === "export_pdf"
            ? await api.runExportAction(seasonId, actionId, { pdfLayoutPreset: "compact" })
            : await api.runExportAction(seasonId, actionId);
        setStatus({
          severity: result.severity,
          message: result.message,
          source: "season",
        });
      } finally {
        setActionSeasonId(null);
      }
    },
    [api, setStatus],
  );

  const handleCreate = useCallback(async () => {
    const nextLabel = newSeasonLabel.trim();
    if (!nextLabel) {
      setStatus({
        severity: "warn",
        message: STR.views.season.enterSeasonName,
        source: "season",
      });
      return;
    }

    setCreating(true);
    try {
      const created = await api.createSeason({ label: nextLabel });
      setNewSeasonLabel("");
      setIsCreateModalOpen(false);
      await refreshAll();
      setStatus({
        severity: "success",
        message: STR.views.season.createdDone(created.label),
        source: "season",
      });
      void navigate("/import");
    } finally {
      setCreating(false);
    }
  }, [api, navigate, newSeasonLabel, setStatus]);

  return (
    <div className="page-stack">
      <section className="surface-card">
        <div className="surface-card__header">
          <div>
            <h2>{STR.views.season.existingSeasonsTitle}</h2>
            <p>{STR.views.season.existingSeasonsDescription}</p>
          </div>
          <div className="surface-card__actions">
            <button
              type="button"
              className="button button--primary"
              disabled={creating}
              onClick={() => {
                setNewSeasonLabel("");
                setIsCreateModalOpen(true);
              }}
            >
              {STR.views.season.createOpenAction}
            </button>
            <button
              type="button"
              className="button"
              disabled={actionSeasonId === "global"}
              onClick={() => void handleSeasonCommand("import_backup")}
            >
              {STR.views.season.importAction}
            </button>
          </div>
        </div>
        <DataTable columns={columns} rows={seasons} emptyMessage={STR.views.season.noSeasons} />
        {loading ? <p className="surface-card__note">{STR.views.season.loading}</p> : null}
      </section>

      {isCreateModalOpen ? (
        <div className="confirm-modal__backdrop" role="presentation">
          <form
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={STR.views.season.createTitle}
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="confirm-modal__header">
              <h2>{STR.views.season.createTitle}</h2>
            </div>
            <div className="confirm-modal__body">
              <label className="field-stack">
                <span>{STR.views.season.createLabel}</span>
                <input
                  autoFocus
                  required
                  type="text"
                  value={newSeasonLabel}
                  placeholder={STR.views.season.createPlaceholder}
                  onChange={(event) => {
                    setNewSeasonLabel(event.target.value);
                  }}
                />
              </label>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                }}
              >
                {STR.confirmModal.cancel}
              </button>
              <button type="submit" className="button button--primary" disabled={creating}>
                {STR.views.season.createAction}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {seasonPendingDelete ? (
        <div className="confirm-modal__backdrop" role="presentation">
          <form
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={STR.views.season.deleteConfirmTitle}
            onSubmit={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
          >
            <div className="confirm-modal__header">
              <h2>{STR.views.season.deleteConfirmTitle}</h2>
            </div>
            <div className="confirm-modal__body">
              <p>{STR.views.season.deleteConfirmTypePrompt(seasonPendingDelete.label)}</p>
              <label className="field-stack">
                <span>{STR.views.season.deleteConfirmInputLabel}</span>
                <input
                  autoFocus
                  type="text"
                  value={deleteConfirmInput}
                  onChange={(event) => {
                    setDeleteConfirmInput(event.target.value);
                  }}
                />
              </label>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setDeleteConfirmInput("");
                  setSeasonPendingDelete(null);
                }}
              >
                {STR.confirmModal.cancel}
              </button>
              <button
                type="submit"
                className="button button--danger"
                disabled={deleteConfirmInput !== seasonPendingDelete.label || actionSeasonId === seasonPendingDelete.seasonId}
              >
                {STR.confirmModal.confirm}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
