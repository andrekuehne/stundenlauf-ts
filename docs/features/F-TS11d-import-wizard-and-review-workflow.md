# F-TS11d: Import Wizard and Review Workflow

## Overview

- Feature ID: F-TS11d
- Parent feature: F-TS11
- Status: Planned
- Related requirement(s): R1, R3, R4, R6, R8
- Related milestone(s): M-TS5
- Depends on: F-TS11a, F-TS11b, F-TS11c, F-TS05

## Goal

Implement the redesigned import experience as a guided wizard with a strong review workflow, using
the new React UI and `AppApi` seam rather than direct domain or legacy-adapter calls from screens.

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

## Out of scope

- New matching algorithms
- Bulk correction workspace beyond the import flow
- Background worker optimizations unless needed for acceptable UX

## Planned App API surface

```ts
interface ImportAppApi {
  beginImport(input: BeginImportInput): Promise<ImportSessionSummary>;
  getImportDetectedData(sessionId: string): Promise<ImportDetectedData>;
  getImportReview(sessionId: string): Promise<ImportReviewData>;
  applyImportDecision(sessionId: string, decision: ImportDecision): Promise<ImportReviewData>;
  finalizeImport(sessionId: string): Promise<ImportCompletionSummary>;
  cancelImport(sessionId: string): Promise<void>;
}
```

Mock and live implementations should share these contracts.

## Live backend guidance

The live implementation should compose the existing TS workflow pieces:

- `startImport()`
- `runMatching()`
- `getReviewQueue()`
- `resolveReviewEntry()`
- `finalizeImport()`

The UI should not call these helpers directly. That orchestration belongs inside `TsAppApi`.

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
- [ ] Live import orchestration uses the existing TS domain through `AppApi`.
- [ ] Review items are based on staged `ImportSession` data, not direct frontend mutation.
- [ ] Completion updates season and standings views after successful finalization.

## Implementation steps

1. Build the wizard shell and step-specific view models against mock data.
2. Implement the review cards and sticky imported-record panel.
3. Define import-specific `AppApi` contracts and session lifecycle handling.
4. Add a live `TsAppApi` import adapter over the existing orchestration modules.
5. Connect completion back into the active season refresh path.

## Test plan

- Component tests for wizard navigation, review-card selection, and progress updates
- Integration tests for the live import session flow over real orchestration helpers
- Manual checks with representative organizer Excel files

## Definition of done

- [ ] The redesigned import flow is available in the new React UI
- [ ] The workflow supports both mock review and live orchestration
- [ ] The import path no longer depends on the legacy iframe for day-to-day use
