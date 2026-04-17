import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppApi, AppCommandResult, ShellData, StandingsData } from "@/api/contracts/index.ts";
import { App } from "@/app/App.tsx";

const navigateMock = vi.fn();
const setStatus = vi.fn();
let currentPathname = "/season";
let latestOutletContext: {
  setNavigationGuard: (guard: { message: string } | null) => void;
} | null = null;

let shellData: ShellData = {
  selectedSeasonId: "season-1",
  selectedSeasonLabel: "Saison 1",
  unresolvedReviews: 0,
  availableSeasons: [
    { seasonId: "season-1", label: "Saison 1" },
    { seasonId: "season-2", label: "Saison 2" },
  ],
};

const standingsWithRuns: StandingsData = {
  seasonId: "season-2",
  summary: { seasonLabel: "Saison 2", totalTeams: 1, totalParticipants: 1, totalRuns: 1, lastUpdatedAt: new Date().toISOString() },
  categories: [],
  rowsByCategory: {},
  importedRuns: [],
  exportActions: [],
};

let apiMock: AppApi;

function buildCommandResult(message: string): AppCommandResult {
  return { severity: "success", message };
}

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: currentPathname }),
  useNavigate: () => navigateMock,
  Outlet: ({ context }: { context?: unknown }) => {
    latestOutletContext = context as { setNavigationGuard: (guard: { message: string } | null) => void };
    return null;
  },
  NavLink: ({
    to,
    className,
    children,
    onClick,
  }: {
    to: string;
    className?: ((args: { isActive: boolean }) => string) | string;
    children: ReactNode;
    onClick?: (event: MouseEvent) => void;
  }) => {
    const resolvedClass = typeof className === "function" ? className({ isActive: false }) : className;
    return (
      <a
        href={to}
        className={resolvedClass}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event.nativeEvent);
        }}
      >
        {children}
      </a>
    );
  },
}));
vi.mock("@/api/provider.tsx", () => ({
  AppApiProvider: ({ children }: { children: ReactNode }) => children,
  useAppApi: () => apiMock,
}));
vi.mock("@/stores/status.ts", () => ({
  useStatusStore: (selector: (s: { setStatus: typeof setStatus; current: null }) => unknown) =>
    selector({ setStatus, current: null }),
}));
vi.mock("@/components/feedback/UpdatePrompt.tsx", () => ({ UpdatePrompt: () => null }));
vi.mock("@/version.ts", () => ({ APP_VERSION: "test-version" }));
vi.mock("@/devtools/ImportOrchestrationHarness.tsx", () => ({ ImportOrchestrationHarness: () => null }));
vi.mock("@/devtools/ImportSeasonWalkthroughHarness.tsx", () => ({ ImportSeasonWalkthroughHarness: () => null }));
vi.mock("@/devtools/LegacyLayoutParityPage.tsx", () => ({ LegacyLayoutParityPage: () => null }));

beforeEach(() => {
  currentPathname = "/season";
  latestOutletContext = null;
  shellData = {
    selectedSeasonId: "season-1",
    selectedSeasonLabel: "Saison 1",
    unresolvedReviews: 0,
    availableSeasons: [
      { seasonId: "season-1", label: "Saison 1" },
      { seasonId: "season-2", label: "Saison 2" },
    ],
  };
  navigateMock.mockReset();
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
    getStandings: vi.fn(async () => standingsWithRuns),
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
    setStandingsRowExcluded: vi.fn(async () => {}),
    hardResetHistoryToSeq: vi.fn(async () => buildCommandResult("ok")),
  };
});

describe("App season selector routing", () => {
  it("hides season fallback sidebar heading and hint", async () => {
    render(<App />);
    await screen.findByLabelText("Aktuelle Saison:");
    expect(screen.queryByRole("heading", { name: "Saison" })).not.toBeInTheDocument();
    expect(screen.queryByText("Bereichsspezifische Saison-Steuerungen erscheinen hier.")).not.toBeInTheDocument();
  });

  it("hides standings fallback sidebar heading and hint", async () => {
    currentPathname = "/standings";
    render(<App />);
    await screen.findByLabelText("Aktuelle Saison:");
    expect(screen.queryByRole("heading", { name: "Auswertung" })).not.toBeInTheDocument();
    expect(screen.queryByText("Steuerungen fuer die Auswertung werden geladen.")).not.toBeInTheDocument();
  });

  it("hides import fallback sidebar heading and hint", async () => {
    currentPathname = "/import";
    render(<App />);
    await screen.findByLabelText("Aktuelle Saison:");
    expect(screen.queryByRole("heading", { name: "Import" })).not.toBeInTheDocument();
    expect(screen.queryByText("Bereichsspezifische Import-Steuerungen erscheinen hier.")).not.toBeInTheDocument();
  });

  it("hides corrections and history sidebar control panels when no outlet injects controls", async () => {
    currentPathname = "/corrections";
    const { unmount } = render(<App />);
    await screen.findByLabelText("Aktuelle Saison:");
    expect(screen.queryByRole("heading", { name: "Korrekturen", level: 3 })).not.toBeInTheDocument();
    unmount();

    currentPathname = "/history";
    render(<App />);
    await screen.findByLabelText("Aktuelle Saison:");
    expect(screen.queryByRole("heading", { name: "Historie", level: 3 })).not.toBeInTheDocument();
  });

  it("navigates to standings when opened season has runs", async () => {
    render(<App />);
    const seasonSelect = await screen.findByLabelText("Aktuelle Saison:");
    fireEvent.change(seasonSelect, { target: { value: "season-2" } });

    await waitFor(() => { expect(apiMock.openSeason).toHaveBeenCalledWith("season-2"); });
    await waitFor(() => { expect(apiMock.getStandings).toHaveBeenCalledWith("season-2"); });
    expect(navigateMock).toHaveBeenCalledWith("/standings");
  });

  it("navigates to import when standings are unavailable", async () => {
    apiMock.getStandings = vi.fn(async () => {
      throw new Error("no standings yet");
    });

    render(<App />);
    const seasonSelect = await screen.findByLabelText("Aktuelle Saison:");
    fireEvent.change(seasonSelect, { target: { value: "season-2" } });

    await waitFor(() => { expect(apiMock.openSeason).toHaveBeenCalledWith("season-2"); });
    await waitFor(() => { expect(apiMock.getStandings).toHaveBeenCalledWith("season-2"); });
    expect(navigateMock).toHaveBeenCalledWith("/import");
  });

  it("shows in-app leave modal and cancels season change when user aborts", async () => {
    render(<App />);
    const seasonSelect = await screen.findByLabelText("Aktuelle Saison:");
    await waitFor(() => {
      expect(latestOutletContext).not.toBeNull();
    });

    await act(async () => {
      latestOutletContext?.setNavigationGuard({ message: "test confirm" });
    });
    fireEvent.change(seasonSelect, { target: { value: "season-2" } });

    expect(screen.getByRole("dialog", { name: "Import-Prozess verlassen?" })).toBeInTheDocument();
    expect(screen.getByText("test confirm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByRole("dialog", { name: "Import-Prozess verlassen?" })).not.toBeInTheDocument();
    expect(apiMock.openSeason).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows in-app leave modal and confirms Bereich navigation", async () => {
    render(<App />);
    await screen.findByLabelText("Aktuelle Saison:");
    await waitFor(() => {
      expect(latestOutletContext).not.toBeNull();
    });

    await act(async () => {
      latestOutletContext?.setNavigationGuard({ message: "test confirm" });
    });
    fireEvent.click(screen.getByRole("link", { name: "Import" }));

    expect(screen.getByRole("dialog", { name: "Import-Prozess verlassen?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trotzdem verlassen" }));
    expect(navigateMock).toHaveBeenCalledWith("/import");
  });
});
