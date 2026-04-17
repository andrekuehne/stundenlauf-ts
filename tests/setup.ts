import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

const ACT_WARNING_PATTERN = /not wrapped in act|inside a test was not wrapped in act/i;
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const message = args.map((value) => String(value)).join(" ");
    if (ACT_WARNING_PATTERN.test(message)) {
      throw new Error(`React act warning detected: ${message}`);
    }
  });
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = null;
});
