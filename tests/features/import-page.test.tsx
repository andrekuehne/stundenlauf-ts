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
import "@/app/theme.css";
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

function buildDraftWithMultipleResolvedReviews(input: ImportDraftInput): ImportDraftState {
  return {
    draftId: "draft-with-resolved-reviews",
    seasonId: input.seasonId,
    fileName: input.fileName,
    category: input.category,
    raceNumber: input.raceNumber,
    step: "review_matches",
    reviewItems: [
      {
        reviewId: "review-a",
        incoming: {
          displayName: "Anna Schmidt",
          yob: 1991,
          club: "SV Sued",
          startNumber: 5,
          resultLabel: "11,2 km / 13 P",
        },
        candidates: [
          {
            candidateId: "team-anna",
            displayName: "Anne Schmidt",
            confidence: 0.92,
            isRecommended: true,
            fieldComparisons: [
              {
                fieldKey: "name",
                label: "Name",
                incomingValue: "Anna Schmidt",
                candidateValue: "Anne Schmidt",
                isMatch: false,
              },
            ],
          },
        ],
      },
      {
        reviewId: "review-b",
        incoming: {
          displayName: "Bernd Klar",
          yob: 1985,
          club: "VfL Mitte",
          startNumber: 12,
          resultLabel: "9,4 km / 10 P",
        },
        candidates: [
          {
            candidateId: "team-bernd",
            displayName: "Bernd Clarsen",
            confidence: 0.88,
            isRecommended: true,
            fieldComparisons: [
              {
                fieldKey: "name",
                label: "Name",
                incomingValue: "Bernd Klar",
                candidateValue: "Bernd Clarsen",
                isMatch: false,
              },
            ],
          },
        ],
      },
      {
        reviewId: "review-c",
        incoming: {
          displayName: "Carla Neu",
          yob: 1999,
          club: "—",
          startNumber: 21,
          resultLabel: "13,5 km / 16 P",
        },
        candidates: [],
      },
    ],
    decisions: [
      { reviewId: "review-a", action: "merge_with_typo_fix", candidateId: "team-anna" },
      { reviewId: "review-b", action: "merge", candidateId: "team-bernd" },
      { reviewId: "review-c", action: "create_new", candidateId: null },
    ],
    summary: {
      importedEntries: 25,
      mergedEntries: 22,
      newPersonsCreated: 3,
      typoCorrections: 1,
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
    applyImportReviewCorrection: vi.fn(async () => {
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

  it("renders a season overview panel beside the file selector with a row for Einzel and a row for Paare", async () => {
    const { container } = render(<ImportPage />);

    await waitFor(() => {
      expect(container.querySelector(".import-season-overview")).toBeTruthy();
    });

    const overview = container.querySelector(".import-season-overview");
    expect(overview).toBeTruthy();
    expect(overview!.textContent).toMatch(/Einzel/);
    expect(overview!.textContent).toMatch(/Paare/);

    const singlesRow = overview!.querySelector(".import-season-overview__row--singles");
    const doublesRow = overview!.querySelector(".import-season-overview__row--doubles");
    expect(singlesRow).toBeTruthy();
    expect(doublesRow).toBeTruthy();

    expect(singlesRow!.querySelectorAll(".import-season-overview__chip").length).toBeGreaterThanOrEqual(5);
    expect(doublesRow!.querySelectorAll(".import-season-overview__chip").length).toBeGreaterThanOrEqual(5);
  });

  it("marks already-imported races as imported in the season overview panel", async () => {
    apiMock.getStandings = vi.fn(async () => ({
      ...emptyStandings,
      importedRuns: [
        { raceLabel: "Lauf 2", categoryLabel: "60 Minuten Herren/Damen", dateLabel: "—", sourceLabel: "f.xlsx", entries: 12 },
        { raceLabel: "Lauf 3", categoryLabel: "30 Minuten Paare", dateLabel: "—", sourceLabel: "p.xlsx", entries: 8 },
      ],
    }));

    const { container } = render(<ImportPage />);

    await waitFor(() => {
      const overview = container.querySelector(".import-season-overview");
      expect(overview).toBeTruthy();
      expect(overview!.querySelectorAll(".import-season-overview__chip.is-imported").length).toBe(2);
    });

    const singlesImported = container.querySelectorAll(
      ".import-season-overview__row--singles .import-season-overview__chip.is-imported",
    );
    const doublesImported = container.querySelectorAll(
      ".import-season-overview__row--doubles .import-season-overview__chip.is-imported",
    );
    expect(singlesImported.length).toBe(1);
    expect(singlesImported[0]?.textContent).toMatch(/2/);
    expect(doublesImported.length).toBe(1);
    expect(doublesImported[0]?.textContent).toMatch(/3/);
  });

  it("prefills race number and category when a free chip in the overview is clicked", async () => {
    const { container } = render(<ImportPage />);

    await waitFor(() => {
      expect(container.querySelector(".import-season-overview")).toBeTruthy();
    });

    const doublesChip4 = container.querySelector<HTMLButtonElement>(
      ".import-season-overview__row--doubles .import-season-overview__chip[data-race='4']",
    );
    expect(doublesChip4).toBeTruthy();
    fireEvent.click(doublesChip4!);

    expect(doublesChip4!.classList.contains("is-selected")).toBe(true);
    const singlesChip4 = container.querySelector(
      ".import-season-overview__row--singles .import-season-overview__chip[data-race='4']",
    );
    expect(singlesChip4?.classList.contains("is-selected")).toBe(false);
  });

  it("auto-detects race number and pairs category from typed filename and highlights the matching chip", () => {
    const { container } = render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW_Paare Lauf 2.xlsx" },
    });

    const doublesChip2 = container.querySelector(
      ".import-season-overview__row--doubles .import-season-overview__chip[data-race='2']",
    );
    const singlesChip2 = container.querySelector(
      ".import-season-overview__row--singles .import-season-overview__chip[data-race='2']",
    );
    expect(doublesChip2?.classList.contains("is-selected")).toBe(true);
    expect(singlesChip2?.classList.contains("is-selected")).toBe(false);
  });

  it("auto-detects race number and singles category from picked filename and highlights the matching chip", () => {
    const { container } = render(<ImportPage />);

    const fileInput = document.querySelector<HTMLInputElement>("input[type='file']");
    expect(fileInput).not.toBeNull();
    const file = new File(["excel"], "Ergebnisliste MW Lauf 5.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(screen.getByPlaceholderText("lauf4-mw.xlsx")).toHaveValue("Ergebnisliste MW Lauf 5.xlsx");
    const singlesChip5 = container.querySelector(
      ".import-season-overview__row--singles .import-season-overview__chip[data-race='5']",
    );
    const doublesChip5 = container.querySelector(
      ".import-season-overview__row--doubles .import-season-overview__chip[data-race='5']",
    );
    expect(singlesChip5?.classList.contains("is-selected")).toBe(true);
    expect(doublesChip5?.classList.contains("is-selected")).toBe(false);
  });

  it("does not render a duplicate category toggle or race number input in the file selector form", () => {
    render(<ImportPage />);

    expect(screen.queryByPlaceholderText("4")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Einzel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Paare" })).not.toBeInTheDocument();
  });

  it("shows a confirmation status when the filename auto-detection succeeds", () => {
    const { container } = render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 3.xlsx" },
    });

    const status = container.querySelector(".import-select-status");
    expect(status).toBeTruthy();
    expect(status?.textContent).toMatch(/Erkannt/i);
    expect(status?.textContent).toMatch(/Einzel/);
    expect(status?.textContent).toMatch(/Lauf 3/);
    expect(status?.classList.contains("is-detected")).toBe(true);
  });

  it("guides the user to pick a slot in the overview when no race number is in the filename", () => {
    const { container } = render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "ergebnisliste-mw.xlsx" },
    });

    const status = container.querySelector(".import-select-status");
    expect(status).toBeTruthy();
    expect(status?.classList.contains("is-needs-pick")).toBe(true);
    expect(status?.textContent).toMatch(/links/i);
  });

  it("jumps directly to summary when draft has no review items", async () => {
    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import-Zusammenfassung" })).toBeInTheDocument();
    });
  });

  it("does not show the Hinweise/Warnungen sections on the summary screen", async () => {
    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import-Zusammenfassung" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: /Hinweise/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Warnungen/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Keine Warnungen.")).not.toBeInTheDocument();
    expect(screen.queryByText("Keine Hinweise.")).not.toBeInTheDocument();
  });

  it("shows a context callout on the summary screen with category, race number, and the file name", async () => {
    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 4.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    const heading = await screen.findByRole("heading", { name: "Import-Zusammenfassung" });
    const card = heading.closest(".import-step");
    expect(card).toBeTruthy();

    const callout = card!.querySelector(".import-summary__context");
    expect(callout).toBeTruthy();
    expect(callout!.textContent).toMatch(/Einzel/);
    expect(callout!.textContent).toMatch(/Lauf 4/);
    expect(callout!.textContent).toMatch(/Ergebnisliste MW Lauf 4\.xlsx/);
  });

  it("shows clear KPI tiles on the summary screen for imported entries, new persons, and manual decisions", async () => {
    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: "Import-Zusammenfassung" });

    const importedTile = screen.getByText("Importierte Einträge").closest(".summary-card");
    expect(importedTile?.textContent).toMatch(/10/);

    const newTile = screen.getByText("Neue Personen").closest(".summary-card");
    expect(newTile?.textContent).toMatch(/0/);

    const manualTile = screen.getByText("Manuell entschieden").closest(".summary-card");
    expect(manualTile?.textContent).toMatch(/0/);
  });

  it("shows a placeholder when there are no manual decisions on the summary screen", async () => {
    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: "Import-Zusammenfassung" });

    const decisionsBlock = document.querySelector(".import-summary__decisions");
    expect(decisionsBlock).toBeTruthy();
    expect(decisionsBlock?.textContent).toMatch(/automatisch|keine|alle/i);
    expect(decisionsBlock?.querySelector("table")).toBeNull();
  });

  it("renders a tabular overview of manually adjusted matches on the summary screen", async () => {
    const draft = buildDraftWithMultipleResolvedReviews({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => draft);

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/3/i });

    for (let i = 0; i < 3; i++) {
      const next = screen.getByRole("button", {
        name: /Nächste|Zusammenfassung ➡/i,
      });
      fireEvent.click(next);
    }

    await screen.findByRole("heading", { name: "Import-Zusammenfassung" });

    const table = document.querySelector(".import-summary__decisions table");
    expect(table).toBeTruthy();
    const rows = table!.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);

    const allText = table!.textContent ?? "";
    expect(allText).toMatch(/Anna Schmidt/);
    expect(allText).toMatch(/Anne Schmidt/);
    expect(allText).toMatch(/Bernd Klar/);
    expect(allText).toMatch(/Bernd Clarsen/);
    expect(allText).toMatch(/Carla Neu/);
    expect(allText).toMatch(/[Nn]eue Person/);
    expect(allText).toMatch(/[Kk]orrektur/);

    const manualTile = screen.getByText("Manuell entschieden").closest(".summary-card");
    expect(manualTile?.textContent).toMatch(/3/);
  });

  it("refreshes the season overview after finalize so the new run shows as imported", async () => {
    let standingsAfterCommit = false;
    apiMock.getStandings = vi.fn(async () => {
      if (!standingsAfterCommit) {
        return emptyStandings;
      }
      return {
        ...emptyStandings,
        importedRuns: [
          {
            raceLabel: "Lauf 2",
            categoryLabel: "60 Minuten Herren/Damen",
            dateLabel: "—",
            sourceLabel: "Ergebnisliste MW Lauf 2.xlsx",
            entries: 12,
          },
        ],
      };
    });
    apiMock.finalizeImportDraft = vi.fn(async () => {
      standingsAfterCommit = true;
      return buildCommandResult("Import abgeschlossen");
    });

    const { container } = render(<ImportPage />);

    await waitFor(() => {
      expect(container.querySelector(".import-season-overview")).toBeTruthy();
    });

    const singlesLauf2Before = container.querySelector(
      ".import-season-overview__row--singles .import-season-overview__chip[data-race='2']",
    );
    expect(singlesLauf2Before?.classList.contains("is-imported")).toBe(false);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 2.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import-Zusammenfassung" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Import abschließen" }));

    await waitFor(() => {
      const chip = container.querySelector(
        ".import-season-overview__row--singles .import-season-overview__chip[data-race='2']",
      );
      expect(chip?.classList.contains("is-imported")).toBe(true);
    });
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
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Eintrag 1\/1/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole("dialog", { name: "Matching-Optionen" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));

    expect(screen.getByRole("dialog", { name: "Matching-Optionen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));

    expect(screen.queryByRole("dialog", { name: "Matching-Optionen" })).not.toBeInTheDocument();
  });

  it("opens correction modal from Daten korrigieren and validates required fields", async () => {
    const unresolvedDraft = buildDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => unresolvedDraft);
    apiMock.applyImportReviewCorrection = vi.fn(async () => unresolvedDraft);

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));
    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const correctButton = screen.getByRole("button", { name: /Daten korrigieren/i });
    await waitFor(() => {
      expect(correctButton).not.toBeDisabled();
    });
    fireEvent.click(correctButton);
    const dialog = await screen.findByRole("dialog", { name: /Daten korrigieren/i });
    expect(dialog).toHaveTextContent("Eingehend");
    expect(dialog).toHaveTextContent("Bestand");
    expect(dialog).toHaveTextContent("Kathi Mueller");
    expect(dialog).toHaveTextContent("Kathi Moller");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => {
      expect(apiMock.applyImportReviewCorrection).not.toHaveBeenCalled();
      expect(screen.getByText(/Name und Jahrgang/i)).toBeInTheDocument();
    });
  });

  it("submits correction modal and stages merge_with_typo_fix for current review", async () => {
    const unresolvedDraft = buildDraftWithUnresolvedReview({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    const correctedDraft: ImportDraftState = {
      ...unresolvedDraft,
      decisions: [{ reviewId: "review-1", action: "merge_with_typo_fix", candidateId: "team-2" }],
      summary: { ...unresolvedDraft.summary, typoCorrections: 1 },
    };
    const applySpy = vi.fn(async () => correctedDraft);
    apiMock.createImportDraft = vi.fn(async () => unresolvedDraft);
    apiMock.applyImportReviewCorrection = applySpy;

    render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));
    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const correctButton = screen.getByRole("button", { name: /Daten korrigieren/i });
    await waitFor(() => {
      expect(correctButton).not.toBeDisabled();
    });
    fireEvent.click(correctButton);
    await screen.findByRole("dialog", { name: /Daten korrigieren/i });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Kathi Mueller" } });
    fireEvent.change(screen.getByLabelText("Jahrgang"), { target: { value: "1993" } });
    fireEvent.change(screen.getByLabelText("Verein"), { target: { value: "SV Nord" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith("draft-unresolved-review", {
        reviewId: "review-1",
        candidateId: "team-2",
        correction: {
          type: "single",
          name: "Kathi Mueller",
          yob: 1993,
          club: "SV Nord",
        },
      });
    });
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
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Eintrag 1\/1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
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

  it("does not render an Eintrag x/y progress chip in the review toolbar", async () => {
    const resolvedDraft = buildDraftWithMultipleResolvedReviews({
      seasonId: "season-1",
      fileName: "Ergebnisliste MW Lauf 1.xlsx",
      category: "singles",
      raceNumber: 1,
    });
    apiMock.createImportDraft = vi.fn(async () => resolvedDraft);

    const { container } = render(<ImportPage />);

    fireEvent.change(screen.getByPlaceholderText("lauf4-mw.xlsx"), {
      target: { value: "Ergebnisliste MW Lauf 1.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/3/i });

    const toolbarLeft = container.querySelector(".import-review__toolbar-left");
    expect(toolbarLeft).toBeTruthy();
    expect(container.querySelector(".import-review__progress")).toBeNull();
    expect(toolbarLeft!.textContent).not.toMatch(/Eintrag\s+\d+\s*\/\s*\d+/i);
  });

  it("makes the review white box take the full available vertical space", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const pageStack = container.querySelector(".page-stack--fill");
    expect(pageStack).toBeTruthy();
    const directChildren = Array.from(pageStack!.children);
    expect(directChildren.length).toBe(1);
    const onlyChild = directChildren[0]!;
    expect(onlyChild.classList.contains("import-workflow--fill")).toBe(true);

    const article = container.querySelector("article.import-step--fill");
    expect(article).toBeTruthy();
    expect(article!.classList.contains("surface-card")).toBe(true);
  });

  it("renders a compact meta line atop the file-selection step with season context", async () => {
    const { container } = render(<ImportPage />);

    await waitFor(() => {
      expect(container.querySelector(".import-select-meta")).toBeTruthy();
    });

    const meta = container.querySelector(".import-select-meta");
    expect(meta!.textContent).toMatch(/Saison 1/);
  });

  it("groups review-step toolbar buttons into a secondary-left and forward-right cluster", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const left = container.querySelector(".import-review__toolbar-left");
    const right = container.querySelector(".import-review__toolbar-right");
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();

    expect(left!.textContent).toMatch(/Zurück zu Datei/);
    expect(left!.textContent).toMatch(/Einstellungen/);
    expect(left!.textContent).not.toMatch(/Vorige/);

    expect(right!.textContent).toMatch(/Vorige/);
    expect(right!.textContent).toMatch(/Daten korrigieren/);
    expect(right!.textContent).toMatch(/Zusammenfassung|Nächste/);
  });

  it("does not force a wide min-width on the forward review button", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const next = container.querySelector(".import-review__next-button");
    expect(next).toBeTruthy();
    const minWidth = window.getComputedStyle(next!).minWidth;
    const px = minWidth.endsWith("px") ? Number.parseFloat(minWidth) : Number.NaN;
    expect(Number.isNaN(px) || px < 200).toBe(true);
  });

  it("frames the incoming entry as a current-entry callout with context eyebrow and a call-to-action to act below", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const incoming = container.querySelector(".import-review__incoming");
    expect(incoming).toBeTruthy();

    const eyebrow = incoming!.querySelector(".import-review__incoming-eyebrow");
    expect(eyebrow).toBeTruthy();
    expect(eyebrow!.textContent).toMatch(/Aktuell zu prüfen/i);

    const cta = incoming!.querySelector(".import-review__incoming-cta");
    expect(cta).toBeTruthy();
    expect(cta!.textContent).toMatch(/unten/i);

    const incomingTag = incoming!.tagName.toLowerCase();
    expect(["section", "aside"]).toContain(incomingTag);
  });

  it("lists candidate matches before the 'new person' fallback with a labelled divider between them", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Weiter zu Zuordnungen" }));

    await screen.findByRole("heading", { name: /Eintrag 1\/1/i });

    const cards = container.querySelector(".import-review__cards");
    expect(cards).toBeTruthy();
    const cardChildren = Array.from(cards!.children);

    const matchesHeadingIdx = cardChildren.findIndex((el) =>
      el.classList.contains("import-review__matches-heading"),
    );
    const candidateIdx = cardChildren.findIndex(
      (el) =>
        el.classList.contains("import-candidate") && !el.classList.contains("import-candidate--new"),
    );
    const dividerIdx = cardChildren.findIndex((el) =>
      el.classList.contains("import-review__fallback-divider"),
    );
    const newIdx = cardChildren.findIndex((el) => el.classList.contains("import-candidate--new"));

    expect(matchesHeadingIdx).toBeGreaterThanOrEqual(0);
    expect(candidateIdx).toBeGreaterThan(matchesHeadingIdx);
    expect(dividerIdx).toBeGreaterThan(candidateIdx);
    expect(newIdx).toBeGreaterThan(dividerIdx);
  });
});
