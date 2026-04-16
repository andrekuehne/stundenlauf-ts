import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppApi, AppCommandResult, SeasonListItem, ShellData, StandingsData } from "@/api/contracts/index.ts";
import { SeasonPage } from "@/features/season/SeasonPage.tsx";

const setSidebarControls = vi.fn();
const refreshShellData = vi.fn(async () => {});
const setStatus = vi.fn();
const navigateMock = vi.fn();

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
  {
    seasonId: "season-3",
    label: "Saison 3",
    isActive: false,
    importedEvents: 3,
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

function buildCommandResult(message: string): AppCommandResult {
  return { severity: "success", message };
}

let apiMock: AppApi;

vi.mock("@/api/provider.tsx", () => ({ useAppApi: () => apiMock }));
vi.mock("@/app/shell-context.ts", () => ({
  useAppShellContext: () => ({ shellData, refreshShellData, setSidebarControls }),
}));
vi.mock("@/stores/status.ts", () => ({
  useStatusStore: (selector: (s: { setStatus: typeof setStatus }) => unknown) => selector({ setStatus }),
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

beforeEach(() => {
  vi.restoreAllMocks();
  setStatus.mockReset();
  setSidebarControls.mockReset();
  refreshShellData.mockClear();
  navigateMock.mockReset();
  apiMock = {
    getShellData: vi.fn(async () => shellData),
    listSeasons: vi.fn(async () => seasons),
    createSeason: vi.fn(async ({ label }) => ({
      seasonId: "season-x",
      label,
      isActive: true,
      importedEvents: 0,
      lastModifiedAt: new Date().toISOString(),
    })),
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

describe("SeasonPage", () => {
  it("does not inject season sidebar controls", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 1")).toBeInTheDocument());
    expect(setSidebarControls).not.toHaveBeenCalled();
  });

  it("opens another season and refreshes shell", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 2")).toBeInTheDocument());

    const openButtons = screen.getAllByRole("button", { name: /Öffnen/i });
    fireEvent.click(openButtons[1] as HTMLButtonElement);
    await waitFor(() => { expect(apiMock.openSeason).toHaveBeenCalledWith("season-2"); });
    expect(refreshShellData).toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "season", severity: "info" }));
  });

  it("opens already active season and still navigates based on imported events", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 1")).toBeInTheDocument());

    const openButtons = screen.getAllByRole("button", { name: /Öffnen/i });
    fireEvent.click(openButtons[0] as HTMLButtonElement);

    await waitFor(() => { expect(apiMock.openSeason).toHaveBeenCalledWith("season-1"); });
    expect(navigateMock).toHaveBeenCalledWith("/standings");
  });

  it("navigates to standings when opening a season with imported events", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 3")).toBeInTheDocument());

    const openButtons = screen.getAllByRole("button", { name: /Öffnen/i });
    fireEvent.click(openButtons[2] as HTMLButtonElement);

    await waitFor(() => { expect(apiMock.openSeason).toHaveBeenCalledWith("season-3"); });
    expect(navigateMock).toHaveBeenCalledWith("/standings");
  });

  it("navigates to import when opening a season without imported events", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 2")).toBeInTheDocument());

    const openButtons = screen.getAllByRole("button", { name: /Öffnen/i });
    fireEvent.click(openButtons[1] as HTMLButtonElement);

    await waitFor(() => { expect(apiMock.openSeason).toHaveBeenCalledWith("season-2"); });
    expect(navigateMock).toHaveBeenCalledWith("/import");
  });

  it("styles delete action as danger button", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 1")).toBeInTheDocument());

    const deleteButton = screen.getAllByRole("button", { name: "Löschen" })[0] as HTMLButtonElement;
    expect(deleteButton.className).toContain("button--danger");
  });

  it("requires typing season label before delete confirmation", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 2")).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole("button", { name: /Löschen/i });
    fireEvent.click(deleteButtons[1] as HTMLButtonElement);
    const dialog = screen.getByRole("dialog", { name: /Saison löschen/i });
    const confirmButton = within(dialog).getByRole("button", { name: /Bestätigen/i });

    fireEvent.click(confirmButton);
    expect(apiMock.deleteSeason).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Falscher Name" } });
    fireEvent.click(confirmButton);
    expect(apiMock.deleteSeason).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Saison 2" } });
    fireEvent.click(confirmButton);

    await waitFor(() => { expect(apiMock.deleteSeason).toHaveBeenCalledWith("season-2"); });
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", source: "season" }));
  });

  it("renders create and import actions in the existing seasons header", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Bestehende Saisons")).toBeInTheDocument());

    const header = screen.getByText("Bestehende Saisons").closest(".surface-card__header");
    expect(header).not.toBeNull();
    const headerScope = within(header as HTMLElement);
    expect(headerScope.getByRole("button", { name: /Saison anlegen/i })).toBeInTheDocument();
    expect(headerScope.getByRole("button", { name: /Saison importieren/i })).toBeInTheDocument();
  });

  it("requires a season label in the create modal before creating", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Bestehende Saisons")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Saison anlegen/i }));
    const dialog = screen.getByRole("dialog", { name: /Neue Saison/i });

    fireEvent.click(within(dialog).getByRole("button", { name: /Neue Saison erstellen/i }));
    expect(apiMock.createSeason).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /Neue Saison/i })).toBeInTheDocument();
  });

  it("navigates to import after creating a season from modal", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Bestehende Saisons")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Saison anlegen/i }));
    const dialog = screen.getByRole("dialog", { name: /Neue Saison/i });
    const input = within(dialog).getByRole("textbox", { name: /Saisonname/i });
    fireEvent.change(input, { target: { value: "Neue Saison" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Neue Saison erstellen/i }));
    await waitFor(() => { expect(apiMock.createSeason).toHaveBeenCalledWith({ label: "Neue Saison" }); });
    expect(navigateMock).toHaveBeenCalledWith("/import");
  });

  it("runs season row exports with compact PDF default", async () => {
    render(<SeasonPage />);
    await waitFor(() => expect(screen.getByText("Saison 1")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Excel" })[0] as HTMLButtonElement);
    await waitFor(() => expect(apiMock.runExportAction).toHaveBeenCalledWith("season-1", "export_excel"));

    fireEvent.click(screen.getAllByRole("button", { name: "PDF" })[0] as HTMLButtonElement);
    await waitFor(() =>
      expect(apiMock.runExportAction).toHaveBeenCalledWith("season-1", "export_pdf", { pdfLayoutPreset: "compact" }),
    );
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ source: "season" }));
  });
});
