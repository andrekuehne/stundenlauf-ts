import { describe, expect, it } from "vitest";
import { exportCategoryLabel, effectiveCategoryKeys, buildExportSections } from "@/export/projection.ts";

describe("projection direct helpers", () => {
  it("collects only effective category keys", () => {
    const state = {
      race_events: new Map([
        ["r1", { category: { duration: "hour", division: "men" } }],
        ["r2", { category: { duration: "half_hour", division: "women" } }],
      ]),
      import_batches: new Map([
        ["b1", { state: "active" }],
      ]),
    } as never;
    const keys = effectiveCategoryKeys(state);
    expect(keys).toContain("hour:men");
  });

  it("formats known category labels", () => {
    expect(exportCategoryLabel("hour:men")).toContain("Stundenlauf");
  });

  it("throws for unknown export category in spec", () => {
    const state = {
      race_events: new Map(),
      import_batches: new Map(),
      teams: new Map(),
      persons: new Map(),
      exclusions: new Map(),
    } as never;
    const spec = {
      categories: ["invalid"],
      pdf: { tableLayout: "flat", title: "", subtitle: "", laufuebersichtSectionNumberStart: 1, laufuebersichtShowCover: false },
      rows: { eligibility: "eligible_only" },
      columns: ["platz"],
    } as never;
    expect(() => buildExportSections(state, spec, { seasonYear: 2026 })).toThrow(/Unknown export category key/);
  });
});
