import { describe, expect, it } from "vitest";
import { emptySeasonState } from "@/domain/projection.ts";
import { emptyImportReport } from "@/import/report.ts";
import { getReviewQueue, resolveReviewEntry } from "@/import/review.ts";
import type {
  ImportSession,
  OrchestratedReviewEntry,
  OrchestratedSection,
  StagedEntry,
} from "@/import/types.ts";
import type { ImportRowCouples, ParsedWorkbook } from "@/ingestion/types.ts";

function makeStaged(overrides?: Partial<StagedEntry>): StagedEntry {
  return {
    entry_id: "entry-1",
    startnr: "1",
    team_id: null,
    distance_m: 10000,
    points: 10,
    incoming: {
      display_name: "Müller, Max",
      yob: 1990,
      yob_text: null,
      club: "LG Test",
      row_kind: "solo",
      sheet_name: "test.xlsx",
      section_name: "Herren 60min",
      row_index: 0,
    },
    resolution: null,
    review_routing: "review",
    ...overrides,
  };
}

function makeReviewEntry(
  staged: StagedEntry,
  sectionIndex: number,
  entryIndex: number,
): OrchestratedReviewEntry {
  return {
    section_index: sectionIndex,
    entry_index: entryIndex,
    entry_id: staged.entry_id,
    status: "pending",
    review_item: {
      entry_id: staged.entry_id,
      incoming_display_name: staged.incoming.display_name,
      incoming_yob: staged.incoming.yob ?? 0,
      incoming_club: staged.incoming.club,
      incoming_kind: "solo",
      route: "review",
      confidence: 0.75,
      candidates: [
        {
          team_id: "existing-team-1",
          score: 0.75,
          features: {},
          display_name: "Müller Max",
          yob: 1990,
          club: "LG Test",
        },
      ],
      conflict_flags: [],
      gender: "M",
    },
  };
}

function makeReviewingSession(
  sections: OrchestratedSection[],
  reviewQueue: OrchestratedReviewEntry[],
): ImportSession {
  const parsed: ParsedWorkbook = {
    meta: {
      source_file: "test.xlsx",
      source_sha256: "sha-test",
      parser_version: "v1",
      schema_fingerprint: "fp",
      file_mtime: 0,
      imported_at: new Date().toISOString(),
    },
    singles_sections: [
      {
        context: {
          race_no: 1,
          duration: "hour",
          division: "men",
          event_date: null,
        },
        rows: [],
      },
    ],
    couples_sections: [],
  };

  return {
    session_id: "session-1",
    import_batch_id: "batch-1",
    source_file: "test.xlsx",
    source_sha256: "sha-test",
    parser_version: "v1",
    phase: "reviewing",
    parsed,
    season_state_at_start: emptySeasonState("s1"),
    section_results: sections,
    review_queue: reviewQueue,
    accumulated_person_payloads: [],
    accumulated_team_payloads: [],
    report: { ...emptyImportReport(), review_items: reviewQueue.length },
  };
}

function makeCouplesReviewSession(rowOverrides: Partial<ImportRowCouples> = {}) {
  const row: ImportRowCouples = {
    startnr: "12",
    name_a: "Müller, Max",
    yob_a: 1990,
    club_a: "LG A",
    name_b: "Schmidt, Anna",
    yob_b: 1992,
    club_b: "LG B",
    distance_km: 10,
    points: 10,
    ...rowOverrides,
  };
  const context = {
    race_no: 1,
    duration: "hour",
    division: "couples_mixed",
    event_date: null,
  } as const;
  const staged = makeStaged({
    entry_id: "couple-entry-1",
    startnr: row.startnr,
    incoming: {
      display_name: `${row.name_a} / ${row.name_b}`,
      yob: null,
      yob_text: `${row.yob_a} / ${row.yob_b}`,
      club: [row.club_a, row.club_b].filter(Boolean).join(" / ") || null,
      row_kind: "team",
      sheet_name: "test.xlsx",
      section_name: "Paare Mix 60min",
      row_index: 0,
    },
  });
  const review = makeReviewEntry(staged, 1, 0);
  review.review_item.incoming_kind = "team";
  const section: OrchestratedSection = { context, staged_entries: [staged], all_resolved: false };
  const precedingSection: OrchestratedSection = {
    context: { race_no: 1, duration: "hour", division: "men", event_date: null },
    staged_entries: [],
    all_resolved: true,
  };
  const session = makeReviewingSession([precedingSection, section], [review]);
  session.parsed = { ...session.parsed, couples_sections: [{ context, rows: [row] }] };
  return { session, row, staged, review };
}

describe("getReviewQueue", () => {
  it("returns only pending entries", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const resolvedReview: OrchestratedReviewEntry = {
      ...makeReviewEntry(makeStaged({ entry_id: "entry-2" }), 0, 1),
      status: "resolved",
    };

    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged, makeStaged({ entry_id: "entry-2" })],
      all_resolved: false,
    };

    const session = makeReviewingSession([section], [review, resolvedReview]);
    const queue = getReviewQueue(session);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.entry_id).toBe("entry-1");
  });
});

describe("resolveReviewEntry — link_existing", () => {
  it("sets team_id and manual resolution on the staged entry", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged],
      all_resolved: false,
    };

    const session = makeReviewingSession([section], [review]);
    const updated = resolveReviewEntry(session, "entry-1", {
      type: "link_existing",
      team_id: "existing-team-1",
    });

    const entry = updated.section_results[0]!.staged_entries[0]!;
    expect(entry.team_id).toBe("existing-team-1");
    expect(entry.resolution).toEqual({
      method: "manual",
      confidence: 0.75,
      candidate_count: 1,
    });
  });

  it("marks the review entry as resolved", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged],
      all_resolved: false,
    };

    const session = makeReviewingSession([section], [review]);
    const updated = resolveReviewEntry(session, "entry-1", {
      type: "link_existing",
      team_id: "existing-team-1",
    });

    expect(updated.review_queue[0]!.status).toBe("resolved");
    expect(updated.review_queue[0]!.resolved_team_id).toBe("existing-team-1");
    expect(updated.review_queue[0]!.resolved_method).toBe("manual");
  });

  it("transitions to committing when last entry is resolved", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged],
      all_resolved: false,
    };

    const session = makeReviewingSession([section], [review]);
    const updated = resolveReviewEntry(session, "entry-1", {
      type: "link_existing",
      team_id: "existing-team-1",
    });

    expect(updated.phase).toBe("committing");
  });

  it("stays in reviewing when other entries remain pending", () => {
    const staged1 = makeStaged({ entry_id: "entry-1" });
    const staged2 = makeStaged({ entry_id: "entry-2" });
    const review1 = makeReviewEntry(staged1, 0, 0);
    const review2 = makeReviewEntry(staged2, 0, 1);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged1, staged2],
      all_resolved: false,
    };

    const session = makeReviewingSession([section], [review1, review2]);
    const updated = resolveReviewEntry(session, "entry-1", {
      type: "link_existing",
      team_id: "existing-team-1",
    });

    expect(updated.phase).toBe("reviewing");
  });
});

describe("resolveReviewEntry — create_new_identity", () => {
  it("creates new person and team payloads for a solo entry", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged],
      all_resolved: false,
    };

    const session = makeReviewingSession([section], [review]);
    const updated = resolveReviewEntry(session, "entry-1", {
      type: "create_new_identity",
    });

    expect(updated.accumulated_person_payloads).toHaveLength(1);
    expect(updated.accumulated_team_payloads).toHaveLength(1);

    const person = updated.accumulated_person_payloads[0]!;
    const team = updated.accumulated_team_payloads[0]!;
    expect(person.gender).toBe("M");
    expect(team.team_kind).toBe("solo");
    expect(team.member_person_ids).toEqual([person.person_id]);
  });

  it("sets team_id and new_identity resolution on the staged entry", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged],
      all_resolved: false,
    };

    const session = makeReviewingSession([section], [review]);
    const updated = resolveReviewEntry(session, "entry-1", {
      type: "create_new_identity",
    });

    const entry = updated.section_results[0]!.staged_entries[0]!;
    expect(entry.team_id).not.toBeNull();
    expect(entry.resolution).toEqual({
      method: "new_identity",
      confidence: null,
      candidate_count: 0,
    });
  });

  it("creates two persons and one couple team for a team entry", () => {
    const { session } = makeCouplesReviewSession();
    const updated = resolveReviewEntry(session, "couple-entry-1", {
      type: "create_new_identity",
    });

    expect(updated.accumulated_person_payloads).toHaveLength(2);
    expect(updated.accumulated_team_payloads).toHaveLength(1);

    const team = updated.accumulated_team_payloads[0]!;
    expect(team.team_kind).toBe("couple");
    expect(team.member_person_ids).toHaveLength(2);
  });

  it.each([
    { club_a: null, club_b: "LG B" },
    { club_a: "LG A", club_b: null },
    { club_a: "LG A / Team Nord", club_b: "LG B / Team Süd" },
    { club_a: null, club_b: null, yob_a: 1900, yob_b: 1900 },
    { name_a: "Müller / Beispiel, Max", name_b: "Schmidt, Anna" },
  ])("preserves each member's structured source identity %#", (overrides) => {
    const { session, row } = makeCouplesReviewSession(overrides);
    const updated = resolveReviewEntry(session, "couple-entry-1", { type: "create_new_identity" });
    expect(
      updated.accumulated_person_payloads.map((person) => [
        person.display_name,
        person.yob,
        person.club,
      ]),
    ).toEqual([
      [row.name_a, row.yob_a, row.club_a],
      [row.name_b, row.yob_b, row.club_b],
    ]);
    expect(updated.accumulated_person_payloads.map((person) => person.gender)).toEqual(["M", "F"]);
    expect(session.accumulated_person_payloads).toEqual([]);
  });

  it.each(["missing_row", "wrong_context", "wrong_row_index", "wrong_start_number"] as const)(
    "rejects invalid couples source provenance: %s",
    (failure) => {
      const { session, staged } = makeCouplesReviewSession();
      if (failure === "missing_row") session.parsed = { ...session.parsed, couples_sections: [] };
      if (failure === "wrong_context")
        session.section_results[1]!.context = {
          ...session.section_results[1]!.context,
          duration: "half_hour",
        };
      if (failure === "wrong_row_index") staged.incoming.row_index = 7;
      if (failure === "wrong_start_number") staged.startnr = "wrong-start-number";
      expect(() =>
        resolveReviewEntry(session, "couple-entry-1", { type: "create_new_identity" }),
      ).toThrow("source row");
      expect(session.accumulated_person_payloads).toEqual([]);
      expect(session.review_queue[0]?.status).toBe("pending");
    },
  );
});

describe("resolveReviewEntry — errors", () => {
  it("throws on nonexistent entry_id", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged],
      all_resolved: false,
    };
    const session = makeReviewingSession([section], [review]);

    expect(() =>
      resolveReviewEntry(session, "nonexistent", {
        type: "link_existing",
        team_id: "t",
      }),
    ).toThrow("not found");
  });

  it("throws when session is not in reviewing phase", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged],
      all_resolved: false,
    };
    const session = makeReviewingSession([section], [review]);
    const wrongPhase = { ...session, phase: "matching" as const };

    expect(() =>
      resolveReviewEntry(wrongPhase, "entry-1", {
        type: "link_existing",
        team_id: "t",
      }),
    ).toThrow("phase");
  });

  it("throws when link_existing team is not in candidate list", () => {
    const staged = makeStaged();
    const review = makeReviewEntry(staged, 0, 0);
    const section: OrchestratedSection = {
      context: { race_no: 1, duration: "hour", division: "men", event_date: null },
      staged_entries: [staged],
      all_resolved: false,
    };
    const session = makeReviewingSession([section], [review]);

    expect(() =>
      resolveReviewEntry(session, "entry-1", {
        type: "link_existing",
        team_id: "team-not-a-candidate",
      }),
    ).toThrow("not a candidate");
  });
});
