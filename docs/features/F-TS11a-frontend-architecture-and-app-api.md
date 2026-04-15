# F-TS11a: Frontend Architecture and App API Boundary

## Overview

- Feature ID: F-TS11a
- Parent feature: F-TS11
- Status: Planned
- Related requirement(s): R1, R3, R5, R6, R7, R8
- Related milestone(s): M-TS5
- Depends on: F-TS01, F-TS04, F-TS05, F-TS10

## Goal

Define the architectural foundation for the new React frontend so it can be built mock-first, then
swapped over to the real TypeScript domain without rewriting screens.

## Current repo baseline

The repo already has the technical pieces needed for this direction:

- React 19, React Router 7, Vite, and Zustand are already installed.
- The real domain exists in TypeScript and is browser-local.
- `SeasonRepository`, projections, ranking, import orchestration, export, and portability are already
  implemented.
- The default production UI is still the mounted legacy iframe, while the TS UI mostly survives as
  stores, strings, and harnesses.
- `src/legacy/api/runtime.ts` proves the TS backend can already answer season, standings, history,
  and import-review workflows, but it does so through a legacy pywebview-shaped contract.

## Architecture decisions

### 1. Keep the current framework direction

Use the repo's existing frontend stack for the rewrite:

- React 19 for component UI
- React Router 7 for page routing
- Zustand for UI, workflow, and ephemeral session state
- Pure TS domain modules for business logic and persistence

This keeps the rewrite aligned with the current browser-local architecture and avoids an unnecessary
framework migration mid-port.

### 1.5 Migration-safe folder structure

During migration, keep new UI, legacy compatibility, domain logic, and dev harnesses physically
separate so the repo does not accumulate mixed old/new files in the same directories.

```text
src/
  app/                  # app shell, router, providers, startup wiring for the new UI
  api/                  # AppApi contracts and implementations
    contracts/
    mock/
    ts/
  features/             # route-owned UI slices
    season/
    standings/
    import/
    corrections/
    history/
  components/           # shared presentational building blocks only
    layout/
    feedback/
    forms/
    tables/
  stores/               # Zustand UI/workflow state only
  domain/               # business events, projections, entities
  services/             # low-level adapters such as repositories
  import/
  matching/
  ranking/
  portability/
  export/
  storage/
  lib/
  legacy/               # temporary compatibility layer only
  devtools/             # harnesses, parity pages, temporary diagnostics
  main.tsx
```

Static legacy assets remain isolated:

```text
public/
  legacy/               # frozen legacy frontend bundle during migration
```

### 1.6 Folder ownership rules

Use the following guardrails throughout the migration:

- New product UI belongs in `src/app`, `src/features`, `src/components`, `src/api`, and
  focused `src/stores` modules.
- Existing domain/business logic remains in `src/domain`, `src/import`, `src/matching`,
  `src/ranking`, `src/storage`, `src/export`, and `src/portability`.
- `src/legacy` is a compatibility quarantine zone. Do not place new product-facing UI there.
- `public/legacy` is legacy static surface only. Limit changes to narrow compatibility fixes.
- `src/devtools` is for harnesses and experiments only, not production routes.
- Avoid generic migration buckets like `src/new`, `src/v2`, `src/temp`, or `src/rewrite`.

### 2. Introduce a frontend-facing `AppApi` seam

Views must not call `SeasonRepository`, domain projections, import orchestration helpers, or the
legacy adapter directly. They should talk to a single app-facing interface:

```ts
export interface AppApi {
  listSeasons(): Promise<SeasonSummary[]>;
  createSeason(input: CreateSeasonInput): Promise<SeasonSummary>;
  openSeason(seasonId: string): Promise<void>;
  getSeasonOverview(seasonId: string): Promise<SeasonOverview>;
  getStandings(seasonId: string, query: StandingsQuery): Promise<StandingsData>;
  getHistory(seasonId: string, query?: HistoryQuery): Promise<HistoryData>;
  getImportDraft(seed?: ImportDraftSeed): Promise<ImportDraftData>;
  getImportReview(sessionId: string): Promise<ImportReviewData>;
}
```

Two implementations are planned:

- `MockAppApi` for UX-first delivery and design review
- `TsAppApi` for live browser-local data backed by the existing TS domain

### 3. Keep Zustand, but narrow what each store owns

Zustand remains the selected state tool, but stores should own only frontend concerns:

- shell state: active route, selected season, sidebar state, modal state
- query state: selected standings category, table sorting, filters
- workflow state: current import wizard step, selected review candidate, pending toasts
- environment state: active `AppApi` implementation, mock scenario selection in dev

Domain truth stays outside Zustand and is fetched through `AppApi`.

### 4. Route model follows the redesign spec

The new app should use explicit top-level routes matching the design draft:

- `season`
- `standings`
- `import`
- `corrections`
- `history`

These routes should be stable even while some sections are still mock-backed.

### 5. Frontend contracts should map from existing TS domain data

The app-facing DTOs should be derived from the real data the repo already moves around:

- `SeasonDescriptor` and projected race coverage
- standings rows derived from `computeStandings()`
- timeline/history rows derived from the event log
- import review items derived from `ImportSession` and `OrchestratedReviewEntry`

That keeps mock data realistic and reduces adapter churn later.

## Deliverables

- `AppApi` TypeScript contract and DTO definitions
- `MockAppApi` with fixture scenarios
- `TsAppApi` plan and method mapping to current TS modules
- App-level provider or hook for dependency injection
- Updated route/shell ownership plan for Zustand stores
- Documented folder boundaries for migration and post-cutover cleanup

## Acceptance criteria

- [ ] No page component imports repository, projection, ranking, portability, or legacy adapter
      modules directly.
- [ ] A mock and live API implementation can be swapped without changing screen components.
- [ ] The route model matches the updated frontend spec.
- [ ] Zustand is retained for UI/workflow state, not as a duplicate domain source of truth.
- [ ] App DTOs are explicitly documented against current TS domain types.
- [ ] New product UI work does not go into `src/legacy`, `public/legacy`, or `src/devtools`.

## Suggested live-method mapping

| App API area | Existing backing in repo |
|---|---|
| seasons | `SeasonRepository`, projected race coverage helpers |
| standings | `projectState()`, `computeStandings()`, exclusion helpers |
| history | event-log projection and timeline synthesis logic already present in `src/legacy/api/runtime.ts` |
| import review | `startImport()`, `runMatching()`, `getReviewQueue()`, `resolveReviewEntry()`, `finalizeImport()` |
| exports | `exportLaufuebersichtDualPdfs()`, `exportGesamtwertungWorkbook()` |
| season portability | `exportSeason()`, `importSeason()` |

## Implementation steps

1. Create `AppApi` contracts and route-level DTOs in a frontend-facing module.
2. Create the migration-safe folder skeleton under `src/app`, `src/api`, `src/features`, and shared
   UI directories before adding more screen code.
3. Define `MockAppApi` fixtures that mirror current TS domain data shapes.
4. Add an API provider and hooks such as `useAppApi()`.
5. Refactor future pages to depend only on those hooks plus focused Zustand UI stores.
6. Add a `TsAppApi` adapter layer that composes current TS modules without leaking them into views.

## Test plan

- Unit tests for DTO mapping and mock/live contract parity
- Component tests proving pages render against both mock and live API providers
- Focused integration tests for `TsAppApi` method mapping over browser-local storage

## Definition of done

- [ ] `AppApi` boundary is implemented and documented
- [ ] Mock and live implementations share the same contract
- [ ] New screens can be built without importing legacy bridge code
- [ ] The frontend rewrite has a stable architecture to build on
- [ ] The repo has explicit migration folder boundaries that prevent old/new file sprawl
