import { expect, it } from "vitest";

it("allows unrelated console errors so warning guard stays scoped", () => {
  expect(() => {
    console.error("non-act diagnostic");
  }).not.toThrow();
});

it.each([
  ["An update to %s inside a test was not wrapped in act(...).", "SeasonPage"],
  ["Warning: A component update was not wrapped in act(...).", "ImportPage"],
])("rejects React act warnings with formatted console arguments: %s", (message, component) => {
  expect(() => {
    console.error(message, component);
  }).toThrow("React act warning detected:");
});
