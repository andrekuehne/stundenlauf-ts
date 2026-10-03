import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import ExcelJS from "exceljs";
import JSZip from "jszip";

import type { DomainEvent } from "../../src/domain/events.ts";

interface ArchiveSnapshot {
  manifest: {
    season_id: string;
    label: string;
    events_total: number;
    last_event_seq: number;
    sha256_eventlog: string;
  };
  eventlog: { season_id: string; label: string; events: DomainEvent[] };
}

export async function readArchive(bytes: Buffer, label: string): Promise<ArchiveSnapshot> {
  const zip = await JSZip.loadAsync(bytes);
  expect(Object.keys(zip.files).sort()).toEqual(["eventlog.json", "manifest.json"]);
  const manifestFile = zip.file("manifest.json");
  const eventlogFile = zip.file("eventlog.json");
  expect(manifestFile).not.toBeNull();
  expect(eventlogFile).not.toBeNull();
  if (!manifestFile || !eventlogFile) throw new Error("Missing season archive entries");
  const manifest = JSON.parse(await manifestFile.async("text")) as ArchiveSnapshot["manifest"] & {
    format: string;
    format_version: number;
    eventlog_format_version: number;
  };
  const eventlogBytes = await eventlogFile.async("nodebuffer");
  const eventlog = JSON.parse(eventlogBytes.toString("utf8")) as ArchiveSnapshot["eventlog"] & {
    format: string;
    format_version: number;
  };
  expect(manifest.format).toBe("stundenlauf-ts-season-archive");
  expect(manifest.format_version).toBe(1);
  expect(eventlog.format).toBe("stundenlauf-ts-eventlog");
  expect(eventlog.format_version).toBe(manifest.eventlog_format_version);
  expect(manifest.label).toBe(label);
  expect(eventlog.label).toBe(label);
  expect(eventlog.season_id).toBe(manifest.season_id);
  expect(manifest.events_total).toBe(eventlog.events.length);
  expect(manifest.last_event_seq).toBe(eventlog.events.at(-1)?.seq);
  expect(createHash("sha256").update(eventlogBytes).digest("hex")).toBe(manifest.sha256_eventlog);
  const persons = eventlog.events.filter((event) => event.type === "person.registered");
  expect(persons.map((event) => event.payload.display_name).sort()).toEqual([
    "Anna Rauch",
    "Eva Müller",
  ]);
  const batches = eventlog.events.filter((event) => event.type === "import_batch.recorded");
  expect(batches.map((event) => event.payload.source_file)).toEqual([
    "Ergebnisliste MW Lauf 1.xlsx",
    "Ergebnisliste MW Lauf 2.xlsx",
  ]);
  const races = eventlog.events.filter((event) => event.type === "race.registered");
  expect(races.map((event) => event.payload.race_no)).toEqual([1, 2]);
  expect(
    races.map((event) => event.payload.entries.map((entry) => [entry.distance_m, entry.points])),
  ).toEqual([
    [
      [5200, 100],
      [4800, 95],
    ],
    [
      [5300, 100],
      [4900, 95],
    ],
  ]);
  return { manifest, eventlog };
}

export async function validateExcel(bytes: Buffer): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(bytes).buffer);
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "Gesamtwertung_Einzel",
    "Gesamtwertung_Paare",
  ]);
  const sheet = workbook.getWorksheet("Gesamtwertung_Einzel");
  if (!sheet) throw new Error("Singles result worksheet is absent");
  expect(sheet.getCell("A1").value).toBe("1. Halbstundenlauf - Frauen");
  const expectedRows = [
    ["1", "Anna Rauch", "1990", "TSV Süd", "5,200", "100", "5,300", "100", "10,500", "200"],
    ["2", "Eva Müller", "1992", "—", "4,800", "95", "4,900", "95", "9,700", "190"],
  ];
  for (const [offset, expected] of expectedRows.entries()) {
    expect(
      Array.from(
        { length: expected.length },
        (_, index) => sheet.getRow(5 + offset).getCell(index + 1).value,
      ),
    ).toEqual(expected);
  }
}

export function validatePdf(bytes: Buffer): void {
  const text = bytes.toString("latin1");
  expect(text).toMatch(/^%PDF-1\.[0-9]/);
  expect(text.trimEnd()).toMatch(/%%EOF$/);
  const xrefMatch = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
  expect(xrefMatch).not.toBeNull();
  if (!xrefMatch) throw new Error("PDF cross-reference pointer is absent");
  expect(text.slice(Number(xrefMatch[1]))).toMatch(/^xref\s/);
  expect(text).toMatch(/\/Type\s*\/Catalog\b/);
  expect(text.match(/\/Type\s*\/Page\b/g)?.length).toBeGreaterThan(0);
  expect(text).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+[1-9][\d.]*\s+[1-9][\d.]*\s*\]/);
  // Current jsPDF export uses uncompressed literal text streams with standard fonts.
  // Require actual text operators; metadata-only or empty/corrupt files cannot pass.
  const streams = [...text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((match) => match[1] ?? "")
    .join("\n");
  expect(streams).toMatch(/\)\s*Tj/);
  for (const value of [
    "Anna Rauch",
    "Eva Müller",
    "TSV Süd",
    "10,500",
    "9,700",
    "200",
    "190",
    "2026",
  ]) {
    expect(streams).toContain(value);
  }
}
