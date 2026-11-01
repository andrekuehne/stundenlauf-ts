# F-TS12: Participant Gender Correction and Category Move

## Overview

- Feature ID: F-TS12
- Feature name: Participant gender correction and category move (corrections add-on)
- Status: Planned
- Related requirement(s): R2 (race categories), R5 (corrections)
- Related milestone(s): post M-TS5 (corrections workspace)
- Depends on: F-TS01 (event model), F-TS03 (matching engine), F-TS11e (corrections route)
- Python predecessor(s): none (Python required full rollback + re-import)

## Problem Statement

Timekeeping sheets sometimes list a participant in the wrong gendered section:

- a woman listed in the men's race (or vice versa), solo 30/60 min;
- a couple listed in `couples_men` / `couples_women` that is actually `couples_mixed` (or any other
  couples division mix-up).

Today, once a race is imported, the only fix is rolling back the whole import batch and
re-importing a manually edited workbook. The corrections table can edit name / YOB / club, but:

1. `person.corrected` has no `gender` field (F-TS01 §1 explicitly excludes gender correction in v1).
2. Entries are owned by a `RaceEvent`, and the category lives on the race, not on the entry. There is
   no event to move one entry between the race events of the same race number.

Because matching pools are **category-scoped** (`buildCategoryHistoryPersonPool` /
`buildCategoryHistoryCoupleTeamPool` in `src/matching/workflow.ts`) and candidates are filtered by
gender (`candidates.ts`, `strict-identity.ts`, `coupleDivisionOk`), a mis-listed runner usually
ends up as a *second identity*: e.g. "Kim Müller" (M) in men race 1 and "Kim Müller" (F) in women
races 2–4. A move therefore needs the same name matching as the import review, so the operator can
merge the moved results into the identity that already exists in the target category.

## Scope

### In Scope

- Corrections table add-on: pick a standings row (solo or couple) and move it to another division
  of the same duration.
- Gender correction per member as part of that action (the target division is derived from the
  genders).
- Name matching against the target category's history, presented like the import review
  (candidate cards with confidence and field comparison), with the choices:
  - merge into an existing team in the target category, or
  - keep the participant as its own identity (same `team_id`, just moved).
- Pre-flight conflict detection per race number before anything is written.
- Atomic write of all resulting events; History page shows them; standings/exports pick them up
  without changes.

### Out of Scope

- Moving between durations (30 ↔ 60 min) or between solo and couple shapes.
- Moving only a single race's result (phase 2 candidate; the event is per entry, so the domain
  already supports it).
- Recomputing points/placements of other participants in source or target race (see Open Questions).
- Creating a missing target race event.
- True person/team merge or pruning of orphaned identities (still out of scope per F-TS01).
- Gender `X` (no division mapping exists).

## Acceptance Criteria

- [ ] `person.corrected` accepts an optional `gender` (`"M" | "F" | "X"`); projection and validation
      handle it; existing logs replay unchanged.
- [ ] New event `entry.moved` moves an entry between two effective race events of the same duration
      and race number but different division; invalid moves are rejected by `validateEvent`.
- [ ] From the corrections table the operator can open "Wertung wechseln" on a row, set member
      gender(s), see the derived target category and affected race numbers, and see ranked
      matching candidates from the target category.
- [ ] Choosing a candidate merges (move + reassign); choosing "eigene Identität" moves the team as is.
- [ ] Conflicts (missing target race, team already present in a target race, merge target already
      present in the same race number) are shown before saving and block the save.
- [ ] All events of one action are appended in a single `appendEvents` call (all-or-nothing).
- [ ] After the move, standings/exports show the results in the target category only; a later import
      of the same person in the target category auto-links / suggests the moved or merged team.
- [ ] History page summarises `entry.moved` and gender corrections in German.

## Technical Plan

### 1. Domain events (`src/domain/events.ts`, `types.ts`)

```ts
// extend
interface PersonCorrectedPayload {
  person_id: string;
  updated_fields: { /* existing */; gender?: Gender };
  rationale: string;
}

// new
interface EntryMovedPayload {
  entry_id: string;
  from_race_event_id: string;
  to_race_event_id: string;
  rationale: string;
}
// DomainEvent union += EventEnvelope<"entry.moved", EntryMovedPayload>
```

Why a new event type instead of an optional field on `entry.reassigned`: older builds would ignore
the extra field and silently produce a wrong projection. An unknown type fails loudly
(`UnknownEventTypeError`), which is the F-TS01 rule.

Why move the entry physically (instead of a per-entry category override): every consumer groups by
`race.category` (ranking engine, export projection, standings race columns, replay index, exclusion
validation, category history pools). Moving keeps all of them untouched.

### 2. Projection (`src/domain/projection.ts`)

- `person.corrected`: already spreads `updated_fields`; `gender` comes along for free.
- `entry.moved`: remove the entry from `from` race's `entries`, append it (unchanged: `incoming`,
  `resolution`, points, distance) to `to` race's `entries`.

### 3. Validation (`src/domain/validation.ts`)

`person.corrected`: `gender` ∈ {M, F, X} when present.

`entry.moved`:

- both races exist and are effective (`isEffectiveRace`);
- `from !== to`, same `category.duration`, same `race_no`, different `category.division`;
- entry exists in `from`;
- team kind of the entry's team equals `requiredTeamKind(to.category.division)`;
- the team has no other entry in `to`; `entry_id` not already in `to`.

Gender vs. division stays a **UI/command-level** check, not domain validation (F-TS01: category
validation is structural only). This keeps old logs valid.

### 4. Matching helper (`src/matching/`)

New pure helper, e.g. `src/matching/relocate.ts`:

```ts
rankRelocationCandidates(
  state: SeasonState,              // transient state WITH gender corrections applied
  target: RaceCategory,
  participant: { teamId: string }, // members read from state
  config: MatchingConfig,
): Promise<{
  candidates: { team_id: string; score: number; features: MatchingFeatures }[];
  suggestedRoute: MatchRoute;      // auto | review | new_identity
}>
```

- Builds an "incoming row" from the participant's **canonical** identity (display name, YOB, club),
  not from the raw `incoming` data; the operator may already have fixed typos.
  - Solo → `resolvePerson({ gender: genderForDivision(target.division), candidatePeople:
    buildCategoryHistoryPersonPool(state, target.duration, target.division), ... })`.
  - Couple → `resolveTeamRow({ row: { name_a, yob_a, club_a, name_b, ... }, genderA, genderB from
    memberGendersForCouples(target.division), candidateTeams: buildCategoryHistoryCoupleTeamPool(...) })`.
    For `couples_mixed`, order members M first to line up with `memberGendersForCouples`.
- Replay index: `buildFingerprintReplayIndex(state, target)` so prior manual links in the target
  category surface as a top candidate.
- Excludes the participant's own `team_id` from the candidate list.
- Ignores `new_persons` / `new_teams` from the resolver; "new identity" here means *keep the
  existing team*.
- Results are **never auto-applied**; `route === "auto"` only marks the recommended card.
- Requires exporting the two pool builders from `workflow.ts` (currently module-private).

The transient state is `applyEvent(state, personCorrected…)` in memory, so `coupleDivisionOk` and the
gender-filtered person index see the corrected genders.

### 5. App API (`src/api/contracts`, `src/api/ts`, `src/api/mock`)

```ts
previewParticipantMove(seasonId, {
  categoryKey: string; teamId: string;
  memberGenders: ("M" | "F")[];          // index-aligned with members
}): Promise<ParticipantMovePreview>

interface ParticipantMovePreview {
  sourceCategoryKey: string;
  targetCategoryKey: string;             // derived; equals source → gender-only fix
  races: { raceNo: number; entryId: string; fromRaceEventId: string;
           toRaceEventId: string | null; conflict: string | null }[];
  incoming: ImportIncomingRecord;        // participant as "incoming" for the cards
  candidates: (ImportReviewCandidate & { blockedRaceNos: number[] })[];
  sharedPersonWarnings: string[];        // member also used by teams in other divisions
}

moveParticipant(seasonId, {
  categoryKey: string; teamId: string;
  memberGenders: ("M" | "F")[];
  targetTeamId: string | null;           // null = keep own identity
  carryExclusion: boolean;
}): Promise<AppCommandResult>
```

Target division derivation: solo M→`men`, F→`women`; couple M+M→`couples_men`,
F+F→`couples_women`, M+F→`couples_mixed`.

`moveParticipant` re-runs the pre-flight checks, then appends in **one** `appendEvents` call (the
event store validates sequentially against a transient state, `event-store.ts`):

1. `person.corrected { gender }` for each member whose gender changes;
2. `entry.moved` for every effective entry of the team in the source category (all race numbers);
3. if `targetTeamId`: `entry.reassigned` (from source team → target team) for each moved entry;
4. if `carryExclusion` and the source team was excluded: `ranking.eligibility_set` for the
   resulting team in the target category.

Candidate cards reuse `buildReviewCandidate()` from `src/api/ts/index.ts`, so field comparisons look
identical to the import review.

`blockedRaceNos` for a candidate: race numbers where both the candidate and the moved participant
already have a result in the target category (double listing). `entry.reassigned` would reject this,
so the card is disabled with an explanation.

History (`eventSummary` / `eventScope` in `src/api/ts/index.ts`): `entry.moved` →
"Ergebniseintrag … von <Kategorie> nach <Kategorie> verschoben.", scope `race`; `person.corrected` with
gender mentions the gender change.

### 6. UI (`src/features/corrections/`)

- New row action "Wertung wechseln" in `StandingsDetailTable` (corrections mode), next to edit and
  exclude.
- `CategoryMoveModal.tsx`:
  1. **Geschlecht**: M/W toggle per member, pre-filled from current genders (`getStandingsRowIdentity`
     extended with `gender`). Shows "Bisher: 60 Min Männer → Neu: 60 Min Frauen".
  2. **Betroffene Läufe**: race numbers with ok or conflict badges, from `previewParticipantMove`.
  3. **Abgleich**: `ImportCandidateCard` list (reused from `features/import`) plus a
     "Keine Übereinstimmung – als eigene Identität übernehmen" option. The recommended candidate is
     preselected only when `suggestedRoute === "auto"`.
  4. Save is disabled while any blocking conflict exists.
- After saving: reload standings, switch the category chip to the target category, status message.
- Strings in `src/app/strings.ts` (`STR.views.corrections.move*`).
- Optionally add a gender select to `CorrectionModal` too. A gender change that changes the derived
  division routes the operator into the move flow instead of saving directly.

### Storage / migration / portability

- No migration: the new event type and the optional field are additive; `schema_version` stays 1.
- Season archives that contain `entry.moved` cannot be imported by older builds (they fail loudly);
  this is intended.

### Performance

Matching runs once per dialog against a single category pool, which is negligible next to an import.

## Risks and Assumptions

- Assumption: source and target race of one race number come from the same import batch (singles
  workbooks contain men and women sections; couples workbooks contain all couples sections), so
  batch rollback removes both consistently.
- Risk: if per-race rollback is introduced later, a moved entry follows its *target* race.
  - Mitigation: record origin race id on the moved entry if that ever becomes relevant.
- Risk: points stay as printed on the sheet, which were computed for the source section placing.
  - Mitigation: see Open Questions; `entry.corrected` exists for manual point fixes.
- Risk: a person record shared by several teams changes gender everywhere.
  - Mitigation: preview lists `sharedPersonWarnings`; in practice persons are category-scoped.
- Orphans: when merging, the source team/persons remain with no effective entries (accepted by
  F-TS01); the corrections table already hides teams without entries.

## Open Questions

1. **Points**: keep sheet points as-is, prompt for manual correction of the moved entry, or require
   re-import when placements matter?
2. **Missing target race** (no section for that division in a race number): reject (current plan)
   or synthesize an empty `race.registered` in the same batch?
3. **Single-race move** ("listed in the wrong section only once"): phase 2 via a per-race-cell action?
4. **Name/YOB/club fixes during merge**: when merging into a candidate whose data differs, should the
   dialog offer to apply a `person.corrected` to the target identity?

## Implementation Phases

1. Domain: `gender` on `person.corrected`, `entry.moved` (types, projection, validation, history
   summary) + tests in `tests/domain/{projection,validation}.test.ts`.
2. Matching: export pool builders, `rankRelocationCandidates` + tests in `tests/matching/`
   (solo M→F with existing women identity; couple men→mixed; replay hit; own team excluded).
3. API: `previewParticipantMove`, `moveParticipant` (ts + mock + contracts) + tests in
   `tests/api/ts-app-api.test.ts` (atomicity, conflicts, exclusion carry-over, ranking result).
4. UI: `CategoryMoveModal`, row action, strings, unit tests + an e2e path on the corrections page.
5. Docs: update F-TS01 §1 (gender correction now supported, still not used for structural
   validation) and the event catalog; add F-TS12 to `PROJECT_PLAN.md`.
