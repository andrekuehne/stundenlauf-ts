# F-TS11c: Core Read Workflows on Live Data

## Overview

- Feature ID: F-TS11c
- Parent feature: F-TS11
- Status: Planned
- Related requirement(s): R3, R5, R7, R8
- Related milestone(s): M-TS5
- Depends on: F-TS11a, F-TS11b, F-TS10

## Goal

Swap the mock data behind the season, standings, and history views to a real `TsAppApi`
implementation while keeping the mock-proven UI contracts stable.

## Why this phase is separate

The repo already contains the backend logic for these areas, but it is currently exposed mostly
through the legacy compatibility adapter and older Zustand-driven TS views. Wiring the new screens
through `TsAppApi` should happen before the complex import workflow so the new frontend gains real
value early.

## In scope

- Live `AppApi` methods for:
  - listing seasons
  - creating, opening, deleting, and resetting seasons
  - loading season overview data
  - loading standings for a selected category
  - loading timeline/history rows
- Route-level loading, empty, and error states
- Global active-season handling in the new shell
- Live read/write actions that naturally belong to these screens:
  - ranking eligibility toggles
  - identity correction entry points
  - duplicate-result reassignment entry points
  - rollback actions from history

## Out of scope

- Full import wizard wiring
- PDF/Excel export plumbing
- Season archive import/export
- Full corrections workspace beyond the entry points already supported by the backend

## Backend guidance from current repo

This phase should reuse existing TS logic instead of talking to the legacy API surface directly:

- season persistence from `SeasonRepository`
- projected state from `projectState()`
- standings from `computeStandings()` and exclusion helpers
- history/timeline synthesis patterns already proven in `src/legacy/api/runtime.ts`
- existing event mutations for correction, reassignment, rollback, and ranking eligibility

## Proposed `TsAppApi` reads

```ts
interface TsAppApi extends AppApi {
  listSeasons(): Promise<SeasonSummary[]>;
  getSeasonOverview(seasonId: string): Promise<SeasonOverview>;
  getStandings(seasonId: string, query: StandingsQuery): Promise<StandingsData>;
  getHistory(seasonId: string, query?: HistoryQuery): Promise<HistoryData>;
}
```

## Acceptance criteria

- [ ] Season, standings, and history screens work against browser-local live data.
- [ ] The same screen components still run against `MockAppApi` for review and regression testing.
- [ ] No page reaches into `src/legacy/api/runtime.ts` or the repository directly.
- [ ] The active-season context is shared across routes through the new shell.
- [ ] Read, empty, loading, and recoverable error states are explicit and user-friendly.

## Implementation steps

1. Implement `TsAppApi` read methods using `SeasonRepository` and projected state.
2. Add route-level query hooks that map API responses into stable page view models.
3. Wire season selection and shell badges to the live active season.
4. Connect standings and history actions to explicit `AppApi` mutation methods.
5. Keep mock fixtures in place so visual review and regression checks remain easy.

## Test plan

- Integration tests for `TsAppApi` season, standings, and history methods
- Component tests covering live and mock providers against the same screens
- Manual browser checks with real local seasons and imported data

## Definition of done

- [ ] The new React frontend can replace the legacy iframe for season, standings, and history work
- [ ] Core read workflows use the real TS domain through `AppApi`
- [ ] Mock and live providers stay contract-compatible
