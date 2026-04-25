import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { projectState } from "@/domain/projection.ts";
import { exportKidsParticipationWorkbook } from "@/export/index.ts";
import {
  defaultEntry,
  importBatchRecorded,
  personRegistered,
  raceRegistered,
  resetSeqCounter,
  teamRegistered,
} from "../helpers/event-factories.ts";

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error ?? new Error("Blob konnte nicht gelesen werden."));
    };
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("Blob wurde nicht als ArrayBuffer gelesen."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsArrayBuffer(blob);
  });
}

async function loadWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await readBlobAsArrayBuffer(blob);
  await workbook.xlsx.load(new Uint8Array(buffer));
  return workbook;
}

function buildKidsState() {
  resetSeqCounter();
  return projectState("season-kids-export", [
    personRegistered({
      person_id: "person-mia",
      given_name: "Mia",
      family_name: "Young",
      display_name: "Mia Young",
      name_normalized: "mia young",
      club: "Kids Club",
      club_normalized: "kids club",
      yob: 2014,
      gender: "F",
    }),
    personRegistered({
      person_id: "person-finn",
      given_name: "Finn",
      family_name: "Able",
      display_name: "Finn Able",
      name_normalized: "finn able",
      club: "Doubles Club",
      club_normalized: "doubles club",
      yob: 2015,
      gender: "M",
    }),
    personRegistered({
      person_id: "person-otto",
      given_name: "Otto",
      family_name: "Older",
      display_name: "Otto Older",
      name_normalized: "otto older",
      club: "Old Club",
      club_normalized: "old club",
      yob: 2013,
      gender: "M",
    }),
    teamRegistered({
      team_id: "team-mia",
      member_person_ids: ["person-mia"],
      team_kind: "solo",
    }),
    teamRegistered({
      team_id: "team-otto",
      member_person_ids: ["person-otto"],
      team_kind: "solo",
    }),
    teamRegistered({
      team_id: "team-mia-finn",
      member_person_ids: ["person-mia", "person-finn"],
      team_kind: "couple",
    }),
    importBatchRecorded({
      import_batch_id: "batch-singles",
      source_file: "singles.xlsx",
      source_sha256: "sha-singles",
    }),
    raceRegistered({
      race_event_id: "race-single-1",
      import_batch_id: "batch-singles",
      category: { duration: "half_hour", division: "women" },
      race_no: 1,
      entries: [
        defaultEntry({
          entry_id: "entry-mia-1",
          team_id: "team-mia",
          distance_m: 3000,
          points: 20,
        }),
        defaultEntry({
          entry_id: "entry-otto-1",
          team_id: "team-otto",
          distance_m: 3200,
          points: 21,
        }),
      ],
    }),
    importBatchRecorded({
      import_batch_id: "batch-doubles",
      source_file: "doubles.xlsx",
      source_sha256: "sha-doubles",
    }),
    raceRegistered({
      race_event_id: "race-double-2",
      import_batch_id: "batch-doubles",
      category: { duration: "hour", division: "couples_mixed" },
      race_no: 2,
      entries: [
        defaultEntry({
          entry_id: "entry-mia-finn-2",
          team_id: "team-mia-finn",
          distance_m: 6200,
          points: 25,
        }),
      ],
    }),
  ]);
}

function buildCrossCategoryDuplicateKidsState() {
  resetSeqCounter();
  return projectState("season-kids-export-duplicate", [
    personRegistered({
      person_id: "person-john-half",
      given_name: "John",
      family_name: "Doe",
      display_name: "John Doe",
      name_normalized: "doe|john",
      club: "First Club",
      club_normalized: "first club",
      yob: 2015,
      gender: "M",
    }),
    personRegistered({
      person_id: "person-john-hour",
      given_name: "Doe",
      family_name: "John",
      display_name: "Doe John",
      name_normalized: "doe|john",
      club: "Second Club",
      club_normalized: "second club",
      yob: 2015,
      gender: "M",
    }),
    teamRegistered({
      team_id: "team-john-half",
      member_person_ids: ["person-john-half"],
      team_kind: "solo",
    }),
    teamRegistered({
      team_id: "team-john-hour",
      member_person_ids: ["person-john-hour"],
      team_kind: "solo",
    }),
    importBatchRecorded({
      import_batch_id: "batch-half",
      source_file: "half.xlsx",
      source_sha256: "sha-half",
    }),
    raceRegistered({
      race_event_id: "race-half-1",
      import_batch_id: "batch-half",
      category: { duration: "half_hour", division: "men" },
      race_no: 1,
      entries: [
        defaultEntry({
          entry_id: "entry-john-half-1",
          team_id: "team-john-half",
          distance_m: 3000,
          points: 20,
        }),
      ],
    }),
    importBatchRecorded({
      import_batch_id: "batch-hour",
      source_file: "hour.xlsx",
      source_sha256: "sha-hour",
    }),
    raceRegistered({
      race_event_id: "race-hour-2",
      import_batch_id: "batch-hour",
      category: { duration: "hour", division: "men" },
      race_no: 2,
      entries: [
        defaultEntry({
          entry_id: "entry-john-hour-2",
          team_id: "team-john-hour",
          distance_m: 6100,
          points: 25,
        }),
      ],
    }),
  ]);
}

function buildSameRaceDuplicateKidsState() {
  resetSeqCounter();
  return projectState("season-kids-export-same-race", [
    personRegistered({
      person_id: "person-alex-a",
      given_name: "Alex",
      family_name: "Same",
      display_name: "Alex Same",
      name_normalized: "alex|same",
      club: "First Club",
      club_normalized: "first club",
      yob: 2016,
      gender: "M",
    }),
    personRegistered({
      person_id: "person-alex-b",
      given_name: "Alex",
      family_name: "Same",
      display_name: "Alex Same",
      name_normalized: "alex|same",
      club: "Second Club",
      club_normalized: "second club",
      yob: 2016,
      gender: "M",
    }),
    teamRegistered({
      team_id: "team-alex-a",
      member_person_ids: ["person-alex-a"],
      team_kind: "solo",
    }),
    teamRegistered({
      team_id: "team-alex-b",
      member_person_ids: ["person-alex-b"],
      team_kind: "solo",
    }),
    importBatchRecorded({
      import_batch_id: "batch-half-same-race",
      source_file: "half-same-race.xlsx",
      source_sha256: "sha-half-same-race",
    }),
    raceRegistered({
      race_event_id: "race-half-same-race",
      import_batch_id: "batch-half-same-race",
      category: { duration: "half_hour", division: "men" },
      race_no: 1,
      entries: [
        defaultEntry({
          entry_id: "entry-alex-a-1",
          team_id: "team-alex-a",
          distance_m: 3000,
          points: 20,
        }),
      ],
    }),
    importBatchRecorded({
      import_batch_id: "batch-hour-same-race",
      source_file: "hour-same-race.xlsx",
      source_sha256: "sha-hour-same-race",
    }),
    raceRegistered({
      race_event_id: "race-hour-same-race",
      import_batch_id: "batch-hour-same-race",
      category: { duration: "hour", division: "men" },
      race_no: 1,
      entries: [
        defaultEntry({
          entry_id: "entry-alex-b-1",
          team_id: "team-alex-b",
          distance_m: 6100,
          points: 25,
        }),
      ],
    }),
  ]);
}

describe("Kids Excel participation export", () => {
  it("renders children only with participation markers across singles and split doubles", async () => {
    const artifact = await exportKidsParticipationWorkbook(buildKidsState(), {
      seasonYear: 2026,
      cutoffYear: 2014,
      filenameBase: "kids-report",
    });

    expect(artifact.filename).toBe("kids-report.xlsx");
    expect(artifact.blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const workbook = await loadWorkbook(artifact.blob);
    const worksheet = workbook.getWorksheet("Kids_Teilnahme");
    if (!worksheet) {
      throw new Error("Kids-Arbeitsblatt fehlt.");
    }

    expect(worksheet.getCell("A1").value).toBe("Kids Excel Saison 2026");
    expect(worksheet.getCell("A2").value).toBe("Name");
    expect(worksheet.getCell("B2").value).toBe("Vorname");
    expect(worksheet.getCell("C2").value).toBe("Jahrg.");
    expect(worksheet.getCell("D2").value).toBe("Verein");
    expect(worksheet.getCell("E2").value).toBe("Lauf 1");
    expect(worksheet.getCell("F2").value).toBe("Lauf 2");

    expect(worksheet.getCell("A3").value).toBe("Able");
    expect(worksheet.getCell("B3").value).toBe("Finn");
    expect(worksheet.getCell("C3").value).toBe("2015");
    expect(worksheet.getCell("D3").value).toBe("Doubles Club");
    expect(worksheet.getCell("E3").value).toBe("—");
    expect(worksheet.getCell("F3").value).toBe("x");

    expect(worksheet.getCell("A4").value).toBe("Young");
    expect(worksheet.getCell("B4").value).toBe("Mia");
    expect(worksheet.getCell("C4").value).toBe("2014");
    expect(worksheet.getCell("D4").value).toBe("Kids Club");
    expect(worksheet.getCell("E4").value).toBe("x");
    expect(worksheet.getCell("F4").value).toBe("x");
    expect(worksheet.getCell("A5").value).toBeNull();

    expect(worksheet.getCell("A2").fill).toMatchObject({
      fgColor: { argb: "FFE8F5E9" },
    });
    expect(worksheet.getCell("A3").border).toMatchObject({
      top: { style: "thin", color: { argb: "FFBDBDBD" } },
    });
  });

  it("merges strict name and year matches across category boundaries", async () => {
    const artifact = await exportKidsParticipationWorkbook(buildCrossCategoryDuplicateKidsState(), {
      seasonYear: 2026,
      cutoffYear: 2014,
      filenameBase: "kids-report",
    });

    const workbook = await loadWorkbook(artifact.blob);
    const worksheet = workbook.getWorksheet("Kids_Teilnahme");
    if (!worksheet) {
      throw new Error("Kids-Arbeitsblatt fehlt.");
    }

    expect(worksheet.getCell("E2").value).toBe("Lauf 1");
    expect(worksheet.getCell("F2").value).toBe("Lauf 2");
    expect(worksheet.getCell("A3").value).toBe("Doe");
    expect(worksheet.getCell("B3").value).toBe("John");
    expect(worksheet.getCell("C3").value).toBe("2015");
    expect(worksheet.getCell("D3").value).toBe("First Club");
    expect(worksheet.getCell("E3").value).toBe("x");
    expect(worksheet.getCell("F3").value).toBe("x");
    expect(worksheet.getCell("A4").value).toBeNull();
  });

  it("does not merge strict matches that participated in the same race", async () => {
    const artifact = await exportKidsParticipationWorkbook(buildSameRaceDuplicateKidsState(), {
      seasonYear: 2026,
      cutoffYear: 2014,
      filenameBase: "kids-report",
    });

    const workbook = await loadWorkbook(artifact.blob);
    const worksheet = workbook.getWorksheet("Kids_Teilnahme");
    if (!worksheet) {
      throw new Error("Kids-Arbeitsblatt fehlt.");
    }

    expect(worksheet.getCell("E2").value).toBe("Lauf 1");
    expect(worksheet.getCell("A3").value).toBe("Same");
    expect(worksheet.getCell("B3").value).toBe("Alex");
    expect(worksheet.getCell("D3").value).toBe("First Club");
    expect(worksheet.getCell("E3").value).toBe("x");
    expect(worksheet.getCell("A4").value).toBe("Same");
    expect(worksheet.getCell("B4").value).toBe("Alex");
    expect(worksheet.getCell("D4").value).toBe("Second Club");
    expect(worksheet.getCell("E4").value).toBe("x");
    expect(worksheet.getCell("A5").value).toBeNull();
  });
});
