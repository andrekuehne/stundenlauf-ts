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

const shellData: ShellData = {
  selectedSeasonId: "season-1",
  selectedSeasonLabel: "Saison 1",
  unresolvedReviews: 0,
  availableSeasons: [{ seasonId: "season-1", label: "Saison 1" }],
};

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
    createImportDraft: vi.fn(async (input: ImportDraftInput) => buildDraftWithNoReviews(input)),
    getImportDraft: vi.fn(async () => {
      throw new Error("not used");
    }),
    setImportReviewDecision: vi.fn(async (_draftId: string, _decision: ImportReviewDecision) => {
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
    expect(screen.getByText("Hinweise")).toBeInTheDocument();
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
      expect(screen.getByRole("heading", { name: "Zusammenführungen prüfen" })).toBeInTheDocument();
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
});
