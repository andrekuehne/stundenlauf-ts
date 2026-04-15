import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppApi, SeasonListItem, ShellData, StandingsData } from "@/api/contracts/index.ts";
import { SeasonPage } from "@/features/season/SeasonPage.tsx";

const setSidebarControls = vi.fn();
const refreshShellData = vi.fn(async () => {});
const setStatus = vi.fn();

const shellData: ShellData = {
  selectedSeasonId: "season-1",
  selectedSeasonLabel: "Saison 1",
  unresolvedReviews: 0,
  availableSeasons: [{ seasonId: "season-1", label: "Saison 1" }],
};

const seasons: SeasonListItem[] = [
  {
    seasonId: "season-1",
    label: "Saison 1",
    isActive: true,
    importedEvents: 2,
    lastModifiedAt: new Date().toISOString(),
  },
  {
    seasonId: "season-2",
    label: "Saison 2",
    isActive: false,
    importedEvents: 0,
    lastModifiedAt: new Date().toISOString(),
  },
];

const emptyStandings: StandingsData = {
  seasonId: "season-1",
  summary: { seasonLabel: "Saison 1", totalTeams: 0, totalParticipants: 0, totalRuns: 0, lastUpdatedAt: new Date().toISOString() },
  categories: [],
  rowsByCategory: {},
  importedRuns: [],
  exportActions: [],
};

let apiMock: AppApi;

vi.mock("@/api/provider.tsx", () => ({ useAppApi: () => apiMock }));
vi.mock("@/app/shell-context.ts", () => ({
  useAppShellContext: () => ({ shellData, refreshShellData, setSidebarControls }),
}));
vi.mock("@/stores/status.ts", () => ({
  useStatusStore: (selector: (s: { setStatus: typeof setStatus }) => unknown) => selector({ setStatus }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  setStatus.mockReset();
  setSidebarControls.mockReset();
  refreshShellData.mockClear();
  apiMock = {
    getShellData: vi.fn(async () => shellData),
    listSeasons: vi.fn(async () => seasons),
    createSeason: vi.fn(async ({ label }) => ({ ...seasons[0], seasonId: "season-x", label })),
    openSeason: vi.fn(async () => {}),
    deleteSeason: vi.fn(async () => {}),
    runSeasonCommand: vi.fn(async () => ({ severity: "success", message: "ok" })),
    getStandings: vi.fn(async () => emptyStandings),
    runExportAction: vi.fn(async () => ({ severity: "success", message: "ok" })),
    createImportDraft: vi.fn(async () => {
      throw new Error("not used");
    }),
    getImportDraft: vi.fn(async () => {
      throw new Error("not used");
    }),
    setImportReviewDecision: vi.fn(async () => {
      throw new Error("not used");
    }),
    finalizeImportDraft: vi.fn(async () => ({ severity: "success", message: "ok" })),
    getHistory: vi.fn(async () => {
      throw new Error("not used");
    }),
    previewHistoryState: vi.fn(async () => {
      throw new Error("not used");
    }),
    rollbackHistory: vi.fn(async () => ({ severity: "success", message: "ok" })),
    hardResetHistoryToSeq: vi.fn(async () => ({ severity: "success", message: "ok" })),
  };
});

describe("SeasonPage", () => {
  function latestNonNullSidebar() {
    return [...setSidebarControls.mock.calls].reverse().map((call) => call[0]).find(Boolean);
  }

  it("provides sidebar controls through shell context", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(setSidebarControls).toHaveBeenCalled());
    const latestSidebar = latestNonNullSidebar();
    render(<>{latestSidebar}</>);
    expect(screen.getByText("Aktive Saison")).toBeInTheDocument();
    expect(screen.getAllByText("Saison 1").length).toBeGreaterThan(0);
  });

  it("opens another season and refreshes shell", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 2")).toBeInTheDocument());

    const openButtons = screen.getAllByRole("button", { name: /Öffnen/i });
    fireEvent.click(openButtons[1] as HTMLButtonElement);
    await waitFor(() => expect(apiMock.openSeason).toHaveBeenCalledWith("season-2"));
    expect(refreshShellData).toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "season", severity: "info" }));
  });

  it("deletes a season after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 2")).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole("button", { name: /Löschen/i });
    fireEvent.click(deleteButtons[1] as HTMLButtonElement);

    await waitFor(() => expect(apiMock.deleteSeason).toHaveBeenCalledWith("season-2"));
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", source: "season" }));
  });
});
