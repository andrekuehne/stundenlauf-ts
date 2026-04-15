# F-TS11e: Live Cutover, Exports, and Polish

## Overview

- Feature ID: F-TS11e
- Parent feature: F-TS11
- Status: Planned
- Related requirement(s): R5, R7, R8
- Related milestone(s): M-TS5, M-TS6, M-TS7
- Depends on: F-TS11c, F-TS11d, F-TS07, F-TS08

## Goal

Finish the frontend rewrite by making the new React UI the default application surface, wiring the
remaining export and portability actions through `AppApi`, and polishing the experience for actual
season administration use.

## In scope

- Switch the app entry point from legacy iframe default to the new React UI
- Wire export actions in standings and season screens through `AppApi`
- Wire season archive import/export through `AppApi`
- Bring the corrections route from placeholder to an intentional post-import workspace
- Final accessibility, wording, loading-state, and notification polish
- Decide what remains of the legacy adapter after cutover:
  - migration fallback only
  - dev-only fallback
  - removable once parity is proven

## Out of scope

- A new server-backed architecture
- Multi-user features
- Reworking the domain model away from browser-local storage

## Export and portability guidance

This phase should expose existing TS capabilities behind the app-facing boundary:

- PDF export via `exportLaufuebersichtDualPdfs()`
- Excel export via `exportGesamtwertungWorkbook()`
- season export/import via the portability module

The new screens should call those features through explicit `AppApi` methods so the UI stays
decoupled from implementation details.

## Post-cutover folder target

After migration, the target application structure should be:

```text
src/
  app/
  api/
  features/
  components/
  stores/
  domain/
  services/
  import/
  matching/
  ranking/
  portability/
  export/
  storage/
  lib/
  main.tsx
```

The following migration-only areas should be removed once cutover is complete:

```text
src/legacy/
public/legacy/
```

`src/devtools/` may remain only for intentionally retained harnesses and diagnostics.

## Cleanup rules

- A route is considered migrated only when it no longer depends on `src/legacy` or
  `public/legacy`.
- Remove `src/legacy` only after all organizer-facing flows are reachable through the new React UI.
- Remove `public/legacy` only after the app no longer iframe-mounts the legacy frontend.
- Any remaining harnesses must live in `src/devtools`, not beside production app code.

## Acceptance criteria

- [ ] The modern React frontend becomes the default shipped UI.
- [ ] Export and season portability actions are available from the new UI.
- [ ] The legacy iframe is no longer required for normal organizer workflows.
- [ ] Corrections is no longer just a placeholder route.
- [ ] The final UI meets the redesign goals for clarity, readability, and obvious next actions.
- [ ] Migration-only folders are either deleted or explicitly retained with a narrow purpose.

## Implementation steps

1. Add remaining export and portability methods to `AppApi`.
2. Wire standings and season actions to live browser-local exports.
3. Implement the first real corrections workspace around already-supported TS mutations.
4. Promote the new React app to the default entry path.
5. Delete or quarantine migration-only legacy entry points once the new routes fully replace them.
6. Keep or retire the legacy adapter intentionally, based on remaining migration value.
7. Run a final pass on accessibility, German copy, spacing, error handling, and review feedback.

## Test plan

- Integration tests for export and season portability actions through `TsAppApi`
- Manual end-to-end season workflow checks in the browser
- Regression pass on desktop layout and reduced-motion behavior

## Definition of done

- [ ] The new React frontend is the primary app
- [ ] Organizers can manage seasons, inspect standings, import runs, review matches, and export from
      the new UI
- [ ] Remaining legacy UI dependence is either removed or explicitly documented as temporary
- [ ] There is no ambiguous old/new UI mixture left in production folders
