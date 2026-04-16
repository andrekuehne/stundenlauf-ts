import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppApi,
  AppCommandResult,
  ImportDraftInput,
  ImportDraftState,
  ImportReviewDecision,
  ShellData,
  StandingsData,
} from "@/api/contracts/index.ts";
import { ImportPage } from "@/features/import/ImportPage.tsx";

const setSidebarControls = vi.fn();
const refreshShellData = vi.fn(async () => {});

const defaultShellData: ShellData = {
  selectedSeasonId: "season-1",
  selectedSeasonLabel: "Saison 1",
  unresolvedReviews: 0,
  availableSeasons: [{ seasonId: "season-1", label: "Saison 1" }],
};
let shellData: ShellData = defaultShellData;

const emptyStandings: StandingsData = {
  seasonId: "season-1",
  summary: {
    seasonLabel: "Saison 1",
    totalTeams: 0,
    totalParticipants: 0,
    totalRuns: 0,
    lastUpdatedAt: new Date().toISOString(),
  },
  categories: [],
  rowsByCategory: {},
  importedRuns: [],
  exportActions: [],
};

let apiMock: AppApi;

vi.mock("@/api/provider.tsx", () => ({
  useAppApi: () => apiMock,
}));

vi.mock("@/app/shell-context.ts", () => ({
  useAppShellContext: () => ({
    shellData,
    refreshShellData,
    setSidebarControls,
  }),
}));

function buildDraftWithNoReviews(input: ImportDraftInput): ImportDraftState {
  return {
    draftId: "draft-empty-reviews",
    seasonId: input.seasonId,
    fileName: input.fileName,
    category: input.category,
    raceNumber: input.raceNumber,
    step: "summary",
    reviewItems: [],
    decisions: [],
    summary: {
      importedEntries: 10,
      mergedEntries: 10,
      newPersonsCreated: 0,
      typoCorrections: 0,
      infos: ["24 Einträge wurden aus früheren Zuordnungen automatisch zugeordnet."],
      warnings: [],
    },
  };
}

function buildCommandResult(message: string): AppCommandResult {
  return { severity: "success", message };
}

function buildDraftWithReviewItems(input: ImportDraftInput): ImportDraftState {
  return {
    draftId: "draft-with-reviews",
    seasonId: input.seasonId,
    fileName: input.fileName,
    category: input.category,
    raceNumber: input.raceNumber,
    step: "review_matches",
    reviewItems: [
      {
        reviewId: "review-1",
        incoming: {
          displayName: "Kathi Mueller",
          yob: 1993,
          club: "SV Nord",
          startNumber: 10,
          resultLabel: "10,1 km / 12 P",
        },
        candidates: [
          {
            candidateId: "team-1",
            displayName: "Kathi Moller",
            confidence: 0.96,
            isRecommended: true,
            fieldComparisons: [
              {
                fieldKey: "name",
                label: "Name",
                incomingValue: "Kathi Mueller",
                candidateValue: "Kathi Moller",
                isMatch: false,
              },
            ],
          },
        ],
      },
    ],
    decisions: [{ reviewId: "review-1", action: "merge", candidateId: "team-1" }],
    summary: {
      importedEntries: 1,
      mergedEntries: 1,
      newPersonsCreated: 0,
      typoCorrections: 0,
      infos: [],
      warnings: [],
    },
  };
}

function buildDoublesDraftWithUnresolvedReview(input: ImportDraftInput): ImportDraftState {
  return {
    draftId: "draft-doubles-review",
    seasonId: input.seasonId,
    fileName: input.fileName,
    category: "doubles",
    raceNumber: input.raceNumber,
    step: "review_matches",
    reviewItems: [
      {
        reviewId: "review-pair-1",
        incoming: {
          displayName: "Lea + Tom",
          yob: 1992,
          club: "Greifswald Laufteam",
          startNumber: 7,
          resultLabel: "12,2 km / 14 P",
        },
        candidates: [
          {
            candidateId: "pair-1",
            displayName: "Lea + Tom",
            confidence: 0.9,
            isRecommended: true,
            fieldComparisons: [
              {
                fieldKey: "name",
                label: "Name",
                incomingValue: "Lea + Tom",
                candidateValue: "Lea + Tom",
                isMatch: true,
              },
              {
                fieldKey: "yob",
                label: "Jahrgang",
                incomingValue: "1992 / 1990",
                candidateValue: "1992 / 1990",
                isMatch: true,
              },
            ],
          },
        ],
      },
    ],
    decisions: [],
    summary: {
      importedEntries: 1,
      mergedEntries: 0,
      newPersonsCreated: 0,
      typoCorrections: 0,
      infos: [],
      warnings: [],
    },
  };
}

function buildDraftWithUnresolvedReview(input: ImportDraftInput): ImportDraftState {
  return {
    draftId: "draft-unresolved-review",
    seasonId: input.seasonId,
    fileName: input.fileName,
    category: input.category,
    raceNumber: input.raceNumber,
    step: "review_matches",
    reviewItems: [
      {
        reviewId: "review-1",
        incoming: {
          displayName: "Kathi Mueller",
          yob: 1993,
          club: "SV Nord",
          startNumber: 10,
          resultLabel: "10,1 km / 12 P",
        },
        candidates: [
          {
            candidateId: "team-2",
            displayName: "Kathi Moller",
            confidence: 0.96,
            isRecommended: true,
            fieldComparisons: [
              {
                fieldKey: "name",
                label: "Name",
                incomingValue: "Kathi Mueller",
                candidateValue: "Kathi Moller",
                isMatch: false,
              },
            ],
          },
          {
            candidateId: "team-1",
            displayName: "Kathi Mueller",
            confidence: 0.94,
            isRecommended: false,
            fieldComparisons: [
              {
                fieldKey: "name",
                label: "Name",
                incomingValue: "Kathi Mueller",
                candidateValue: "Kathi Mueller",
                isMatch: true,
              },
            ],
          },
        ],
      },
    ],
    decisions: [],
    summary: {
      importedEntries: 1,
      mergedEntries: 1,
      newPersonsCreated: 0,
      typoCorrections: 0,
      infos: [],
      warnings: [],
    },
  };
}

beforeEach(() => {
  setSidebarControls.mockReset();
  refreshShellData.mockClear();
  shellData = { ...defaultShellData };

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
    setStandingsRowExcluded: vi.fn(async () => {}),
    runExportAction: vi.fn(async () => buildCommandResult("ok")),
    createImportDraft: vi.fn(async (input: ImportDraftInput) => buildDraftWithNoReviews(input)),
    getImportDraft: vi.fn(async () => {
      throw new Error("not used");
    }),
    setImportReviewDecision: vi.fn(async (draftId: string, decision: ImportReviewDecision) => {
      void draftId;
      void decision;
      throw new Error("not used");
    }),
    finalizeImportDraft: vi.fn(async () => buildCommandResult("Import abgeschlossen")),
    getHistory: vi.fn(async () => {
      throw new Error("not used");
    }),
    previewHistoryState: vi.fn(async () => {
      throw new Error("not used");
    }),
    rollbackHistory: vi.fn(async () => {
      throw new Error("not used");
    }),
    hardResetHistoryToSeq: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
});

describe("ImportPage", () => {
  it("does not render imported runs table on file selection step", () => {
    render(<ImportPage />);

    expect(screen.queryByRole("heading", { name: "Importierte Läufe" })).not.toBeInTheDocument();
  });

  it("auto-detects race number and pairs category from typed filename", () => {
    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW_Paare Lauf 2.xlsx" },
    });

    expect(screen.getByPlaceholderText("4")).toHaveValue(2);
    expect(screen.getByRole("button", { name: "Paare" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Einzel" })).not.toHaveClass("is-active");
  });

  it("auto-detects race number and singles category from picked filename", () => {
    render(<ImportPage />);

    const fileInput = document.querySelector<HTMLInputElement>("input[type='file']");
    expect(fileInput).not.toBeNull();
    const file = new File(["excel"], "Ergebnisliste MW Lauf 5.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(screen.getByPlaceholderText("lauf4-mw.xlsx")).toHaveValue("Ergebnisliste MW Lauf 5.xlsx");
    expect(screen.getByPlaceholderText("4")).toHaveValue(5);
    expect(screen.getByRole("button", { name: "Einzel" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Paare" })).not.toHaveClass("is-active");
  });

  it("jumps directly to summary when draft has no review items", async () => {
    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import-Zusammenfassung" })).toBeInTheDocument();
    });
    expect(screen.getByText("24 Einträge wurden aus früheren Zuordnungen automatisch zugeordnet.")).toBeInTheDocument();
    expect(screen.getByText("Keine Warnungen.")).toBeInTheDocument();
  });

  it("stages review decisions locally and submits them only on final confirmation", async () => {
    const draftWithReview = buildDraftWithReviewItems({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    const setImportReviewDecisionSpy = vi.fn(async (_draftId: string, decision: ImportReviewDecision) => ({
      ...draftWithReview,
      decisions: [decision],
    }));
    apiMock.createImportDraft = vi.fn(async () => draftWithReview);
    apiMock.setImportReviewDecision = setImportReviewDecisionSpy;

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Eintrag 1\/1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Neue Person anlegen/i }));
    expect(setImportReviewDecisionSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Zusammenfassung/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import-Zusammenfassung" })).toBeInTheDocument();
    });
    expect(setImportReviewDecisionSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Import abschließen" }));

    await waitFor(() => {
      expect(setImportReviewDecisionSpy).toHaveBeenCalledWith("draft-with-reviews", {
        reviewId: "review-1",
        action: "create_new",
        candidateId: null,
      });
    });
  });

  it("shows a compact pipe-separated incoming summary without Verein for singles", async () => {
    const unresolvedDraft = buildDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => unresolvedDraft);

    const { container } = render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const incoming = container.querySelector(".import-review__incoming");
    expect(incoming).toBeTruthy();
    expect(incoming).toHaveTextContent("Kathi Mueller (1993) | Startnr. 10 | 10,1 km / 12 P");
    expect(incoming?.textContent).not.toMatch(/Verein/i);
  });

  it("shows one incoming summary line for doubles with shared Startnr. and result", async () => {
    const doublesDraft = buildDoublesDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste Paare Lauf 1.xlsx",
      category: "doubles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => doublesDraft);

    const { container } = render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste Paare Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Paare" }));
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const line = container.querySelector(".import-review__incoming-line");
    expect(line?.textContent).toBe("Lea (1992) / Tom (1990) | Startnr. 7 | 12,2 km / 14 P");
    expect(container.querySelector(".import-review__incoming")?.textContent).not.toMatch(/Greifswald|Verein/i);
  });

  it("uses a three-part fill layout on merge review so the toolbar is separate from the scroll region", async () => {
    const unresolvedDraft = buildDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => unresolvedDraft);

    const { container } = render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const article = container.querySelector("article.import-step--fill");
    expect(article).toBeTruthy();
    expect(article!.querySelector(".import-review--cards-scroll")).toBeTruthy();
    const children = Array.from(article!.children);
    expect(children.length).toBe(3);
    expect(children[0]?.classList.contains("import-flowbar")).toBe(true);
    expect(children[1]?.classList.contains("surface-card__header")).toBe(true);
    expect(children[2]?.classList.contains("import-review")).toBe(true);
  });

  it("auto-selects the best visible candidate when no decision exists yet", async () => {
    const unresolvedDraft = buildDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => unresolvedDraft);

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    const selectedBestCandidate = await screen.findByRole("button", {
      name: /Kathi Moller - ausgewählt/i,
    });
    expect(selectedBestCandidate).toBeInTheDocument();
  });

  it("opens and closes matching settings via a single button", async () => {
    const unresolvedDraft = buildDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => unresolvedDraft);

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Eintrag 1\/1/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole("dialog", { name: "Matching-Optionen" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Matching-Einstellungen" }));

    expect(screen.getByRole("dialog", { name: "Matching-Optionen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));

    expect(screen.queryByRole("dialog", { name: "Matching-Optionen" })).not.toBeInTheDocument();
  });

  it("uses 0 as slider minimum for matching thresholds", async () => {
    const unresolvedDraft = buildDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => unresolvedDraft);

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Eintrag 1\/1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Matching-Einstellungen" }));
    expect(screen.getByRole("dialog", { name: "Matching-Optionen" })).toBeInTheDocument();

    const sliders = screen.getAllByRole("slider");
    expect(sliders.length).toBeGreaterThanOrEqual(2);
    for (const slider of sliders) {
      expect(slider).toHaveAttribute("min", "0");
    }
  });

  it("shows status when no season is selected", async () => {
    shellData = {
      ...defaultShellData,
      selectedSeasonId: null,
      selectedSeasonLabel: null,
    };

    render(<ImportPage />);
    expect(screen.getByText(/Bitte zuerst eine Saison auswählen/i)).toBeInTheDocument();
  });

  it("does not advance when createImportDraft fails", async () => {
    apiMock.createImportDraft = vi.fn(async () => {
      throw new Error("Draft Fehler");
    });

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(apiMock.createImportDraft).toHaveBeenCalled();
    });
    expect(screen.queryByRole("heading", { name: "Import-Zusammenfassung" })).not.toBeInTheDocument();
  });

  it("does not finalize when unresolved decisions exist", async () => {
    const unresolvedDraft = buildDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => unresolvedDraft);
    const finalizeSpy = vi.fn(async () => buildCommandResult("Import abgeschlossen"));
    apiMock.finalizeImportDraft = finalizeSpy;

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.change(screen.getByPlaceholderText("4"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Eintrag 1\/1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Zusammenfassung/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import-Zusammenfassung" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Import abschließen" }));
    expect(finalizeSpy).not.toHaveBeenCalled();
  });

  it("renders step indicators in the top header and no helper sidebar cards", () => {
    render(<ImportPage />);

    expect(screen.getByLabelText("Aktueller Schritt")).toBeInTheDocument();
    expect(screen.getByText("1. Datei auswählen")).toBeInTheDocument();
    expect(screen.getByText("2. Zuordnungen prüfen")).toBeInTheDocument();
    expect(screen.getByText("3. Zusammenfassung")).toBeInTheDocument();
    expect(screen.queryByText("Hilfe")).not.toBeInTheDocument();
    expect(screen.queryByText("Datei-Prüfung")).not.toBeInTheDocument();
    expect(screen.queryByText("Nächster Schritt")).not.toBeInTheDocument();
  });
});
