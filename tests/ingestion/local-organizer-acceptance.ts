/**
 * Optional, local-only organizer acceptance helpers. Read source cells with ExcelJS,
 * independently of the production SheetJS importer. Never print participant data:
 * callers compare digests and aggregate counts, including on failure.
 *
 * These checks establish source fidelity and a deterministic matching/ranking QA
 * scenario. They do not supply organizer-approved identity decisions or results.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

import { rememberImportFile } from "@/api/import-file-registry.ts";
import { createTsAppApi } from "@/api/ts/index.ts";
import type { DomainEvent } from "@/domain/events.ts";
import { projectState } from "@/domain/projection.ts";
import type { Division, RaceDuration, SeasonDescriptor } from "@/domain/types.ts";
import type {
  ImportRowCouples,
  ImportRowSingles,
  ParsedSectionCouples,
  ParsedSectionSingles,
} from "@/ingestion/types.ts";
import {
  setSeasonRepositoryForTests,
  type SeasonRepository,
} from "@/services/season-repository.ts";

import {
  LOCAL_XLSX_FIXTURE_ROOT,
  fixtureBasename,
  isCouplesFixtureBasename,
} from "./local-xlsx-fixture-discovery.ts";

export function privateDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function acceptanceCheck(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Organizer acceptance: ${message}`);
}

function sourceText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  acceptanceCheck(
    value == null || typeof value === "string" || typeof value === "number",
    "source has an unsupported cell type (no participant values logged)",
  );
  return value == null ? "" : String(value).trim();
}

function sourceNumber(cell: ExcelJS.Cell, emptyValue?: number): number {
  const text = sourceText(cell);
  if (!text && emptyValue != null) return emptyValue;
  acceptanceCheck(/^\d+(?:[.,]\d+)?$/.test(text), "source number is not decimal");
  return Number(text.replace(",", "."));
}

function sourceClub(cell: ExcelJS.Cell): string | null {
  const text = sourceText(cell);
  return /[\p{L}\p{N}]/u.test(text) ? text : null;
}

export interface OrganizerFixture {
  relPath: string;
  buffer: ArrayBuffer;
  sha256: string;
  raceNo: number;
  singles: ParsedSectionSingles[];
  couples: ParsedSectionCouples[];
}

export async function readOrganizerFixture(relPath: string): Promise<OrganizerFixture> {
  const buffer = new Uint8Array(readFileSync(join(LOCAL_XLSX_FIXTURE_ROOT, relPath))).buffer;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  acceptanceCheck(sheet != null, "source sheet is missing");
  const couples = isCouplesFixtureBasename(fixtureBasename(relPath));
  const raceMatch = /(?:MW_|MW_Paare_)(\d+)\.xlsx$/i.exec(fixtureBasename(relPath));
  const laufMatch = /Lauf\s+(\d+)/i.exec(fixtureBasename(relPath));
  const raceNo = Number(raceMatch?.[1] ?? laufMatch?.[1]);
  acceptanceCheck(Number.isInteger(raceNo) && raceNo > 0, "source race number is missing");
  const fixture: OrganizerFixture = {
    relPath,
    buffer,
    sha256: createHash("sha256").update(new Uint8Array(buffer)).digest("hex"),
    raceNo,
    singles: [],
    couples: [],
  };
  let duration: RaceDuration | null = null;
  let division: Division | null = null;
  let singlesRows: ImportRowSingles[] = [];
  let couplesRows: ImportRowCouples[] = [];
  function flush(): void {
    if (!duration || !division) return;
    const context = { race_no: raceNo, duration, division, event_date: null };
    if (singlesRows.length) fixture.singles.push({ context, rows: singlesRows });
    if (couplesRows.length) fixture.couples.push({ context, rows: couplesRows });
    singlesRows = [];
    couplesRows = [];
  }
  // Literal organizer labels are the reference, not production parser constants.
  const divisions: Readonly<Record<string, Division>> = couples
    ? {
        "Paare Frauen": "couples_women",
        "Paare Männer": "couples_men",
        "Paare Mix": "couples_mixed",
      }
    : { Frauen: "women", Männer: "men" };
  for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
    const row = sheet.getRow(rowNo);
    const marker = sourceText(row.getCell(1));
    if (marker === "1/2 h-Lauf" || marker === "h-Lauf") {
      flush();
      duration = marker === "1/2 h-Lauf" ? "half_hour" : "hour";
      division = null;
      continue;
    }
    const sectionDivision = divisions[marker];
    if (sectionDivision) {
      flush();
      division = sectionDivision;
      continue;
    }
    const name = sourceText(row.getCell(3));
    if (!name) continue;
    acceptanceCheck(duration != null && division != null, "source row has no category context");
    if (couples) {
      const nameB = sourceText(row.getCell(6));
      acceptanceCheck(nameB.length > 0, "source couple is missing a member");
      couplesRows.push({
        startnr: sourceText(row.getCell(2)),
        name_a: name,
        yob_a: sourceNumber(row.getCell(4), 1900),
        club_a: sourceClub(row.getCell(5)),
        name_b: nameB,
        yob_b: sourceNumber(row.getCell(7), 1900),
        club_b: sourceClub(row.getCell(8)),
        distance_km: sourceNumber(row.getCell(9)),
        points: sourceNumber(row.getCell(11)),
      });
    } else {
      singlesRows.push({
        startnr: sourceText(row.getCell(2)),
        name,
        yob: sourceNumber(row.getCell(4)),
        club: sourceClub(row.getCell(5)),
        distance_km: sourceNumber(row.getCell(6)),
        points: sourceNumber(row.getCell(8)),
      });
    }
  }
  flush();
  acceptanceCheck(fixture.singles.length + fixture.couples.length > 0, "source has no results");
  return fixture;
}

export class OrganizerMemoryRepository implements SeasonRepository {
  private readonly seasons = new Map<string, SeasonDescriptor>();
  private readonly logs = new Map<string, DomainEvent[]>();
  listSeasons(): Promise<SeasonDescriptor[]> {
    return Promise.resolve([...this.seasons.values()]);
  }
  getSeason(id: string): Promise<SeasonDescriptor | null> {
    return Promise.resolve(this.seasons.get(id) ?? null);
  }
  async createSeason(label: string): Promise<SeasonDescriptor> {
    const season = { season_id: crypto.randomUUID(), label, created_at: new Date().toISOString() };
    await this.saveImportedSeason(season, []);
    return season;
  }
  deleteSeason(id: string): Promise<void> {
    this.seasons.delete(id);
    this.logs.delete(id);
    return Promise.resolve();
  }
  getEventLog(id: string): Promise<DomainEvent[]> {
    return Promise.resolve([...(this.logs.get(id) ?? [])]);
  }
  appendEvents(id: string, events: DomainEvent[]): Promise<void> {
    this.logs.set(id, [...(this.logs.get(id) ?? []), ...events]);
    return Promise.resolve();
  }
  clearEventLog(id: string): Promise<void> {
    this.logs.set(id, []);
    return Promise.resolve();
  }
  saveImportedSeason(season: SeasonDescriptor, events: DomainEvent[]): Promise<void> {
    this.seasons.set(season.season_id, season);
    this.logs.set(season.season_id, [...events]);
    return Promise.resolve();
  }
}

export async function importOrganizerSeason(fixtures: readonly OrganizerFixture[]) {
  const repository = new OrganizerMemoryRepository();
  setSeasonRepositoryForTests(repository);
  try {
    const api = createTsAppApi();
    const season = await api.createSeason({ label: "Organizer acceptance 2026" });
    let reviewsCreatedNew = 0;
    const reviewCases: {
      sourceFile: string;
      raceNo: number;
      category: "singles" | "doubles";
      startNumber: number;
      candidateCount: number;
      candidateConfidences: number[];
    }[] = [];
    for (const fixture of fixtures) {
      const file = new File([fixture.buffer], fixture.relPath, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      // jsdom's File does not implement arrayBuffer; use an exact byte copy.
      Object.defineProperty(file, "arrayBuffer", {
        value: () => Promise.resolve(fixture.buffer.slice(0)),
      });
      rememberImportFile(file);
      const draft = await api.createImportDraft({
        seasonId: season.seasonId,
        fileName: fixture.relPath,
        category: fixture.couples.length ? "doubles" : "singles",
        raceNumber: fixture.raceNo,
        matchingConfig: {
          autoMin: 1,
          reviewMin: 0.5,
          autoMergeEnabled: false,
          perfectMatchAutoMerge: true,
          strictNormalizedAutoOnly: true,
        },
      });
      // Deliberately conservative QA scenario: ambiguous matches create new
      // identities. This is not an adjudication of organizer review decisions.
      for (const review of draft.reviewItems) {
        reviewCases.push({
          sourceFile: fixture.relPath,
          raceNo: fixture.raceNo,
          category: fixture.couples.length ? "doubles" : "singles",
          startNumber: review.incoming.startNumber,
          candidateCount: review.candidates.length,
          candidateConfidences: review.candidates.map((candidate) => candidate.confidence),
        });
        await api.setImportReviewDecision(draft.draftId, {
          reviewId: review.reviewId,
          candidateId: null,
          action: "create_new",
        });
        reviewsCreatedNew += 1;
      }
      const result = await api.finalizeImportDraft(draft.draftId);
      acceptanceCheck(result.severity === "success", "real import API failed");
    }
    const events = await repository.getEventLog(season.seasonId);
    const state = projectState(season.seasonId, events);
    const standings = await api.getStandings(season.seasonId);
    return { repository, season, events, state, standings, reviewsCreatedNew, reviewCases };
  } finally {
    setSeasonRepositoryForTests(null);
  }
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Organizer acceptance: cannot read artifact blob"));
    };
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(new Uint8Array(reader.result));
      else reject(new Error("Organizer acceptance: unexpected artifact blob result"));
    };
    reader.readAsArrayBuffer(blob);
  });
}
