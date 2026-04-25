import { describe, expect, it } from "vitest";
import { extractSeasonYearFromLabel, resolveSeasonYear } from "@/domain/season-year.ts";

describe("season year helpers", () => {
  it("extracts an explicit year from the season label", () => {
    expect(extractSeasonYearFromLabel("Stundenlauf 2026")).toBe(2026);
    expect(extractSeasonYearFromLabel("Saison 2025/2026")).toBe(2025);
  });

  it("returns null when the label does not contain a four-digit season year", () => {
    expect(extractSeasonYearFromLabel("Frühjahr")).toBeNull();
    expect(extractSeasonYearFromLabel("Saison 26")).toBeNull();
  });

  it("falls back to the descriptor creation year when the label has no explicit year", () => {
    expect(resolveSeasonYear("Frühjahr", "2027-03-10T12:00:00.000Z")).toBe(2027);
  });
});
