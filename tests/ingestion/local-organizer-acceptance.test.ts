/** Optional actual-workbook pipeline acceptance; CI skips it without private files. */
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { categoryKey, projectState } from "@/domain/projection.ts";
import type { RaceEntry } from "@/domain/types.ts";
import {
  exportGesamtwertungWorkbook,
  exportKidsParticipationWorkbook,
  exportLaufuebersichtDualPdfs,
} from "@/export/index.ts";
import { buildSeasonArchive } from "@/portability/export-season.ts";
import { importSeason, readSeasonArchive } from "@/portability/import-season.ts";
import { computeStandings } from "@/ranking/engine.ts";

import {
  blobBytes,
  importOrganizerSeason,
  OrganizerMemoryRepository,
  privateDigest,
  readOrganizerFixture,
} from "./local-organizer-acceptance.ts";
import {
  fixtureBasename,
  isCouplesFixtureBasename,
  isSinglesFixtureBasename,
  listLocalXlsxRelativePaths,
} from "./local-xlsx-fixture-discovery.ts";

const paths = listLocalXlsxRelativePaths().filter((rel) => {
  const name = fixtureBasename(rel);
  return isSinglesFixtureBasename(name) || isCouplesFixtureBasename(name);
});

describe.skipIf(paths.length === 0)("local organizer source-to-artifact acceptance", () => {
  it("preserves source values through matching, top-four rankings, exports and a new archive", async () => {
    const fixtures = await Promise.all(paths.map(readOrganizerFixture));
    const { repository, season, events, state, standings } = await importOrganizerSeason(fixtures);
    const expectedRowCount = fixtures.reduce(
      (count, fixture) =>
        count +
        [...fixture.singles, ...fixture.couples].reduce(
          (rows, section) => rows + section.rows.length,
          0,
        ),
      0,
    );
    const races = [...state.race_events.values()];
    expect(races.reduce((count, race) => count + race.entries.length, 0)).toBe(expectedRowCount);
    expect(state.import_batches.size).toBe(fixtures.length);
    let automaticMatches = 0;
    let checkedRegisteredPeople = 0;
    const sourceByRaceEntry = new Map<string, { points: number; distance_m: number }>();

    for (const fixture of fixtures) {
      const batch = [...state.import_batches.values()].find(
        (entry) => entry.source_sha256 === fixture.sha256,
      );
      expect(batch != null).toBe(true);
      const actualRaces = races.filter((race) => race.import_batch_id === batch?.import_batch_id);
      expect(actualRaces.length).toBe(fixture.singles.length + fixture.couples.length);
      const cleanText = (value: string) => value.trim().replace(/\s+/gu, " ");
      const sourceIdentities = new Set([
        ...fixture.singles.flatMap((section) =>
          section.rows.map((row) =>
            privateDigest([cleanText(row.name), row.yob, row.club ? cleanText(row.club) : null]),
          ),
        ),
        ...fixture.couples.flatMap((section) =>
          section.rows.flatMap((row) => [
            privateDigest([
              cleanText(row.name_a),
              row.yob_a,
              row.club_a ? cleanText(row.club_a) : null,
            ]),
            privateDigest([
              cleanText(row.name_b),
              row.yob_b,
              row.club_b ? cleanText(row.club_b) : null,
            ]),
          ]),
        ),
      ]);
      for (const event of events) {
        if (
          event.type !== "person.registered" ||
          event.metadata.import_batch_id !== batch?.import_batch_id
        )
          continue;
        const person = state.persons.get(event.payload.person_id);
        expect(person != null).toBe(true);
        checkedRegisteredPeople += 1;
        expect(
          sourceIdentities.has(privateDigest([person?.display_name, person?.yob, person?.club])),
        ).toBe(true);
      }
      // The registration oracle also covers every new person, so lost batch
      // metadata cannot silently skip the identity-value checks.
      for (const section of [...fixture.singles, ...fixture.couples]) {
        const race = actualRaces.find(
          (candidate) =>
            candidate.race_no === section.context.race_no &&
            candidate.category.duration === section.context.duration &&
            candidate.category.division === section.context.division,
        );
        expect(race != null).toBe(true);
        if (!race) throw new Error("Organizer acceptance: expected imported category missing");
        expect(race.entries.length).toBe(section.rows.length);
        section.rows.forEach((row, index) => {
          const entry = race.entries[index];
          expect(entry != null).toBe(true);
          if (!entry) throw new Error("Organizer acceptance: expected imported row missing");
          const couple = "name_a" in row;
          const names = couple ? [row.name_a, row.name_b] : [row.name];
          const yobs = couple ? [row.yob_a, row.yob_b] : [row.yob];
          const clubs = couple ? [row.club_a, row.club_b] : [row.club];
          const expected = [
            row.startnr,
            names.join(" / "),
            couple ? yobs.join(" / ") : yobs[0],
            couple ? clubs.filter(Boolean).join(" / ") || null : clubs[0],
            Math.round(row.distance_km * 1000),
            row.points,
          ];
          const team = state.teams.get(entry.team_id);
          expect(team != null).toBe(true);
          expect(team?.team_kind).toBe(couple ? "couple" : "solo");
          expect(team?.member_person_ids.length).toBe(couple ? 2 : 1);
          const members = team?.member_person_ids.map((id) => state.persons.get(id));
          expect(privateDigest(members?.map((person) => person?.yob).sort())).toBe(
            privateDigest([...yobs].sort()),
          );
          if (entry.resolution.method === "new_identity") {
            expect(
              privateDigest(
                members?.map((person) => [person?.display_name, person?.yob, person?.club]),
              ),
            ).toBe(
              privateDigest(
                names.map((name, memberIndex) => [
                  cleanText(name),
                  yobs[memberIndex],
                  clubs[memberIndex] ? cleanText(clubs[memberIndex]) : null,
                ]),
              ),
            );
          }
          const actual = [
            entry.startnr,
            entry.incoming.display_name,
            couple ? entry.incoming.yob_text : entry.incoming.yob,
            entry.incoming.club,
            entry.distance_m,
            entry.points,
          ];
          expect(privateDigest(actual)).toBe(privateDigest(expected));
          if (entry.resolution.method === "auto") automaticMatches += 1;
          sourceByRaceEntry.set(entry.entry_id, {
            points: row.points,
            distance_m: Math.round(row.distance_km * 1000),
          });
        });
      }
    }
    expect(checkedRegisteredPeople).toBe(state.persons.size);
    // Optional files can contain a single race; repeated organizer runs exercise matching.
    if (new Set(fixtures.map((fixture) => fixture.raceNo)).size > 1) {
      expect(automaticMatches).toBeGreaterThan(0);
    }

    const tables = computeStandings(state, undefined, "2026-10-17T00:00:00.000Z");
    const expectedCategoryKeys = [
      ...new Set(
        fixtures.flatMap((fixture) =>
          [...fixture.singles, ...fixture.couples].map(
            (section) => `${section.context.duration}:${section.context.division}`,
          ),
        ),
      ),
    ].sort();
    expect(tables.category_tables.map((table) => table.category_key).sort()).toEqual(
      expectedCategoryKeys,
    );
    expect(Object.keys(standings.rowsByCategory).sort()).toEqual(expectedCategoryKeys);
    for (const table of tables.category_tables) {
      const contributions = new Map<string, { raceId: string; entry: RaceEntry }[]>();
      for (const race of races.filter(
        (candidate) => categoryKey(candidate.category) === table.category_key,
      )) {
        for (const entry of race.entries) {
          contributions.set(entry.team_id, [
            ...(contributions.get(entry.team_id) ?? []),
            { raceId: race.race_event_id, entry },
          ]);
        }
      }
      // Independent arithmetic from the verified source, without aggregateTopN.
      const expected = [...contributions]
        .map(([teamId, rows]) => {
          const selected = [...rows]
            .sort((a, b) => {
              const pointsDifference = b.entry.points - a.entry.points;
              return pointsDifference || (a.raceId < b.raceId ? -1 : 1);
            })
            .slice(0, 4);
          return {
            teamId,
            points: selected.reduce(
              (sum, { entry }) => sum + (sourceByRaceEntry.get(entry.entry_id)?.points ?? NaN),
              0,
            ),
            distance: selected.reduce(
              (sum, { entry }) => sum + (sourceByRaceEntry.get(entry.entry_id)?.distance_m ?? NaN),
              0,
            ),
            selected: selected.map(({ raceId }) => raceId).sort(),
          };
        })
        .sort(
          (a, b) =>
            b.points - a.points || b.distance - a.distance || (a.teamId < b.teamId ? -1 : 1),
        );
      expect(
        privateDigest(
          table.rows.map((row) => [
            row.team_id,
            row.total_points,
            row.total_distance_m,
            row.rank,
            row.race_contributions
              .filter((race) => race.counts_toward_total)
              .map((race) => race.race_event_id)
              .sort(),
          ]),
        ),
      ).toBe(
        privateDigest(
          expected.map((row, index) => [
            row.teamId,
            row.points,
            row.distance,
            index + 1,
            row.selected,
          ]),
        ),
      );
      const apiRows = standings.rowsByCategory[table.category_key] ?? [];
      expect(
        privateDigest(
          apiRows.map((row) => [
            row.teamId,
            row.points,
            Math.round(row.distanceKm * 1000),
            row.rank,
          ]),
        ),
      ).toBe(
        privateDigest(
          expected.map((row, index) => [row.teamId, row.points, row.distance, index + 1]),
        ),
      );
    }

    const options = { seasonYear: 2026, filenameBase: "organizer-acceptance" };
    const workbookArtifact = await exportGesamtwertungWorkbook(state, options);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await blobBytes(workbookArtifact.blob)).buffer as ArrayBuffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Gesamtwertung_Einzel",
      "Gesamtwertung_Paare",
    ]);
    expect(workbook.worksheets.every((sheet) => sheet.rowCount > 0)).toBe(true);
    for (const sheet of workbook.worksheets) {
      const couples = sheet.name.endsWith("Paare");
      const expectedRows = tables.category_tables
        .filter((table) => table.category_key.includes("couples_") === couples)
        .flatMap((table) =>
          table.rows.map((row) => {
            const team = state.teams.get(row.team_id);
            const members = team?.member_person_ids.map((id) => state.persons.get(id)) ?? [];
            const identity = members.flatMap((person) => [
              person?.display_name,
              String(person?.yob),
              person?.club || "—",
            ]);
            const raceNos = [
              ...new Set(
                races
                  .filter((race) => categoryKey(race.category) === table.category_key)
                  .map((race) => race.race_no),
              ),
            ].sort((a, b) => a - b);
            const cells = raceNos.flatMap((raceNo) => {
              const race = races.find(
                (candidate) =>
                  categoryKey(candidate.category) === table.category_key &&
                  candidate.race_no === raceNo,
              );
              const contribution = row.race_contributions.find(
                (candidate) => candidate.race_event_id === race?.race_event_id,
              );
              return contribution
                ? [
                    (contribution.distance_m / 1000).toFixed(3).replace(".", ","),
                    String(contribution.points),
                  ]
                : ["—", "—"];
            });
            return privateDigest([
              String(row.rank),
              ...identity,
              ...cells,
              (row.total_distance_m / 1000).toFixed(3).replace(".", ","),
              String(row.total_points),
            ]);
          }),
        )
        .sort();
      const actualRows: string[] = [];
      sheet.eachRow((row) => {
        if (!/^\d+$/.test(row.getCell(1).text)) return;
        const values = Array.from(
          { length: couples ? 7 : 4 },
          (_, index) => row.getCell(index + 1).text,
        );
        // Each section can contain a different set of run columns. Its last
        // populated cells are the total distance and points, followed by blanks.
        for (let column = values.length + 1; column <= row.cellCount; column += 1)
          values.push(row.getCell(column).text);
        while (values.at(-1) === "") values.pop();
        actualRows.push(privateDigest(values));
      });
      expect(privateDigest(actualRows.sort())).toBe(privateDigest(expectedRows));
    }
    const kidsArtifact = await exportKidsParticipationWorkbook(state, options);
    const kids = new ExcelJS.Workbook();
    await kids.xlsx.load((await blobBytes(kidsArtifact.blob)).buffer as ArrayBuffer);
    expect(kids.worksheets[0]?.getCell("A1").text).toBe("Kids Excel Saison 2026");
    for (const artifact of exportLaufuebersichtDualPdfs(state, options)) {
      const bytes = await blobBytes(artifact.blob);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(bytes.byteLength).toBeGreaterThan(1000);
    }

    const archive = await buildSeasonArchive(repository, season.seasonId);
    const archiveFile = new File([new Uint8Array(archive.zip_bytes)], archive.filename);
    Object.defineProperty(archiveFile, "arrayBuffer", {
      value: () => Promise.resolve(new Uint8Array(archive.zip_bytes).buffer),
    });
    const parsedArchive = await readSeasonArchive(archiveFile);
    expect(privateDigest(parsedArchive.events)).toBe(privateDigest(events));
    expect(parsedArchive.season_id).toBe(season.seasonId);
    expect(parsedArchive.label).toBe(season.label);
    const restoredRepository = new OrganizerMemoryRepository();
    await importSeason(restoredRepository, archiveFile);
    const restoredEvents = await restoredRepository.getEventLog(season.seasonId);
    expect(privateDigest(restoredEvents)).toBe(privateDigest(events));
    expect(
      privateDigest(
        computeStandings(
          projectState(season.seasonId, restoredEvents),
          undefined,
          tables.calculated_at,
        ),
      ),
    ).toBe(privateDigest(tables));
  }, 60_000);
});
