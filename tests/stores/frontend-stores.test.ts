import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStatusStore } from "@/stores/status.ts";
import { useStandingsStore } from "@/stores/standings.ts";
import { useImportStore } from "@/stores/import.ts";

vi.mock("@/import/orchestrator.ts", () => ({
  startImport: vi.fn(),
  runMatching: vi.fn(),
  getReviewQueue: vi.fn(() => []),
  resolveReviewEntry: vi.fn(),
  finalizeImport: vi.fn(() => []),
}));

describe("frontend stores", () => {
  beforeEach(() => {
    useStatusStore.setState({ current: null });
    useStandingsStore.setState({
      selectedCategoryKey: null,
      mode: "overview",
      selectedPersonId: null,
      mergeSurvivorTeamId: null,
      mergeAbsorbedTeamId: null,
    });
    useImportStore.getState().resetDraft();
    useImportStore.getState().clearWorkflow();
  });

  it("sets and clears status with timestamp", () => {
    useStatusStore.getState().setStatus({ severity: "info", message: "ok", source: "test" });
    const current = useStatusStore.getState().current;
    expect(current?.message).toBe("ok");
    expect(current?.timestamp).toBeTruthy();
    useStatusStore.getState().clearStatus();
    expect(useStatusStore.getState().current).toBeNull();
  });

  it("maintains standings category and merge selection", () => {
    const store = useStandingsStore.getState();
    store.selectCategory("half_hour:women");
    store.setMergeSurvivor("team-1");
    store.setMergeAbsorbed("team-2");
    expect(useStandingsStore.getState().selectedCategoryKey).toBe("half_hour:women");
    expect(useStandingsStore.getState().mergeSurvivorTeamId).toBe("team-1");
    useStandingsStore.getState().resetMergeSelection();
    expect(useStandingsStore.getState().mergeAbsorbedTeamId).toBeNull();
  });

  it("infers source type and race number from selected filename", () => {
    const file = new File(["data"], "lauf3-mw.xlsx");
    useImportStore.getState().setSelectedFile(file);
    const state = useImportStore.getState();
    expect(state.selectedFileName).toBe("lauf3-mw.xlsx");
    expect(state.raceNo).toBe(3);
    expect(state.sourceType).toBe("singles");
  });

  it("clamps thresholds for fuzzy mode", () => {
    const store = useImportStore.getState();
    store.setMatchingMode("fuzzy_automatik");
    store.setAutoThreshold(-0.2);
    store.setReviewThreshold(-0.3);
    let state = useImportStore.getState();
    expect(state.autoThreshold).toBe(0);
    expect(state.reviewThreshold).toBe(0);

    store.setAutoThreshold(0.6);
    store.setReviewThreshold(0.9);
    state = useImportStore.getState();
    expect(state.autoThreshold).toBe(0.6);
    expect(state.reviewThreshold).toBe(0.6);
  });
});
