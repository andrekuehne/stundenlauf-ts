import * as XLSX from "xlsx";

export function syntheticSingles(race: 1 | 2) {
  const rows = [
    ["Platz", "Startnr.", "Name", "Jahrg.", "Verein", "Distanz", "Rückstand", "Punkte"],
    ["1/2 h-Lauf"],
    ["Frauen"],
    [
      1,
      "11",
      race === 1 ? "Anna Rauch" : "Anna Roth",
      1990,
      "TSV Süd",
      race === 1 ? "5,2" : "5,3",
      "",
      "100",
    ],
    [],
    [2, "12", "Eva Müller", 1992, "", race === 1 ? "4,8" : "4,9", "", "95"],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Ergebnisse");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  return {
    name: `Ergebnisliste MW Lauf ${race}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(new Uint8Array(bytes)),
  };
}
