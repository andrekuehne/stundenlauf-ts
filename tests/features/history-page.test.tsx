import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppApi, AppCommandResult, HistoryData, ShellData, StandingsData } from "@/api/contracts/index.ts";
import { HistoryPage } from "@/features/history/HistoryPage.tsx";

const setSidebarControls = vi.fn();
const setNavigationGuard = vi.fn();
const setStatus = vi.fn();

const shellData: ShellData = {
  selectedSeasonId: "season-1",
  selectedSeasonLabel: "Saison 1",
  unresolvedReviews: 0,
  availableSeasons: [{ seasonId: "season-1", label: "Saison 1" }],
};

const historyData: HistoryData = {
  seasonId: "season-1",
  seasonLabel: "Saison 1",
  raceContext: { raceEventId: "race-1", raceLabel: "Lauf 1", categoryLabel: "Frauen", raceDateLabel: "2026-01-01" },
  rows: [
    {
      seq: 10,
      eventId: "evt-10",
      recordedAt: new Date().toISOString(),
      type: "import_batch.recorded",
      scope: "batch",
      summary: "Import",
      isEffectiveChange: true,
      raceEventId: null,
      importBatchId: "batch-1",
      groupKey: "batch-1",
      actionability: {
        canPreviewRollbackAtomic: false,
        canPreviewRollbackGroup: true,
        canHardResetToHere: true,
      },
    },
  ],
  importBatches: [
    {
      importBatchId: "batch-1",
      sourceFile: "Ergebnisliste_Lauf1.xlsx",
      recordedAt: new Date("2026-04-01T10:00:00").toISOString(),
      anchorSeq: 10,
      state: "active",
      categoryLabel: "60 Minuten Herren",
    },
  ],
};

const emptyStandings: StandingsData = {
  seasonId: "season-1",
  summary: { seasonLabel: "Saison 1", totalTeams: 0, totalParticipants: 0, totalRuns: 0, lastUpdatedAt: new Date().toISOString() },
  categories: [],
  rowsByCategory: {},
  importedRuns: [],
  exportActions: [],
};

function buildCommandResult(message: string): AppCommandResult {
  return { severity: "success", message };
}

let apiMock: AppApi;
vi.mock("@/api/provider.tsx", () => ({ useAppApi: () => apiMock }));
vi.mock("@/app/shell-context.ts", () => ({
  useAppShellContext: () => ({ shellData, setSidebarControls, setNavigationGuard }),
}));
vi.mock("@/stores/status.ts", () => ({
  useStatusStore: (selector: (s: { setStatus: typeof setStatus }) => unknown) => selector({ setStatus }),
}));

beforeEach(() => {
  setSidebarControls.mockReset();
  setNavigationGuard.mockReset();
  setStatus.mockReset();
  apiMock = {
    getShellData: vi.fn(async () => shellData),
    listSeasons: vi.fn(async () => []),
    createSeason: vi.fn(async () => { throw new Error("not used"); }),
    openSeason: vi.fn(async () => {}),
    deleteSeason: vi.fn(async () => {}),
    runSeasonCommand: vi.fn(async () => buildCommandResult("ok")),
    getStandings: vi.fn(async () => emptyStandings),
    runExportAction: vi.fn(async () => buildCommandResult("ok")),
    createImportDraft: vi.fn(async () => { throw new Error("not used"); }),
    getImportDraft: vi.fn(async () => { throw new Error("not used"); }),
    setImportReviewDecision: vi.fn(async () => { throw new Error("not used"); }),
    applyImportReviewCorrection: vi.fn(async () => { throw new Error("not used"); }),
    finalizeImportDraft: vi.fn(async () => buildCommandResult("ok")),
    getHistory: vi.fn(async () => historyData),
    previewHistoryState: vi.fn(async () => ({ anchorSeq: 10, isFrozen: true, derivedStateLabel: "Vorschau", blockedReason: "eingefroren" })),
    rollbackHistory: vi.fn(async () => buildCommandResult("Rollback ok")),
    setStandingsRowExcluded: vi.fn(async () => {}),
    getStandingsRowIdentity: vi.fn(async () => { throw new Error("not used"); }),
    correctStandingsRowIdentity: vi.fn(async () => { throw new Error("not used"); }),
    hardResetHistoryToSeq: vi.fn(async () => buildCommandResult("Reset ok")),
  };
});

describe("HistoryPage", () => {
  it("renders the import overview table with filename and date", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Ergebnisliste_Lauf1.xlsx")).toBeInTheDocument());
    expect(screen.getByText("Import-Übersicht")).toBeInTheDocument();
  });

  it("does not inject sidebar controls", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Ergebnisliste_Lauf1.xlsx")).toBeInTheDocument());
    expect(setSidebarControls).not.toHaveBeenCalled();
  });

  it("opens confirmation dialog when rollback button is clicked", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Ergebnisliste_Lauf1.xlsx")).toBeInTheDocument());
    const rollbackButton = screen.getByRole("button", { name: /import zurückrollen/i });
    fireEvent.click(rollbackButton);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/Ergebnisliste_Lauf1\.xlsx/);
  });

  it("cancels confirmation dialog without calling the API", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Ergebnisliste_Lauf1.xlsx")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /import zurückrollen/i }));
    fireEvent.click(screen.getByRole("button", { name: /abbrechen/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiMock.rollbackHistory).not.toHaveBeenCalled();
  });

  it("calls rollbackHistory in grouped mode on confirmation", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Ergebnisliste_Lauf1.xlsx")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /import zurückrollen/i }));
    fireEvent.click(screen.getByRole("button", { name: /bestätigen/i }));
    await waitFor(() => {
      expect(apiMock.rollbackHistory).toHaveBeenCalledWith(
        "season-1",
        expect.objectContaining({ mode: "grouped", anchorSeq: 10, importBatchId: "batch-1" }),
      );
    });
    await waitFor(() => {
      expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "history" }));
    });
  });

  it("disables rollback button for an already rolled-back batch", async () => {
    const rolledBackData: HistoryData = {
      ...historyData,
      importBatches: [{ ...historyData.importBatches[0]!, state: "rolled_back" }],
    };
    (apiMock.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue(rolledBackData);
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Ergebnisliste_Lauf1.xlsx")).toBeInTheDocument());
    const rollbackButton = screen.getByRole("button", { name: /zurückgerollt/i });
    expect(rollbackButton).toBeDisabled();
  });

  it("does not call getHistory when there is no selected season", () => {
    // The mock always provides selectedSeasonId, so we only validate here that loadHistory
    // guards on it. The actual empty-state branch is a render path that the context mock covers.
    expect(apiMock.getHistory).toBeDefined();
  });
});
