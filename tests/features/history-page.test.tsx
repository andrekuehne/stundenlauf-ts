import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppApi, AppCommandResult, HistoryData, ShellData, StandingsData } from "@/api/contracts/index.ts";
import { HistoryPage } from "@/features/history/HistoryPage.tsx";

const setSidebarControls = vi.fn();
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
      type: "import.finalized",
      scope: "race",
      summary: "Import",
      isEffectiveChange: true,
      raceEventId: "race-1",
      importBatchId: "batch-1",
      groupKey: "batch:batch-1",
      actionability: {
        canPreviewRollbackAtomic: true,
        canPreviewRollbackGroup: true,
        canHardResetToHere: true,
      },
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
  useAppShellContext: () => ({ shellData, setSidebarControls }),
}));
vi.mock("@/stores/status.ts", () => ({
  useStatusStore: (selector: (s: { setStatus: typeof setStatus }) => unknown) => selector({ setStatus }),
}));

beforeEach(() => {
  setSidebarControls.mockReset();
  setStatus.mockReset();
  apiMock = {
    getShellData: vi.fn(async () => shellData),
    listSeasons: vi.fn(async () => []),
    createSeason: vi.fn(async () => {
      throw new Error("not used");
    }),
    openSeason: vi.fn(async () => {}),
    deleteSeason: vi.fn(async () => {}),
    runSeasonCommand: vi.fn(async () => buildCommandResult("ok")),
    getStandings: vi.fn(async () => emptyStandings),
    runExportAction: vi.fn(async () => buildCommandResult("ok")),
    createImportDraft: vi.fn(async () => {
      throw new Error("not used");
    }),
    getImportDraft: vi.fn(async () => {
      throw new Error("not used");
    }),
    setImportReviewDecision: vi.fn(async () => {
      throw new Error("not used");
    }),
    finalizeImportDraft: vi.fn(async () => buildCommandResult("ok")),
    getHistory: vi.fn(async () => historyData),
    previewHistoryState: vi.fn(async () => ({ anchorSeq: 10, isFrozen: true, derivedStateLabel: "Vorschau", blockedReason: "eingefroren" })),
    rollbackHistory: vi.fn(async () => buildCommandResult("Rollback ok")),
    hardResetHistoryToSeq: vi.fn(async () => buildCommandResult("Reset ok")),
  };
});

describe("HistoryPage", () => {
  it("renders race context and audit summary in the main view instead of the shell sidebar", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Lauf 1")).toBeInTheDocument());
    expect(screen.getByText("Audit-Protokoll")).toBeInTheDocument();
    expect(setSidebarControls).not.toHaveBeenCalled();
  });

  it("previews a seq and shows preview controls", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Import")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button")[0] as HTMLButtonElement);
    await waitFor(() => { expect(apiMock.previewHistoryState).toHaveBeenCalledWith("season-1", { anchorSeq: 10 }); });
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ severity: "info", source: "history" }));
  });

  it("confirms rollback command", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Import")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button")[1] as HTMLButtonElement);
    fireEvent.click(screen.getByRole("button", { name: /Bestätigen/i }));
    await waitFor(() => { expect(apiMock.rollbackHistory).toHaveBeenCalledWith("season-1", expect.objectContaining({ mode: "atomic" })); });
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "history" }));
  });

  it("confirms hard reset command", async () => {
    render(<HistoryPage />);
    await waitFor(() => expect(screen.getByText("Import")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button")[3] as HTMLButtonElement);
    fireEvent.click(screen.getByRole("button", { name: /Bestätigen/i }));
    await waitFor(() => { expect(apiMock.hardResetHistoryToSeq).toHaveBeenCalledWith("season-1", expect.objectContaining({ anchorSeq: 10 })); });
  });
});
