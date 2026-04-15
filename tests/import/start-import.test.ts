import { describe, expect, it, vi } from "vitest";

const parseWorkbookMock = vi.fn();
const validateImportMock = vi.fn();
const createSessionMock = vi.fn();

vi.mock("@/ingestion/parse-workbook.ts", () => ({
  parseWorkbook: (...args: unknown[]) => parseWorkbookMock(...args),
}));
vi.mock("@/import/validate.ts", () => ({
  validateImport: (...args: unknown[]) => validateImportMock(...args),
}));
vi.mock("@/import/session.ts", () => ({
  createSession: (...args: unknown[]) => createSessionMock(...args),
}));

describe("startImport", () => {
  it("throws validation error when import is invalid", async () => {
    parseWorkbookMock.mockResolvedValueOnce({ parsed: true });
    validateImportMock.mockReturnValueOnce({ valid: false, message: "Ungültig" });
    const { startImport } = await import("@/import/start-import.ts");
    await expect(startImport(new File(["x"], "test.xlsx"), { season_id: "s1" } as never)).rejects.toThrow("Ungültig");
  });

  it("creates session from parsed workbook when valid", async () => {
    parseWorkbookMock.mockResolvedValueOnce({ parsed: true });
    validateImportMock.mockReturnValueOnce({ valid: true });
    createSessionMock.mockReturnValueOnce({ id: "session-1" });
    const { startImport } = await import("@/import/start-import.ts");
    const result = await startImport(new File(["x"], "test.xlsx"), { season_id: "s1" } as never);
    expect(result).toEqual({ id: "session-1" });
    expect(createSessionMock).toHaveBeenCalledWith({ parsed: true }, expect.any(Object));
  });
});
