import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppApi, AppCommandResult, ShellData, StandingsData, StandingsRowIdentity } from "@/api/contracts/index.ts";
import { CorrectionsPage } from "@/features/corrections/CorrectionsPage.tsx";

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
  summary: {
    seasonLabel: "Saison 2025",
    totalTeams: 4,
    totalParticipants: 5,
    totalRuns: 2,
    lastUpdatedAt: "2025-04-08T12:34:00Z",
  },
  categories: [
    { key: "half_hour:women", label: "Frauen 1/2", description: "desc", participantCount: 2, importedRuns: 2 },
    { key: "hour:couples_mixed", label: "Paare Mix 1h", description: "desc", participantCount: 1, importedRuns: 2 },
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
        raceCells: [
          { distanceKm: 4.5, points: 9, countsTowardTotal: true },
          { distanceKm: 4.5, points: 9, countsTowardTotal: true },
          null, null, null,
        ],
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
        raceCells: [
          { distanceKm: 5.0, points: 10, countsTowardTotal: true },
          { distanceKm: 5.0, points: 10, countsTowardTotal: true },
          null, null, null,
        ],
        excluded: true,
      },
    ],
    "hour:couples_mixed": [
      {
        rank: 1,
        team: "Maria + Josef",
        teamId: "team-couple",
        yobPair: "1988 / 1985",
        club: "SV Paar",
        distanceKm: 14,
        points: 28,
        races: 2,
        raceCells: [
          { distanceKm: 7.0, points: 14, countsTowardTotal: true },
          { distanceKm: 7.0, points: 14, countsTowardTotal: true },
          null, null, null,
        ],
        excluded: false,
      },
    ],
  },
  importedRuns: [],
  exportActions: [],
};

const soloIdentity: StandingsRowIdentity = {
  teamId: "team-bea",
  teamKind: "solo",
  members: [{ personId: "person-bea", name: "Bea Team", yob: 1991, club: "SV Musterstadt" }],
};

const coupleIdentity: StandingsRowIdentity = {
  teamId: "team-couple",
  teamKind: "couple",
  members: [
    { personId: "person-maria", name: "Maria", yob: 1988, club: "SV Paar" },
    { personId: "person-josef", name: "Josef", yob: 1985, club: "SV Paar" },
  ],
};

function buildCommandResult(message = "ok"): AppCommandResult {
  return { severity: "success", message };
}

let apiMock: AppApi;

vi.mock("@/api/provider.tsx", () => ({ useAppApi: () => apiMock }));
vi.mock("@/app/shell-context.ts", () => ({
  useAppShellContext: () => ({ shellData, setSidebarControls }),
}));
vi.mock("@/stores/status.ts", () => ({
  useStatusStore: (selector: (s: { setStatus: typeof setStatus }) => unknown) =>
    selector({ setStatus }),
}));
vi.mock("@/stores/standings.ts", () => ({
  useStandingsStore: (
    selector: (s: { selectedCategoryKey: string | null; selectCategory: typeof selectCategory }) => unknown,
  ) => selector({ selectedCategoryKey, selectCategory }),
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
    createSeason: vi.fn(async () => { throw new Error("not used"); }),
    openSeason: vi.fn(async () => {}),
    deleteSeason: vi.fn(async () => {}),
    runSeasonCommand: vi.fn(async () => buildCommandResult()),
    getStandings: vi.fn(async () => standingsData),
    runExportAction: vi.fn(async () => buildCommandResult()),
    setStandingsRowExcluded: vi.fn(async () => {}),
    getStandingsRowIdentity: vi.fn(async () => soloIdentity),
    correctStandingsRowIdentity: vi.fn(async () => buildCommandResult("Teilnehmerdaten gespeichert.")),
    createImportDraft: vi.fn(async () => { throw new Error("not used"); }),
    getImportDraft: vi.fn(async () => { throw new Error("not used"); }),
    setImportReviewDecision: vi.fn(async () => { throw new Error("not used"); }),
    applyImportReviewCorrection: vi.fn(async () => { throw new Error("not used"); }),
    finalizeImportDraft: vi.fn(async () => buildCommandResult()),
    getHistory: vi.fn(async () => { throw new Error("not used"); }),
    previewHistoryState: vi.fn(async () => { throw new Error("not used"); }),
    rollbackHistory: vi.fn(async () => buildCommandResult()),
    hardResetHistoryToSeq: vi.fn(async () => buildCommandResult()),
  };
});

describe("CorrectionsPage", () => {
  it("shows empty state when no season is selected", () => {
    shellData = { ...shellData, selectedSeasonId: null, selectedSeasonLabel: null };
    render(<CorrectionsPage />);
    expect(screen.getByText(/Bitte zuerst eine Saison auswählen/i)).toBeInTheDocument();
  });

  it("shows a loading state before data arrives", async () => {
    let resolveStandings!: (data: StandingsData) => void;
    apiMock = {
      ...apiMock,
      getStandings: vi.fn(
        () => new Promise<StandingsData>((resolve) => { resolveStandings = resolve; }),
      ),
    };
    render(<CorrectionsPage />);
    expect(screen.getByText(/Korrekturen werden geladen/i)).toBeInTheDocument();
    resolveStandings(standingsData);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });
  });

  it("renders the corrections overview without an outer surface-card panel", async () => {
    selectedCategoryKey = "half_hour:women";
    const { container } = render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });
    const overview = container.querySelector(".standings-overview");
    expect(overview).not.toBeNull();
    expect(overview!.classList.contains("surface-card")).toBe(false);
  });

  it("renders guidance and KPI badges on corrections page without meta row or export buttons", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    expect(screen.getByText(/Namen oder Vereine anklicken/i)).toBeInTheDocument();
    expect(screen.getByText(/Über a\.W\./i)).toBeInTheDocument();
    expect(screen.getByText("Halbstunde")).toBeInTheDocument();
    expect(screen.queryByTestId("standings-meta")).not.toBeInTheDocument();
    expect(screen.getByTestId("corrections-kpi-teams")).toHaveTextContent("1");
    expect(screen.getByTestId("corrections-kpi-races")).toHaveTextContent("2 / 5");
    expect(screen.getByTestId("corrections-kpi-excluded")).toHaveTextContent("1");
    expect(screen.getByText("Außer Wertung")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PDF exportieren" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excel exportieren" })).not.toBeInTheDocument();
  });

  it("renders an a.W. column header in the detail table", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    expect(screen.getByRole("columnheader", { name: "a.W." })).toBeInTheDocument();
  });

  it("does NOT render a.W. column on the StandingsPage (Auswertung)", async () => {
    const { StandingsPage } = await import("@/features/standings/StandingsPage.tsx");
    selectedCategoryKey = "half_hour:women";
    render(<StandingsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });
    expect(screen.queryByRole("columnheader", { name: "a.W." })).not.toBeInTheDocument();
  });

  it("renders a checkbox per row in the a.W. column matching the excluded state", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    const beaCheckbox = screen.getByRole("checkbox", { name: /a\.W\. Bea Team/i });
    const annaCheckbox = screen.getByRole("checkbox", { name: /a\.W\. Anna Team/i });
    expect(beaCheckbox).not.toBeChecked();
    expect(annaCheckbox).toBeChecked();
  });

  it("calls setStandingsRowExcluded with excluded=true when unchecked row is checked", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    const beaCheckbox = screen.getByRole("checkbox", { name: /a\.W\. Bea Team/i });
    fireEvent.click(beaCheckbox);

    await waitFor(() => {
      expect(apiMock.setStandingsRowExcluded).toHaveBeenCalledWith("season-1", {
        categoryKey: "half_hour:women",
        teamId: "team-bea",
        excluded: true,
      });
    });
  });

  it("calls setStandingsRowExcluded with excluded=false when checked row is unchecked", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    const annaCheckbox = screen.getByRole("checkbox", { name: /a\.W\. Anna Team/i });
    fireEvent.click(annaCheckbox);

    await waitFor(() => {
      expect(apiMock.setStandingsRowExcluded).toHaveBeenCalledWith("season-1", {
        categoryKey: "half_hour:women",
        teamId: "team-anna",
        excluded: false,
      });
    });
  });

  it("reloads standings and posts a status toast after successful a.W. toggle", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    fireEvent.click(screen.getByRole("checkbox", { name: /a\.W\. Bea Team/i }));

    await waitFor(() => {
      expect(apiMock.getStandings).toHaveBeenCalledTimes(2);
      expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "corrections" }));
    });
  });

  it("opens the correction modal when the team name button is clicked (solo)", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    const teamButton = screen.getAllByRole("button", { name: /Bea Team/i })[0]!;
    fireEvent.click(teamButton);

    await waitFor(() => {
      expect(apiMock.getStandingsRowIdentity).toHaveBeenCalledWith("season-1", {
        categoryKey: "half_hour:women",
        teamId: "team-bea",
      });
    });
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Daten korrigieren" })).toBeInTheDocument();
    });
  });

  it("shows a solo form (name, Jahrgang, Verein) in the correction modal for solo rows", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    fireEvent.click(screen.getAllByRole("button", { name: /Bea Team/i })[0]!);
    await waitFor(() => { expect(screen.getByRole("dialog")).toBeInTheDocument(); });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("textbox")).toHaveLength(3);
    expect(within(dialog).queryByText("Teilnehmende A")).not.toBeInTheDocument();
  });

  it("shows a two-member form for couple rows (Teilnehmende A and B)", async () => {
    selectedCategoryKey = "hour:couples_mixed";
    apiMock = { ...apiMock, getStandingsRowIdentity: vi.fn(async () => coupleIdentity) };
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    fireEvent.click(screen.getAllByRole("button", { name: /Maria/i })[0]!);
    await waitFor(() => { expect(screen.getByRole("dialog")).toBeInTheDocument(); });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Teilnehmende A")).toBeInTheDocument();
    expect(within(dialog).getByText("Teilnehmende B")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("textbox")).toHaveLength(6);
  });

  it("submits the corrected solo data and closes the modal on success", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    fireEvent.click(screen.getAllByRole("button", { name: /Bea Team/i })[0]!);
    await waitFor(() => { expect(screen.getByRole("dialog")).toBeInTheDocument(); });

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "Bea Korrigiert" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => {
      expect(apiMock.correctStandingsRowIdentity).toHaveBeenCalledWith(
        "season-1",
        expect.objectContaining({
          categoryKey: "half_hour:women",
          teamId: "team-bea",
          members: expect.arrayContaining([
            expect.objectContaining({ personId: "person-bea", name: "Bea Korrigiert" }),
          ]),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("submits corrected couple data with both members", async () => {
    selectedCategoryKey = "hour:couples_mixed";
    apiMock = {
      ...apiMock,
      getStandingsRowIdentity: vi.fn(async () => coupleIdentity),
    };
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    fireEvent.click(screen.getAllByRole("button", { name: /Maria/i })[0]!);
    await waitFor(() => { expect(screen.getByRole("dialog")).toBeInTheDocument(); });

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "Maria K." } });
    fireEvent.change(inputs[3]!, { target: { value: "Josef K." } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => {
      expect(apiMock.correctStandingsRowIdentity).toHaveBeenCalledWith(
        "season-1",
        expect.objectContaining({
          teamId: "team-couple",
          members: [
            expect.objectContaining({ personId: "person-maria", name: "Maria K." }),
            expect.objectContaining({ personId: "person-josef", name: "Josef K." }),
          ],
        }),
      );
    });
  });

  it("shows a validation error inside the modal when name is empty", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    fireEvent.click(screen.getAllByRole("button", { name: /Bea Team/i })[0]!);
    await waitFor(() => { expect(screen.getByRole("dialog")).toBeInTheDocument(); });

    const nameInput = screen.getAllByRole("textbox")[0]!;
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.getByText(/Name und Jahrgang sind für die Korrektur erforderlich/i)).toBeInTheDocument();
    expect(apiMock.correctStandingsRowIdentity).not.toHaveBeenCalled();
  });

  it("closes the modal and discards changes when Abbrechen is clicked", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    fireEvent.click(screen.getAllByRole("button", { name: /Bea Team/i })[0]!);
    await waitFor(() => { expect(screen.getByRole("dialog")).toBeInTheDocument(); });

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiMock.correctStandingsRowIdentity).not.toHaveBeenCalled();
  });

  it("reloads standings and posts a status toast after a successful correction", async () => {
    selectedCategoryKey = "half_hour:women";
    render(<CorrectionsPage />);
    await waitFor(() => { expect(screen.getByRole("table")).toBeInTheDocument(); });

    fireEvent.click(screen.getAllByRole("button", { name: /Bea Team/i })[0]!);
    await waitFor(() => { expect(screen.getByRole("dialog")).toBeInTheDocument(); });

    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => {
      expect(apiMock.getStandings).toHaveBeenCalledTimes(2);
      expect(setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "success", source: "corrections" }),
      );
    });
  });
});
