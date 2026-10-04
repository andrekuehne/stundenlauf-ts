import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import { buildXlsx } from "./xlsx-test-helpers";

vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return { ...actual, write: vi.fn(actual.write) };
});

afterEach(() => {
  vi.mocked(XLSX.write).mockReset();
});

describe("buildXlsx", () => {
  it("returns only workbook bytes from a Buffer view with unrelated allocation bytes", () => {
    const rows = [
      ["Name", "Verein", "Distanz"],
      ["Müller, Eva", "TSV Süd", "5,2"],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Ergebnisse");
    const workbookBytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Uint8Array;

    const prefixLength = 37;
    const suffixLength = 53;
    // An explicit backing allocation makes this independent of Node's Buffer pool.
    const allocation = new ArrayBuffer(prefixLength + workbookBytes.byteLength + suffixLength);
    const allocationBuffer = Buffer.from(allocation);
    allocationBuffer.fill(0x5a);
    const workbookView = allocationBuffer.subarray(
      prefixLength,
      prefixLength + workbookBytes.byteLength,
    );
    workbookView.set(workbookBytes);
    expect(workbookView.byteOffset).toBe(prefixLength);
    expect(workbookView.byteLength).toBe(workbookBytes.byteLength);
    vi.mocked(XLSX.write).mockReturnValueOnce(workbookView);

    const result = buildXlsx(rows, "Ergebnisse");

    expect(result.byteLength).toBe(workbookBytes.byteLength);
    expect(new Uint8Array(result)).toEqual(new Uint8Array(workbookBytes));
    const parsed = XLSX.read(new Uint8Array(result), { type: "array" });
    expect(parsed.SheetNames).toEqual(["Ergebnisse"]);
    expect(XLSX.utils.sheet_to_json(parsed.Sheets.Ergebnisse!, { header: 1 })).toEqual(rows);
  });

  it("builds a readable workbook with the requested worksheet name", () => {
    const rows = [
      ["Name", "Jahrgang"],
      ["Anna Rauch", 1990],
    ];

    const parsed = XLSX.read(new Uint8Array(buildXlsx(rows, "Lauf 1")), { type: "array" });

    expect(parsed.SheetNames).toEqual(["Lauf 1"]);
    expect(XLSX.utils.sheet_to_json(parsed.Sheets["Lauf 1"]!, { header: 1 })).toEqual(rows);
  });
});
