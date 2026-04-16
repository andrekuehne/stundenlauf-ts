import { describe, expect, it } from "vitest";
import { splitPairToken } from "@/features/import/split-pair-token.ts";

describe("splitPairToken", () => {
  it("splits common pair separators", () => {
    expect(splitPairToken("Lea + Tom")).toEqual(["Lea", "Tom"]);
    expect(splitPairToken("A / B")).toEqual(["A", "B"]);
    expect(splitPairToken("1992 / 1990")).toEqual(["1992", "1990"]);
    expect(splitPairToken("Eins und Zwei")).toEqual(["Eins", "Zwei"]);
  });

  it("returns a single token when no delimiter is found", () => {
    expect(splitPairToken("Solo")).toEqual(["Solo", "—"]);
  });
});
