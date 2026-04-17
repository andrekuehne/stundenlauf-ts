import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppApi, AppCommandResult, ShellData, StandingsData } from "@/api/contracts/index.ts";
import { StandingsPage } from "@/features/standings/StandingsPage.tsx";

const setSidebarControls = vi.fn();
const setNavigationGuard = vi.fn();
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
  summary: {
    seasonLabel: "Saison 2025",
    totalTeams: 5,
    totalParticipants: 5,
    totalRuns: 6,
    lastUpdatedAt: "2025-04-08T12:34:00Z",
  },
  categories: [
    { key: "half_hour:women", label: "Frauen 1/2", description: "desc", participantCount: 3, importedRuns: 2 },
    { key: "hour:women", label: "Frauen 1", description: "desc", participantCount: 2, importedRuns: 4 },
  ],
  rowsByCategory: {
    "half_hour:women": [
      {
        rank: 1,
        team: "Bea Team",
        teamId: "team-bea",
        yob: 1991,
        club: "SV Musterstadt",
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
        club: "SV Musterstadt",
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
        club: "SV Musterstadt",
        distanceKm: 8,
        points: 16,
        races: 2,
        excluded: false,
      },
    ],
    "hour:women": [
      {
        rank: 1,
        team: "Doro Team",
        teamId: "team-doro",
        yob: 1985,
        club: "SV Anders",
        distanceKm: 14,
        points: 28,
        races: 4,
        excluded: false,
      },
      {
        rank: 2,
        team: "Eva Team",
        teamId: "team-eva",
        yob: 1986,
        club: "SV Anders",
        distanceKm: 12,
        points: 24,
        races: 4,
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
  useAppShellContext: () => ({ shellData, setSidebarControls, setNavigationGuard }),
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
  setNavigationGuard.mockReset();
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
    applyImportReviewCorrection: vi.fn(async () => {
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

  it("renders only a quiet meta line (season + last-updated), without an Auswertung eyebrow or category headline", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    expect(screen.queryByText(/^Auswertung$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "1/2 h - Frauen" })).not.toBeInTheDocument();

    const meta = screen.getByTestId("standings-meta");
    expect(meta.textContent).toContain("Saison 2025");
    expect(meta.textContent).toContain("zuletzt aktualisiert");
  });

  it("renders three KPI cards with team count, races progress and excluded count", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    const teamsCard = screen.getByTestId("standings-kpi-teams");
    expect(within(teamsCard).getByText("Teams in Wertung")).toBeInTheDocument();
    expect(within(teamsCard).getByText("2")).toBeInTheDocument();

    const racesCard = screen.getByTestId("standings-kpi-races");
    expect(within(racesCard).getByText("Läufe importiert")).toBeInTheDocument();
    expect(within(racesCard).getByText("2 / 5")).toBeInTheDocument();

    const excludedCard = screen.getByTestId("standings-kpi-excluded");
    expect(within(excludedCard).getByText("Außer Wertung")).toBeInTheDocument();
    expect(within(excludedCard).getByText("1")).toBeInTheDocument();
  });

  it("renders export buttons in main content and uses compact PDF preset", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getAllByText(/Anna Team/).length).toBeGreaterThan(0); });

    fireEvent.click(screen.getByRole("button", { name: "PDF exportieren" }));

    await waitFor(() =>
      { expect(apiMock.runExportAction).toHaveBeenCalledWith("season-1", "export_pdf", {
        pdfLayoutPreset: "compact",
      }); },
    );
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "standings" }));
  });

  it("runs excel export from main content export controls", async () => {
    selectedCategoryKey = "half_hour:women";
    const exportActions: StandingsData["exportActions"] = [
      { id: "export_pdf", label: "PDF", description: "PDF export", availability: "ready" },
      { id: "export_excel", label: "Excel", description: "Excel export", availability: "ready" },
    ];
    apiMock = {
      ...apiMock,
      getStandings: vi.fn(async () => ({
        ...standingsData,
        exportActions,
      })),
    };
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getAllByText(/Anna Team/).length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "Excel exportieren" }));

    await waitFor(() =>
      { expect(apiMock.runExportAction).toHaveBeenCalledWith("season-1", "export_excel"); },
    );
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "standings" }));
  });

  it("does not render the exclusion checkbox column anymore", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    expect(screen.queryByRole("checkbox", { name: /Anna Team/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "a.W." })).not.toBeInTheDocument();
  });

  it("uses the same column count for every category in the season (season-max race columns)", async () => {
    selectedCategoryKey = "half_hour:women";
    const { rerender } = render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    const halfHourCols = Array.from(screen.getByRole("table").querySelectorAll("col"));
    selectedCategoryKey = "hour:women";
    rerender(<StandingsPage />);
    await waitFor(() => { expect(screen.getByText(/Doro Team/)).toBeInTheDocument(); });
    const hourCols = Array.from(screen.getByRole("table").querySelectorAll("col"));

    expect(halfHourCols.length).toBe(hourCols.length);
    expect(halfHourCols.length).toBe(3 + 2 * 5 + 2);
  });

  it("falls back to a 5-race floor when no category has imported runs yet", async () => {
    apiMock = {
      ...apiMock,
      getStandings: vi.fn(async () => ({
        ...standingsData,
        categories: [
          { key: "half_hour:women", label: "Frauen 1/2", description: "desc", participantCount: 0, importedRuns: 0 },
        ],
        rowsByCategory: { "half_hour:women": [] },
      })),
    };
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    const cols = Array.from(screen.getByRole("table").querySelectorAll("col"));
    expect(cols.length).toBe(3 + 2 * 5 + 2);
  });

  it("renders the standings detail table with two header rows and stacked team name + YOB", async () => {
    selectedCategoryKey = "hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByText(/Doro Team/)).toBeInTheDocument(); });

    const table = screen.getByRole("table");
    const thead = table.querySelector("thead");
    const headerRows = thead instanceof HTMLTableSectionElement ? Array.from(thead.rows) : [];
    expect(headerRows).toHaveLength(2);
    expect(headerRows[0]).toHaveClass("ui-table--standings-detail__header-row--primary");
    expect(headerRows[1]).toHaveClass("ui-table--standings-detail__header-row--units");
    expect(table.querySelector(".ui-table--standings-detail__header-row--secondary")).toBeNull();

    expect(within(table).getByRole("columnheader", { name: "1. Lauf" })).toHaveAttribute("colspan", "2");
    expect(within(table).getByRole("columnheader", { name: "Gesamt" })).toHaveAttribute("colspan", "2");
    expect(within(table).getAllByRole("columnheader", { name: "km" })).toHaveLength(6);
    expect(within(table).getAllByRole("columnheader", { name: "Pkt" })).toHaveLength(6);

    const doroRow = within(table).getByText("Doro Team").closest("tr") as HTMLTableRowElement;
    expect(within(doroRow).getByText("Doro Team")).toBeInTheDocument();
    expect(within(doroRow).getByText("(1985)")).toBeInTheDocument();
    expect(within(doroRow).queryByText("Doro Team (1985)")).not.toBeInTheDocument();
  });

  it("places excluded rows at the bottom of the list with rank dash and muted styling", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByText(/Anna Team/)).toBeInTheDocument(); });

    const table = screen.getByRole("table");
    const tbody = table.querySelector("tbody");
    const bodyRows = tbody instanceof HTMLTableSectionElement ? Array.from(tbody.rows) : [];
    const teamOrder = bodyRows.map((row) => within(row).getByTestId("standings-team-name").textContent?.trim());
    expect(teamOrder).toEqual(["Bea Team", "Clara Team", "Anna Team"]);

    const annaRow = bodyRows[2]!;
    expect(annaRow).toHaveClass("is-excluded");
    expect(within(annaRow).getAllByRole("cell")[0]?.textContent?.trim()).toBe("—");
  });

  it("renders category buttons in two rows with row labels, plus an export cluster on the right", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    expect(screen.getByText("Halbstunde")).toBeInTheDocument();
    expect(screen.getByText("Stunde")).toBeInTheDocument();

    const categoryButtons = screen.getAllByRole("button", { name: /Frauen|Männer|Paare/ });
    expect(categoryButtons).toHaveLength(10);

    const pdfButton = screen.getByRole("button", { name: "PDF exportieren" });
    expect(pdfButton).toBeInTheDocument();
    expect(pdfButton).toHaveClass("standings-overview__export-button");
    expect(pdfButton).toHaveClass("standings-overview__export-button--pdf");
    expect(screen.queryByRole("heading", { name: "Exporte" })).not.toBeInTheDocument();
    expect(screen.queryByText("Aktuelle Wertung")).not.toBeInTheDocument();
    expect(screen.queryByText("Detailergebnisse")).not.toBeInTheDocument();
  });

  it("renders the export cluster with a divider class so it can be visually separated from the category chips", async () => {
    selectedCategoryKey = "half_hour:women";
    apiMock = {
      ...apiMock,
      getStandings: vi.fn(async () => ({
        ...standingsData,
        exportActions: [
          { id: "export_pdf", label: "PDF", description: "PDF export", availability: "ready" },
          { id: "export_excel", label: "Excel", description: "Excel export", availability: "ready" },
        ] as StandingsData["exportActions"],
      })),
    };
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    const pdfButton = screen.getByRole("button", { name: "PDF exportieren" });
    const excelButton = screen.getByRole("button", { name: "Excel exportieren" });

    expect(pdfButton).toHaveClass("standings-overview__export-button--pdf");
    expect(excelButton).toHaveClass("standings-overview__export-button--excel");
    expect(pdfButton.className).not.toContain("standings-overview__export-button--excel");
    expect(excelButton.className).not.toContain("standings-overview__export-button--pdf");

    const cluster = pdfButton.closest(".standings-overview__exports");
    expect(cluster).not.toBeNull();
    expect(cluster).toHaveClass("standings-overview__exports--divided");
    expect(cluster?.contains(excelButton)).toBe(true);
  });
});
