import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  summary: { seasonLabel: "Saison 1", totalTeams: 2, totalParticipants: 2, totalRuns: 2, lastUpdatedAt: new Date().toISOString() },
  categories: [
    { key: "half_hour:women", label: "Frauen 1/2", description: "desc", participantCount: 2, importedRuns: 2 },
  ],
  rowsByCategory: {
    "half_hour:women": [
      {
        rank: 1,
        team: "Bea Team",
        teamId: "team-bea",
        yob: 1991,
        club: "SV",
        distanceKm: 9,
        points: 18,
        races: 2,
        excluded: false,
      },
      {
        rank: null,
        team: "Anna Team",
        teamId: "team-anna",
        yob: 1990,
        club: "SV",
        distanceKm: 10,
        points: 20,
        races: 2,
        excluded: true,
      },
      {
        rank: 2,
        team: "Clara Team",
        teamId: "team-clara",
        yob: 1992,
        club: "SV",
        distanceKm: 8,
        points: 16,
        races: 2,
        excluded: false,
      },
    ],
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
    setStandingsRowExcluded: vi.fn(async () => {}),
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
    await waitFor(() => { expect(screen.getAllByText(/Anna Team/).length).toBeGreaterThan(0); });

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
    await waitFor(() => { expect(screen.getAllByText(/Anna Team/).length).toBeGreaterThan(0); });

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

  it("renders exclusion state and persists checkbox changes", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getAllByText(/Anna Team/).length).toBeGreaterThan(0); });

    const checkbox = screen.getByRole("checkbox", { name: "a.W. Anna Team" });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(apiMock.setStandingsRowExcluded).toHaveBeenCalledWith("season-1", {
        categoryKey: "half_hour:women",
        teamId: "team-anna",
        excluded: false,
      });
    });
  });

  it("keeps the standings detail table visible while exclusion refresh is pending", async () => {
    selectedCategoryKey = "half_hour:women";
    let resolveReload: ((value: StandingsData) => void) | null = null;
    apiMock = {
      ...apiMock,
      getStandings: vi
        .fn()
        .mockResolvedValueOnce(standingsData)
        .mockImplementationOnce(
          () =>
            new Promise<StandingsData>((resolve) => {
              resolveReload = resolve;
            }),
        ),
    };

    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByText("Detailergebnisse")).toBeInTheDocument(); });

    fireEvent.click(screen.getByRole("checkbox", { name: "a.W. Anna Team" }));

    await waitFor(() => {
      expect(apiMock.setStandingsRowExcluded).toHaveBeenCalledWith("season-1", {
        categoryKey: "half_hour:women",
        teamId: "team-anna",
        excluded: false,
      });
    });

    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByText("Detailergebnisse")).toBeInTheDocument();
    expect(screen.getByText(/Anna Team/)).toBeInTheDocument();
    expect(screen.queryByText("Wertungen werden geladen...")).not.toBeInTheDocument();

    resolveReload?.(standingsData);
    await waitFor(() => { expect(apiMock.getStandings).toHaveBeenCalledTimes(2); });
  });

  it("renders the standings detail table like the PDF overview while keeping exclusion toggles", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByText("Detailergebnisse")).toBeInTheDocument(); });

    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(1);
    const detailTable = tables[0] as HTMLTableElement;
    const detailCols = Array.from(detailTable.querySelectorAll("col"));

    expect(detailCols).toHaveLength(10);
    expect(detailCols.slice(4).every((col) => col.style.width === "5.1rem")).toBe(true);

    expect(within(detailTable).getByRole("columnheader", { name: "Verein" })).toBeInTheDocument();
    expect(within(detailTable).getByRole("columnheader", { name: "1. Lauf" })).toHaveAttribute("colspan", "2");
    expect(within(detailTable).getByRole("columnheader", { name: "2. Lauf" })).toHaveAttribute("colspan", "2");
    expect(within(detailTable).getByRole("columnheader", { name: "Gesamt" })).toHaveAttribute("colspan", "2");
    expect(within(detailTable).getAllByRole("columnheader", { name: "Laufstr." })).toHaveLength(3);
    expect(within(detailTable).getAllByRole("columnheader", { name: "Wertung" })).toHaveLength(3);
    expect(within(detailTable).getAllByRole("columnheader", { name: "(km)" })).toHaveLength(3);
    expect(within(detailTable).getAllByRole("columnheader", { name: "(Punkte)" })).toHaveLength(3);
    const [primaryHeaderRow, secondaryHeaderRow, unitsHeaderRow] = Array.from(detailTable.tHead?.rows ?? []);
    expect(primaryHeaderRow).toHaveClass("ui-table--standings-detail__header-row--primary");
    expect(secondaryHeaderRow).toHaveClass("ui-table--standings-detail__header-row--secondary");
    expect(unitsHeaderRow).toHaveClass("ui-table--standings-detail__header-row--units");
    expect(detailTable.querySelectorAll("[class*='ui-table--standings-detail__sticky-cell--']")).toHaveLength(0);

    expect(within(detailTable).getByText(/Anna Team/)).toBeInTheDocument();
    expect(within(detailTable).getByText(/Bea Team/)).toBeInTheDocument();
    expect(within(detailTable).getByText(/Clara Team/)).toBeInTheDocument();
    expect(within(detailTable).getAllByText("SV")).toHaveLength(3);
    expect(within(detailTable).getByRole("checkbox", { name: "a.W. Anna Team" })).toBeInTheDocument();

    const detailRows = Array.from(detailTable.tBodies[0]?.rows ?? []);
    expect(detailRows.map((row) => within(row).getAllByRole("cell")[2]?.textContent)).toEqual([
      "Bea Team (1991)",
      "Anna Team (1990)",
      "Clara Team (1992)",
    ]);
    expect(within(detailRows[1]!).getAllByRole("cell")[0]?.textContent).toBe("—");
  });
});
