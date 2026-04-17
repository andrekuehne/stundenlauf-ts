import { expect, it } from "vitest";

it("allows unrelated console errors so warning guard stays scoped", () => {
  expect(() => {
    console.error("non-act diagnostic");
  }).not.toThrow();
});
