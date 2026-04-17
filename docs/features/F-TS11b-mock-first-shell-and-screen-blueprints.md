# F-TS11b: Mock-First Shell and Screen Blueprints

## Overview

- Feature ID: F-TS11b
- Parent feature: F-TS11
- Status: Planned
- Related requirement(s): R5, R6, R8
- Related milestone(s): M-TS5
- Depends on: F-TS11a

## Goal

Deliver the first real frontend milestone as a fully navigable mock interface so layout, wording,
and interaction flow can be reviewed before live backend wiring.

## Why this phase exists

The current app still defaults to the legacy iframe. The redesign document is strong on structure
and UX intent, but not yet translated into reviewable React screens. This phase turns that document
into something visible and tweakable without being blocked by live data integration work.

## In scope

- New React application shell with:
  - top bar
  - persistent desktop sidebar
  - main content area
  - season switcher and open-review badge
- Route scaffolds for:
  - `season`
  - `standings`
  - `import`
  - `corrections`
  - `history`
- Mock-backed screen blueprints for each section
- Visual states for:
  - empty season
  - populated season
  - pending review count
  - import-in-progress
  - placeholder corrections
- German copy tuned for clarity and large-target desktop use

## Out of scope

- Real repository reads or writes
- Real import processing
- Real export downloads
- Fine-grained correction tools

## Deliverables

- A new mock-first shell rendered as the primary modern UI surface in development
- Reviewable blueprints for all five main sections
- Mock scenarios that let UX review switch between representative organizer situations
- A documented list of visible questions or decisions raised during design review

## Implementation location rules

This phase should establish the new folder boundaries in practice:

- Shell startup and route wiring belong in `src/app/`.
- Mock API contracts and fixtures belong in `src/api/contracts/` and `src/api/mock/`.
- Route-owned screen code belongs in `src/features/season/`, `src/features/standings/`,
  `src/features/import/`, `src/features/corrections/`, and `src/features/history/`.
- Reusable layout and shared UI pieces belong in `src/components/`.
- UI-only Zustand state belongs in `src/stores/`.

Do not implement these mock screens in `src/legacy/`, `public/legacy/`, or `src/devtools/`.

## Screen goals

### Season

- Show season list, active season state, and create/import/export affordances
- Make season selection and season creation obvious
- Surface season metadata such as imported events and last activity

### Standings

- Show the three-step category selection model from the redesign
- Render a representative standings table with sorting and export affordances
- Make the current context obvious at all times

### Import

- Show the stepper structure and the page-level layout, even if actions are still mock-only
- Reserve clear space for the later review workflow

### Corrections

- Render a real page, not a missing route
- Use a friendly placeholder that describes upcoming capabilities

### History

- Show an audit-style event-log table for the currently selected race context
- Include representative rows for atomic events and grouped import-batch events
- Provide mock interactions for:
  - "Stand ansehen" (as-of seq preview with frozen mode)
  - "Atomic rollback"
  - "Gruppen rollback" by `import_batch_id`
  - "Hard reset bis hier" (destructive truncate-to-seq)
- Include explicit warning/confirmation modal states for rollback and hard reset

## Mock data requirements

Mock data should be realistic, not generic filler. Seed it from patterns already present in the TS
backend:

- season summaries with labels, created dates, review counts, and race coverage
- standings rows with rank, display name, year of birth, club, distance, and points
- history rows for import, correction, reassignment, export, and rollback
- history rows expose `seq`, `event_id`, event type, scope (`race`/`batch`/`season`), group key,
  effective-change flag, and actionability hints
- import review counts consistent with the import flow planned in later phases

## Acceptance criteria

- [ ] A reviewer can navigate all main sections without relying on the legacy iframe.
- [ ] The first deliverable is fully mock-backed and does not require live backend wiring.
- [ ] The shell preserves stable orientation with visible navigation on desktop.
- [ ] Screen states are rich enough to support visual and wording iteration.
- [ ] Mock data reflects real domain concepts already present in the repo.
- [ ] The mock-first UI lands in the new app folders, not in legacy or harness folders.
- [ ] History supports a visible frozen "historischer Stand (seq N)" mode while previewing a point-in-time state.
- [ ] Rollback actions are shown for both atomic and grouped contexts with explicit confirmation states.
- [ ] Hard reset is represented as a destructive "discard events after seq" flow with guardrail copy.

## Implementation steps

1. Create `src/app`, `src/api/contracts`, `src/api/mock`, and `src/features/*` as the target home
   for the new UI.
2. Build the shell, routes, and page layout primitives against `MockAppApi`.
3. Add representative fixture scenarios such as empty workspace, active season, and open reviews.
4. Implement season, standings, import, corrections, and history blueprints.
5. Add clear inline helper text and action labels in German.
6. Capture UX feedback and adjust the mock screens before live integration begins.

## Test plan

- Component tests for route switching and shell persistence
- Snapshot or DOM-structure tests for the major mock page states
- Manual design review in the browser with desktop-width and narrower-width layouts

## Definition of done

- [ ] The repo has a reviewable modern React UI independent of the legacy iframe
- [ ] Designers and stakeholders can tweak wording and layout against realistic mock data
- [ ] The mock UI is ready for incremental live data wiring in the next phases
- [ ] The first new React UI code lives in the final intended folder layout, not a temporary one
