# F-TS11d: Import Wizard and Review Workflow

## Overview

- Feature ID: F-TS11d
- Parent feature: F-TS11
- Status: Planned
- Related requirement(s): R1, R3, R4, R6, R8
- Related milestone(s): M-TS5
- Depends on: F-TS11a, F-TS11b, F-TS11c, F-TS05

## Goal

Move the already exposed import wizard route from `MockAppApi` internals to production orchestration,
while preserving the current UI contract and step flow in the new React shell.

## Why this phase is distinct

Import is the highest-risk user workflow in the app. The repo already has working orchestration
logic, staged review semantics, and adapter mappings, but the redesign asks for a much clearer and
more confidence-building interface than either the harnesses or the legacy UI provide.

## In scope

- Four-step import wizard:
  - file selection
  - detected data review
  - participant assignment review
  - completion summary
- Sticky progress and review counters
- Candidate-card review UI based on the redesign document
- Mock-first workflow support for UX tuning
- Live `TsAppApi` wiring to the existing import orchestration domain

## Current GUI surface (actual, already exposed under `stundenlauf-ts/`)

- The `/import` route is already implemented and user-accessible in the new shell.
- The screen currently calls these `AppApi` methods:
  - `createImportDraft()`
  - `setImportReviewDecision()`
  - `finalizeImportDraft()`
  - `getStandings()` (for imported-run occupancy grid)
  - `getShellData()` indirectly via shell refresh after finalization
- `MockAppApi` fully backs these methods today; no live `TsAppApi` implementation is wired yet.

## Out of scope

- New matching algorithms
- Bulk correction workspace beyond the import flow
- Background worker optimizations unless needed for acceptable UX

## API contract to keep stable for production cutover

```ts
interface AppApi {
  createImportDraft(input: ImportDraftInput): Promise<ImportDraftState>;
  getImportDraft(draftId: string): Promise<ImportDraftState>;
  setImportReviewDecision(draftId: string, decision: ImportReviewDecision): Promise<ImportDraftState>;
  finalizeImportDraft(draftId: string): Promise<AppCommandResult>;
}
```

Mock and live implementations must share these contracts and payload shapes.

## Live backend guidance

The live implementation should compose the existing TS workflow pieces behind `TsAppApi`:

- `startImport()`
- `runMatching()`
- `getReviewQueue()`
- `resolveReviewEntry()`
- `finalizeImport()`

The UI should not call these helpers directly. Orchestration belongs inside `TsAppApi`.

## UX goals carried over from the redesign

- Always show where the user is in the process
- Keep the imported record visible while reviewing candidates
- Show only the differences that matter on candidate cards
- Preselect the best backend candidate, but make the decision explicit
- Automatically advance after each resolved review item
- Preserve a strong "safe to continue" feeling throughout the workflow

## Acceptance criteria

- [ ] The import screen works as a guided multi-step wizard rather than a loose tool page.
- [ ] The review UI is mockable for design iteration before full live wiring.
- [ ] Live import orchestration uses the existing TS domain through the current `AppApi` methods.
- [ ] Review items and decisions come from backend/session state, not frontend-only mutation.
- [ ] Completion updates shell + standings/imported-run indicators after successful finalization.
- [ ] No import screen component calls `src/import/*` helpers directly.

## Implementation steps

1. Keep the existing wizard UI and contracts; do not redesign method names during this phase.
2. Implement `createImportDraft/getImportDraft/setImportReviewDecision/finalizeImportDraft` in `TsAppApi`.
3. Map draft/session lifecycle to existing orchestration (`startImport`, `runMatching`, review queue, resolve, finalize).
4. Ensure `getStandings()` reflects newly imported runs immediately after finalization.
5. Preserve `MockAppApi` behavior for UX harnesses and regression checks.

## Test plan

- Component tests for wizard navigation, review-card selection, and progress updates
- Integration tests for the live import session flow over real orchestration helpers
- Manual checks with representative organizer Excel files

## Definition of done

- [ ] The redesigned import flow is available in the new React UI
- [ ] The workflow supports both mock review and live orchestration via the same `AppApi` contract
- [ ] The import path no longer depends on the legacy iframe for day-to-day use
