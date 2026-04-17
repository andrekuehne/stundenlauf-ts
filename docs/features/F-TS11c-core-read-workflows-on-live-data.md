# F-TS11c: Core Read Workflows on Live Data

## Overview

- Feature ID: F-TS11c
- Parent feature: F-TS11
- Status: Planned
- Related requirement(s): R3, R5, R7, R8
- Related milestone(s): M-TS5
- Depends on: F-TS11a, F-TS11b, F-TS10

## Goal

Swap the currently exposed season, standings, and history flows from `MockAppApi` to a real
`TsAppApi` implementation **without changing the frontend contract already consumed by the new GUI**.

## Why this phase is separate

The repo already contains the backend logic for these areas, but it is currently exposed mostly
through the legacy compatibility adapter and older Zustand-driven TS views. Wiring the new screens
through `TsAppApi` should happen before the complex import workflow so the new frontend gains real
value early.

## Current GUI surface (actual, already exposed under `stundenlauf-ts/`)

The following routes are already live in the new shell and call the `AppApi` seam:

- `/season`
- `/standings`
- `/history`

The frontend currently gets its API instance from `AppApiProvider`, which defaults to
`createMockAppApi()`. `createTsAppApi()` exists as a method map scaffold and still throws.

## In scope

- Production implementation of the **existing** contract used by the three screens:
  - `getShellData()`
  - `listSeasons()`
  - `createSeason()`
  - `openSeason()`
  - `deleteSeason()`
  - `runSeasonCommand()` (import/export backup triggers from season page)
  - `getStandings()`
  - `runExportAction()`
  - `getHistory()`
  - `previewHistoryState()`
  - `rollbackHistory()`
  - `hardResetHistoryToSeq()`
- Route-level loading, empty, and error states (already present in UI) continue to work unchanged.
- Global active-season handling in the shell continues to use `getShellData()` + `openSeason()`.

## Out of scope

- Import wizard internals (`createImportDraft`, review decisions, finalize) tracked in `F-TS11d`
- New API redesign or renaming of currently consumed methods
- Corrections workspace (route exists but is still a placeholder page)

## Backend guidance from current repo

This phase should reuse existing TS logic instead of talking to the legacy API surface directly:

- season persistence from `SeasonRepository`
- projected state from `projectState()`
- standings from `computeStandings()` and exclusion helpers
- history/timeline synthesis patterns already proven in `src/legacy/api/runtime.ts`
- existing event mutations for correction, reassignment, rollback, and ranking eligibility

## `TsAppApi` methods to move from mock to production

```ts
interface AppApi {
  getShellData(): Promise<ShellData>;
  listSeasons(): Promise<SeasonListItem[]>;
  createSeason(input: CreateSeasonInput): Promise<SeasonListItem>;
  openSeason(seasonId: string): Promise<void>;
  deleteSeason(seasonId: string): Promise<void>;
  runSeasonCommand(command: SeasonCommand, seasonId?: string): Promise<AppCommandResult>;
  getStandings(seasonId: string): Promise<StandingsData>;
  runExportAction(seasonId: string, actionId: "export_pdf" | "export_excel"): Promise<AppCommandResult>;
  getHistory(seasonId: string, query?: HistoryQuery): Promise<HistoryData>;
  previewHistoryState(seasonId: string, input: HistoryPreviewInput): Promise<HistoryPreviewState>;
  rollbackHistory(seasonId: string, input: HistoryRollbackInput): Promise<AppCommandResult>;
  hardResetHistoryToSeq(seasonId: string, input: HistoryHardResetInput): Promise<AppCommandResult>;
}
```

## Acceptance criteria

- [ ] `/season`, `/standings`, and `/history` work via `createTsAppApi()` with real repository/domain data.
- [ ] `AppApiProvider` can switch between mock and live implementations without screen-level code changes.
- [ ] No route calls domain modules, repositories, or `src/legacy/api/runtime.ts` directly.
- [ ] Existing rollback and preview actions in history stay functional against live event logs.
- [ ] Existing season shell behavior (active season + unresolved review badge) remains correct in live mode.

## Implementation steps

1. Implement all listed season/standings/history methods in `createTsAppApi()` using existing TS domain modules.
2. Keep the contract shape unchanged; only replace internals behind the seam.
3. Add provider wiring toggle so runtime can use live `TsAppApi` instead of `MockAppApi`.
4. Validate side effects for history actions (`preview`, `rollback`, `hard reset`) against real persisted logs.
5. Keep mock fixtures and `MockAppApi` for UI regression and design review harnesses.

## Test plan

- Integration tests for `TsAppApi` season, standings, and history methods
- Component tests covering live and mock providers against the same screens
- Manual browser checks with real local seasons and imported data

## Definition of done

- [ ] Season, standings, and history routes run on live data behind the existing `AppApi` contract.
- [ ] Mock/live parity is preserved at method signatures and returned payload shape.
- [ ] The GUI served under `stundenlauf-ts/` no longer depends on mock internals for these three workflows.
