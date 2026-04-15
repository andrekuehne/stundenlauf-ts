import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppApi, AppCommandResult, ShellData, StandingsData } from "@/api/contracts/index.ts";
import { StandingsPage } from "@/features/standings/StandingsPage.tsx";

const setSidebarControls = vi.fn();
const setStatus = vi.fn();
const selectCategory = vi.fn();
let selectedCategoryKey: string | null = null;

let shellData: ShellData = {
  selectedSeasonId: "season-1",
  selectedSeasonLabel: "Saison 1",
  unresolvedReviews: 0,
  availableSeasons: [{ seasonId: "season-1", label: "Saison 1" }],
};

const standingsData: StandingsData = {
  seasonId: "season-1",
  summary: { seasonLabel: "Saison 1", totalTeams: 1, totalParticipants: 1, totalRuns: 2, lastUpdatedAt: new Date().toISOString() },
  categories: [
    { key: "half_hour:women", label: "Frauen 1/2", description: "desc", participantCount: 1, importedRuns: 2 },
  ],
  rowsByCategory: {
    "half_hour:women": [{ rank: 1, team: "Anna Team", yob: 1990, club: "SV", distanceKm: 10, points: 20, races: 2 }],
  },
  importedRuns: [],
  exportActions: [{ id: "export_pdf", label: "PDF", description: "PDF export", availability: "ready" }],
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
vi.mock("@/stores/standings.ts", () => ({
  useStandingsStore: (selector: (s: { selectedCategoryKey: string | null; selectCategory: typeof selectCategory }) => unknown) =>
    selector({ selectedCategoryKey, selectCategory }),
}));

beforeEach(() => {
  shellData = {
    selectedSeasonId: "season-1",
    selectedSeasonLabel: "Saison 1",
    unresolvedReviews: 0,
    availableSeasons: [{ seasonId: "season-1", label: "Saison 1" }],
  };
  selectedCategoryKey = null;
  setSidebarControls.mockReset();
  setStatus.mockReset();
  selectCategory.mockReset();
  apiMock = {
    getShellData: vi.fn(async () => shellData),
    listSeasons: vi.fn(async () => []),
    createSeason: vi.fn(async () => {
      throw new Error("not used");
    }),
    openSeason: vi.fn(async () => {}),
    deleteSeason: vi.fn(async () => {}),
    runSeasonCommand: vi.fn(async () => buildCommandResult("ok")),
    getStandings: vi.fn(async () => standingsData),
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
    getHistory: vi.fn(async () => {
      throw new Error("not used");
    }),
    previewHistoryState: vi.fn(async () => {
      throw new Error("not used");
    }),
    rollbackHistory: vi.fn(async () => buildCommandResult("ok")),
    hardResetHistoryToSeq: vi.fn(async () => buildCommandResult("ok")),
  };
});

describe("StandingsPage", () => {
  it("shows empty state when no season selected", () => {
    shellData = { ...shellData, selectedSeasonId: null, selectedSeasonLabel: null };
    render(<StandingsPage />);
    expect(screen.getByText(/Bitte zuerst eine Saison auswählen/i)).toBeInTheDocument();
  });

  it("selects first category when current selection is missing", async () => {
    render(<StandingsPage />);
    await waitFor(() => { expect(apiMock.getStandings).toHaveBeenCalledWith("season-1"); });
    await waitFor(() => { expect(selectCategory).toHaveBeenCalledWith("half_hour:women"); });
  });

  it("runs PDF export with compact preset by default and emits status", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getAllByText("Anna Team").length).toBeGreaterThan(0); });

    await waitFor(() => { expect(setSidebarControls).toHaveBeenCalled(); });
    const latestSidebar = setSidebarControls.mock.calls.at(-1)?.[0];
    render(<>{latestSidebar}</>);
    const exportButton = screen.getByRole("button", { name: /PDF/i });
    fireEvent.click(exportButton);

    await waitFor(() =>
      { expect(apiMock.runExportAction).toHaveBeenCalledWith("season-1", "export_pdf", {
        pdfLayoutPreset: "compact",
      }); },
    );
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "standings" }));
  });

  it("runs PDF export with normal preset when selected", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getAllByText("Anna Team").length).toBeGreaterThan(0); });

    await waitFor(() => { expect(setSidebarControls).toHaveBeenCalled(); });
    const firstSidebar = setSidebarControls.mock.calls.at(-1)?.[0];
    render(<>{firstSidebar}</>);

    fireEvent.change(screen.getByLabelText("PDF-Stil"), { target: { value: "default" } });

    await waitFor(() => { expect(setSidebarControls.mock.calls.length).toBeGreaterThan(1); });
    const updatedSidebar = setSidebarControls.mock.calls.at(-1)?.[0];
    render(<>{updatedSidebar}</>);
    fireEvent.click(screen.getAllByRole("button", { name: /PDF/i }).at(-1)!);

    await waitFor(() =>
      { expect(apiMock.runExportAction).toHaveBeenCalledWith("season-1", "export_pdf", {
        pdfLayoutPreset: "default",
      }); },
    );
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "standings" }));
  });
});
