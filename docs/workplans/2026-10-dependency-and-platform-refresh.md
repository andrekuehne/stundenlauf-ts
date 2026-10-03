# Dependency and Platform Refresh Workplan

## Objective and scope

Make Linux the primary development environment while preserving Windows development and browser compatibility. Establish a reproducible build, update dependencies, enable Dependabot, and leave a verified baseline for subsequent feature improvements.

- Plan date: 2026-10-03.
- Investigation baseline: commit 993f6b80a722b8a770bed364ebdb8a66eaf126e9 on main.
- Status: In Progress. Implementation started on 2026-10-03; package and external-gate status is recorded below.
- Execution owner: `/root`, the sole dependency and integration coordinator, coordinating scoped implementation and independent review subagents.
- Priority: baseline repairs and dependency automation first, then dependency migrations and browser verification.

The application is a static React/Vite PWA deployed to GitHub Pages. It stores season data in browser-local IndexedDB and has no application backend. Excel imports use SheetJS; Excel exports use ExcelJS. Season backups are ZIP archives containing a manifest and event log.

Included: toolchain pins, configuration cleanup, dependency updates, dependency advisories, Linux/Windows CI, Dependabot, browser regression checks, and related documentation.

Excluded: new race-tracking features, UI redesign, ranking or matching rule changes, replacement hosting, storage/event-schema redesign, and replacing ExcelJS as an unrelated library migration.

The user will provide organizer workbooks later. Their absence must not block WP-00 through WP-11. Real-workbook and desktop spreadsheet acceptance is tracked separately in WP-12.

## Investigation evidence

These observations are a dated snapshot, not a substitute for checking the implementation branch.

| Area | Observed state | Consequence |
|---|---|---|
| Runtime | Local Node 24.21.0; CI Node 22; Node types 25.6.0 | Align runtime, types, and CI. |
| Package manager | Manifest pins pnpm 10.33.0; initial development command resolved another major | Ensure the selected package manager actually follows the repository pin. |
| Production build | Passed on Linux with Node 24 and pinned pnpm | The project already supports a Linux build. |
| Type checking | Passed | Preserve strict checks during migrations. |
| Initial tests | 637 passed and 35 failed across 64 files | Repair the fixture helper before interpreting dependency regressions. |
| Diagnostic helper fix | Copying workbook bytes made all 672 tests and the coverage gate pass | Apply and regression-test the confirmed fix in WP-01. |
| Coverage after diagnostic fix | Lines/statements 74.69%, branches 78.29%, functions 82.12% | Compare future coverage against meaningful behavior and existing gates. |
| Lint | Passed before build; 191 errors after build | Generated ESLint configuration changes the active rules. |
| Formatting | Check failed for 99 files | Establish formatting in a dedicated commit before making it mandatory. |
| Fixture CLI | Failed because vite-node was not found | Directly declare or replace the script runner. |
| Browser fixtures | No organizer XLSX files in the checkout | Create automated smoke tests using synthetic input. |
| Dependabot | No configuration; GitHub API reported alerts disabled | Configure version updates and activate repository settings. |
| Audit | 78 advisory records across 22 package names | Separate browser, development/build, and unused dependency applicability. |
| Deployment | Latest main deployment passed on 2026-04-30 | Preserve Pages deployment behavior and the existing base path. |

The diagnostic fix and verification were performed in a temporary copy. Installation there used a frozen lockfile with lifecycle scripts disabled. Normal installation, build-script policy, and Git hook setup still require verification during implementation. The source checkout was not changed by that investigation.

Relevant starting points:

- [Package manifest](../../package.json), [lockfile](../../pnpm-lock.yaml), [pnpm build policy](../../pnpm-workspace.yaml).
- [Application TypeScript config](../../tsconfig.json), [tooling TypeScript config](../../tsconfig.node.json).
- [Vite config](../../vite.config.ts), [Vitest config](../../vitest.config.ts), [ESLint config](../../eslint.config.ts).
- [Existing CI/deployment workflow](../../.github/workflows/ts-deploy.yml), [Playwright config](../../playwright.config.ts).
- [Fixture helper](../../tests/ingestion/xlsx-test-helpers.ts), [fixture CLI](../../scripts/dump-local-excel-fixtures.ts).
- [Existing test-first workflow](../../.cursor/rules/tdd-workflow.mdc), [TypeScript testing standards](../../.cursor/rules/typescript-testing-standards.mdc).

## Orchestrator execution contract

1. Read the current repository instructions and working-tree state. Record user changes and preserve them. Reproduce the relevant baseline before changing versions.
2. Assign each subagent one package or one clearly bounded migration. Give it its inputs, allowed files, prerequisites, DoD, and required evidence.
3. Use isolated worktrees when available, or disjoint file ownership in a shared checkout. Never let two subagents edit the same file concurrently.
4. The orchestrator is the integration owner and the only writer of shared dependency files: package.json, pnpm-lock.yaml, and pnpm-workspace.yaml. Subagents propose dependency changes and compatibility evidence; the integration owner applies them serially. Transfer ownership explicitly if one subagent becomes the dependency coordinator.
5. Coordinate ownership of root configs, workflows, README, PROJECT_PLAN, and this plan before editing. Formatting sweeps run exclusively, as their own commit.
6. Parallelize investigation, test design, and review. Serialize dependency resolution, lockfile writes, package-manager migrations, and checks that rewrite build output.
7. Revalidate current upstream versions, Node engine floors, peer dependencies, and migration guides before each family update. Version targets in this plan are the investigation snapshot.
8. For behavior fixes, add a meaningful failing regression first. For dependency-only changes, use existing tests and add coverage when a changed behavior or uncovered compatibility risk warrants it. Do not lower coverage thresholds to obtain a pass.
9. Stage one package or coherent dependency family at a time, then run its acceptance checks. Require independent review of the implemented result before accepting it as complete or releasing its dependent work packages. Run the full gates at the milestones below and after subsequent changes that affect them.
10. Assign a separate review subagent who did not author the package's changes. Resolve required findings and obtain review of the revised result. Apply this gate to every work package, including each WP-09 subpackage, and retain a final review of the combined implementation.
11. Record decisions and evidence in this plan. A proposed change, a local pass, a remote CI pass, a repository-setting change, and an accepted independent review are different evidence; report each accurately.

Every subagent handoff must include:

- Package ID, status, and exact files changed.
- Resulting behavior and implementation decisions.
- Commands run, outcomes, and test environment.
- Requested dependency edits with engine and peer compatibility.
- Remaining findings, external verification, and follow-up work.
- Commit or patch reference, where applicable.

### Independent review gate for every work package

Independent review is mandatory after implementation and before a work package is marked Done. It also applies to research/configuration/documentation packages and to WP-09A through WP-09D. A package implementer cannot approve their own package; the reviewer must not have authored any part of the changes under review.

1. The implementation owner completes the candidate changes and applicable checks, then sets the package to Ready for Review. Identify the exact candidate commit or diff and provide its DoD, changed files, decisions, and test evidence.
2. The orchestrator assigns a separate review subagent. Give it the requirements, baseline and candidate revisions, diff, and verification evidence. The reviewer inspects the actual sources/configuration and tests, validates the claimed DoD, and independently reproduces the checks needed to assess the changes. The implementation summary alone is insufficient evidence.
3. The reviewer checks correctness, regression coverage, platform compatibility, relevant dependency/engine/peer constraints, scope, and documentation in proportion to the package. It reports findings with file/line references, impact, and required fixes, or explicitly records that no actionable findings remain. It does not edit the implementation it is reviewing.
4. Findings that violate a DoD item or affect correctness, security, or supported-platform compatibility must be resolved before acceptance. Return the package to Changes Requested, have its implementation owner fix it, and review the revised candidate and relevant checks again. Other suggestions may be deferred only with a recorded rationale, owner, and follow-up; a deferral cannot waive a required DoD item.
5. Record the reviewer, reviewed revision, review outcome, finding dispositions, re-review evidence, and remaining external gates. Mark Done only when the independent review is accepted and every other DoD item is verified. Dependent packages requiring this result may then proceed; unrelated work can continue during review.

Use Planned, In Progress, Ready for Review, Changes Requested, Reviewed / Pending External Verification, Done, and Awaiting Fixtures as appropriate. Review acceptance does not turn missing remote CI, repository-setting, fixture, or desktop evidence into a completed check. If later integration changes an accepted package's implementation, obtain review of those changes before relying on the prior acceptance.

At Milestone B, assign an independent reviewer of the combined implementation to check cross-package interactions and final evidence. The final review supplements the per-package reviews.

## Work package map

Dependencies refer to integrated, independently reviewed results meeting their DoD, except where explicitly identified as preparation or activation work.

| ID | Work package | Depends on | Suggested owner | Initial status |
|---|---|---|---|---|
| WP-00 | Baseline and compatible target selection | None | Orchestrator + research agent | Planned |
| WP-01 | Repair synthetic workbook byte handling | WP-00 | Test/ingestion agent | Planned |
| WP-02 | Canonical configs and fixture CLI | WP-00 | Build-tooling agent | Planned |
| WP-03 | Reproducible Linux/Windows toolchain | WP-01, WP-02 | Dependency coordinator | Planned |
| WP-04 | Formatting baseline | WP-03 | Exclusive formatting agent | Planned |
| WP-05 | Linux/Windows CI and Actions refresh | WP-03, WP-04 | CI agent | Planned |
| WP-06 | Dependabot configuration and activation | WP-00; WP-05 for activation verification | Automation agent + orchestrator | Planned |
| WP-07 | Compatible updates and advisory remediation | WP-05 | Dependency coordinator + audit reviewer | Planned |
| WP-08 | SheetJS distribution update | WP-07 | Spreadsheet agent + coordinator | Planned |
| WP-09 | Major tooling migrations | WP-08 | Tooling agents + coordinator | Planned |
| WP-10 | Browser, persistence, export, and PWA verification | WP-09; test preparation can start after WP-00 | Browser-test agent | Planned |
| WP-11 | Documentation and final integration | WP-05 through WP-10 | Orchestrator + documentation/review agent | Planned |
| WP-12 | Organizer fixtures and desktop spreadsheet acceptance | WP-08, WP-10, user-provided fixtures | Spreadsheet QA agent + user | Awaiting fixtures |

Suggested execution waves:

1. WP-00; then WP-01 and WP-02 in parallel. Prepare WP-06 and WP-10 independently.
2. Integrate WP-03 and the exclusive WP-04 formatting commit. Integrate WP-05 and WP-06, then establish the first milestone.
3. WP-07 and WP-08 serially, with separate review and test design in parallel.
4. WP-09 as separate compatible-family migrations; WP-10 and WP-11 verify the final integrated result.
5. WP-12 when the fixtures and desktop validation are available. Keep its acceptance status distinct from the maintenance delivery.

## WP-00 — Baseline and compatible target selection

**Outcome:** A recorded starting point and a version strategy grounded in current upstream support.

**Owned outputs:** The execution record in this plan; proposed target matrix. No dependency mutation in this package.

**Tasks:** Record HEAD, working-tree changes, Node/pnpm versions, OS, available browser tools, normal frozen installation, checks, and the audit. Compare failures with the investigation evidence. Verify package-manager support in Dependabot and the compatibility of each proposed dependency family.

The dated starting strategy is Node 24 LTS, pnpm 10.34.6, Node 24 types, and supported mutually compatible tooling. See [Node release status](https://nodejs.org/en/about/previous-releases) and [Dependabot ecosystem support](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories).

**Definition of Done:**

- [ ] Starting commit, user changes, environment, and installation method are recorded.
- [ ] Relevant failures are reproduced or differences are explained without conflating them with upgrade regressions.
- [ ] Target matrix records exact versions, Node floors, important peers, and upstream references.
- [ ] Fresh full and production-only audit results are recorded, with distinct findings rather than a vulnerability count alone.
- [ ] Each remaining environment or account-access limitation has a precise verification action and owner.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-01 — Repair synthetic workbook byte handling

**Outcome:** Synthetic import tests receive exactly the workbook bytes on both platforms.

**Primary files:** tests/ingestion/xlsx-test-helpers.ts and related regression tests.

**Tasks:** Add a regression using a byte view with nonzero offset and unrelated bytes before/after it. Copy only the view's bytes into the returned ArrayBuffer. The confirmed candidate is replacing the helper's Buffer slice/backing-buffer return with a fresh Uint8Array copy. Verify all ingestion tests and API import workflows.

**Definition of Done:**

- [ ] A deterministic regression fails before the fix and passes afterward; it does not rely on a particular Node buffer-pool size.
- [ ] The helper returns the correct byte length and workbook content without surrounding allocation bytes.
- [ ] Singles, couples, workbook parsing, and API import tests pass with synthetic fixtures.
- [ ] The full current suite and coverage gate pass on the selected Linux runtime; Windows verification is recorded in WP-05.
- [ ] Production parsing behavior and ranking/matching rules are unaffected.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-02 — Canonical configs and fixture CLI

**Outcome:** Build, lint, and tests use one consistent configuration; development commands work after a clean installation.

**Primary files:** Root TypeScript/config files, generated config JS/declarations, fixture CLI, and relevant build tests. Manifest changes go through the coordinator.

**Tasks:** Reconcile the active JavaScript ESLint rules with the TypeScript source before removing duplicate config artifacts. Preserve intended test-specific rules through an explicit decision; keep strict application linting. Revise type-check/build configuration to check application and tooling sources without regenerating adjacent JS/declarations. Resolve project references and ESM path handling coherently. Declare a compatible fixture runner directly or adopt a verified replacement that resolves the existing path alias.

**Definition of Done:**

- [ ] Vite, Vitest, and ESLint each use an authoritative source configuration with no stale generated duplicates.
- [ ] Type checking covers application, tests, scripts, and build/test/lint tooling; browser-test configs/sources are included before final delivery.
- [ ] Lint succeeds before and after a production build with identical intended rules.
- [ ] Two successive builds do not modify tracked files or recreate removed configuration artifacts.
- [ ] inspect:excel-fixtures exits successfully and reports no fixtures when the local directory is empty.
- [ ] The fixture CLI works from a clean install through a directly declared runner; it has no accidental transitive-tool dependency.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-03 — Reproducible Linux/Windows toolchain

**Outcome:** Developer installations and CI use the same supported runtime and package manager.

**Primary files:** A runtime version file, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, and .gitattributes as necessary.

**Tasks:** Pin a selected Node 24 patch and compatible pnpm 10.x release. Set the Node engine floor to satisfy the selected dependencies, align Node types to major 24, and ensure installation tooling respects the packageManager field. Verify normal lifecycle behavior and the esbuild allowlist. Define line-ending rules and keep scripts portable across Bash and PowerShell/cmd. Avoid shell-specific inline environment assignments in package scripts.

**Definition of Done:**

- [ ] Runtime pin, Node engines, Node types, package-manager pin, and documentation agree.
- [ ] Clean frozen installation succeeds without rewriting the lockfile; approved build scripts and Git hook setup behave as intended.
- [ ] Native build-tool binaries install correctly on Linux and Windows; Windows installation is verified in WP-05.
- [ ] Git attributes define consistent text line endings and executable-script handling where applicable.
- [ ] Existing development, quality, build, and preview commands remain portable.
- [ ] Runtime and package-manager major upgrades beyond the chosen lines are deferred with a compatibility reason, if applicable.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-04 — Formatting baseline

**Outcome:** Formatting becomes an enforceable check with a reviewable formatting-only change.

**Primary files:** Files covered by the existing format script; formatting configuration/script adjustments only when necessary.

**Tasks:** Run formatting exclusively after baseline repairs. Keep the sweep separate from dependency migrations and behavioral changes. Ensure documented check commands match actual formatting coverage.

**Definition of Done:**

- [ ] format:check passes across its intended scope.
- [ ] The formatting commit contains no behavior or dependency changes.
- [ ] Lint and type checking still pass after the sweep.
- [ ] The CI owner receives a passing formatting baseline before making this check required.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-05 — Linux/Windows CI and GitHub Actions refresh

**Outcome:** Pull requests verify both development platforms; Pages deployment retains a dependable release path.

**Primary files:** .github/workflows/ts-deploy.yml and additional workflow files if separation improves clarity.

**Tasks:** Run frozen install, formatting, lint, type checking, tests with coverage, and production build on ubuntu-latest and windows-latest using the shared runtime pin. Refresh Actions against their current release requirements. Scope quality-run concurrency to the branch or PR and isolate Pages deployment concurrency. Limit Pages/id-token permissions to jobs that require them. Keep deployment on successful main pushes and use the validated Linux artifact.

**Definition of Done:**

- [ ] Both OS jobs pass remotely for the integrated baseline, with exact runtime/package-manager versions visible.
- [ ] Lint, formatting, type checking, coverage, and build failures fail the corresponding checks.
- [ ] Unrelated PR and branch quality runs cannot cancel each other through a shared Pages concurrency group.
- [ ] Pages deployment depends on successful required checks and a validated artifact; PR jobs do not deploy.
- [ ] Action updates preserve installation, caching, artifacts, and deployment semantics.
- [ ] Required-check configuration is verified when repository access permits it; unavailable configuration is recorded as a pending external gate.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-06 — Dependabot configuration and activation

**Outcome:** Recurring version-update PRs cover pnpm and Actions; dependency security updates are active.

**Primary files:** New .github/dependabot.yml; repository dependency/security settings; maintenance instructions.

**Tasks:** Use the npm ecosystem at the repository root for pnpm, plus github-actions. Start with weekly checks and a modest PR limit. Group coupled React packages and Vitest/coverage packages; group routine minor/patch updates. Review coupled build/lint major migrations coherently. Enable the dependency graph, alerts, and security updates through available repository permissions. Verify that the pinned pnpm version and build-policy fields are accepted by actual update jobs.

**Definition of Done:**

- [ ] Valid version-2 configuration covers the root manifest/lockfile and Actions workflows.
- [ ] Weekly schedule, PR limits, and grouping are explicit; no unsupported pnpm ecosystem identifier is used.
- [ ] Dependabot successfully generates or checks an update using the actual repository configuration.
- [ ] A representative generated PR has a consistent manifest/lockfile and passes frozen installation and the quality checks.
- [ ] Dependency graph, alerts, and security-update activation are verified; inaccessible settings remain explicitly pending, not marked activated.
- [ ] Dependency PRs are reviewed with required checks; automatic merging is not introduced by this workplan.
- [ ] SheetJS's separate distribution/update procedure is documented in WP-08; Dependabot is not claimed to cover its pinned CDN releases automatically.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

Configuration semantics are documented in the [GitHub options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).

## WP-07 — Compatible updates and advisory remediation

**Outcome:** Routine updates are applied before larger migrations, and remaining advisories have concrete disposition.

**Primary files:** Manifest/lockfile/build policy through the coordinator; an advisory disposition section in this plan.

**Tasks:** Update within supported declared ranges first. Refresh compatible transitives and inspect the resulting diff. Prioritize Vite, Vitest, React Router, PWA/Workbox, and affected transitives. Verify whether pdfjs-dist is unused and remove it if confirmed. Keep direct dependencies that the app or plugins require. Inspect ExcelJS's tmp and uuid paths and distinguish browser reachability from Node-only paths. Use scoped overrides only with compatibility evidence; do not force incompatible major transitives to silence audit output.

**Definition of Done:**

- [ ] Routine changes are separate from major-family migrations and recorded with resolved versions.
- [ ] Unused dependency removal is supported by source/config/script inspection and passing relevant checks.
- [ ] Direct/transitive advisories are fixed where compatible updates are available.
- [ ] Each residual finding records package/version, advisory, dependency path, execution context, applicability, remediation or deferral reason, owner, and review trigger.
- [ ] No high/critical finding is left unreviewed; findings requiring major migrations are assigned to WP-08 or WP-09.
- [ ] Any override is narrowly scoped, tested, and has a documented removal condition.
- [ ] Frozen installation and full quality/build gates pass; full and production audit results are recorded again.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

The baseline included Windows development-server advisories for Vite, a Vitest UI-server advisory, vulnerable SheetJS imports, and ExcelJS transitives. Severity labels alone do not establish reachability in this static application.

## WP-08 — SheetJS distribution update

**Outcome:** Excel imports use a maintained official SheetJS release while preserving organizer parsing semantics.

**Primary files:** Manifest/lockfile through the coordinator; src/ingestion/, relevant tests, fixture tooling, and maintenance documentation as needed.

**Tasks:** Recheck upstream and install a versioned official distribution; the investigation target was 0.20.3. Default to a versioned official tarball with lockfile integrity. Consider vendoring the official tarball if a reproducibility/offline-install requirement warrants it, and record the decision. Preserve the xlsx import name where practical. Keep ExcelJS 4.4.0 for exports unless a separately justified change is required. Exercise Unicode names, decimal commas, missing cells, empty rows, duration/division markers, and singles/couples routing with synthetic tests.

**Definition of Done:**

- [x] The installed SheetJS version is from an official versioned source and exceeds the applicable vulnerable ranges.
- [x] Clean Linux/Windows frozen installs can obtain the chosen artifact, with integrity captured in the lockfile.
- [x] Existing ingestion/API import tests and relevant export/portability tests pass.
- [x] Synthetic regression coverage preserves parser values and error behavior; organizer workbooks remain tracked separately in WP-12.
- [x] No change to matching, ranking, event formats, or IndexedDB schema is introduced incidentally.
- [x] A manual upstream release-check procedure, source, owner, and review cadence are documented; no recurring automation is created by this package.
- [x] ExcelJS remains under review for advisories/maintenance without claiming a nonexistent newer official release.
- [x] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

The npm registry's xlsx release remained 0.18.5 at investigation time. See [official SheetJS installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), [prototype-pollution advisory](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), [ReDoS advisory](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9), and [ExcelJS releases](https://github.com/exceljs/exceljs/releases).

## WP-09 — Major tooling migrations

**Outcome:** Build and test tooling move to current mutually supported stable releases through independently reviewable migrations.

**Primary files:** Manifest/lockfile through the coordinator; relevant root configs, build tests, and migration-affected test code.

Subagents may investigate the following families in parallel. Apply their updates sequentially against the latest integrated lockfile.

| Subpackage | Dated target/approach | Acceptance focus |
|---|---|---|
| WP-09A: TypeScript | Move 5.8 to 5.9.3 first; evaluate 6.0.3 against current tooling support | Strict types, alias resolution, no-emit configs, compiler deprecations. |
| WP-09B: Test tooling | Vitest 5.0.3 with exactly matching coverage package; compatible jsdom and Testing Library | Coverage semantics, mocks, jsdom/browser APIs, React act-warning guard, fixture runner. |
| WP-09C: Build tooling | Vite 8.x with its matching React plugin and compatible PWA/Workbox releases | Rollup-to-Rolldown config migration, browser output, lazy loading, Pages base path, SW generation. |
| WP-09D: Lint/tooling | Compatible ESLint 10.x, @eslint/js, typescript-eslint, and supporting tools | Flat config loading, strict typed linting, tests/tool scripts, format consistency. |

Choose an integration order from actual peer constraints. Vitest/coverage may need migration before the Vite family. Refresh minor React/ReactDOM/types together, and keep later patch changes within their supported families. TypeScript 7 was the registry latest at investigation time, but typescript-eslint documented support below 6.1; defer incompatible compiler majors with a recorded reason. See [typescript-eslint support](https://typescript-eslint.io/users/dependency-versions/), [Vite migration](https://vite.dev/guide/migration), and [Vitest migration](https://vitest.dev/guide/migration/).

**Definition of Done:**

- [x] Each subpackage records selected exact versions, engine/peer compatibility, migration steps, and its separate evidence.
- [x] All families resolve together without unreviewed peer or engine incompatibilities.
- [x] Runner and coverage package versions match; coverage gates remain meaningful after any instrumentation change.
- [x] Vite build configuration and build-entry tests reflect the chosen bundler API; lazy loading and base-path behavior remain verified.
- [x] The fixture CLI still runs after the test-tooling migration with its explicitly declared runner/replacement.
- [x] Build, lint, type checks, format checks, tests, and coverage pass on both OS CI jobs for the final dependency set.
- [x] Any held-back major has a specific compatibility blocker and follow-up, not a blanket dependency ignore.
- [x] Advisory results are refreshed; no unreviewed high/critical residual remains.
- [x] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-10 — Browser, persistence, export, and PWA verification

**Outcome:** Automated browser checks exercise the production app without organizer workbooks or README screenshot side effects.

**Primary files:** Dedicated e2e smoke tests and synthetic input generation, playwright.config.ts, test scripts/workflows through their owners.

**Tasks:** Build fixture-independent Playwright tests against production output at the configured Pages base path. Use bundled Chromium consistently on Linux and Windows, with explicit Windows selection instead of requiring system Chrome. Install Linux browser system libraries for CI. Test season creation, synthetic import/review/finalization, standings, persistence after reload, archive download/restore, Excel/PDF downloads, and offline startup after SW activation. Verify update prompting and data retention across controlled successive local production builds. Keep organizer-only README screenshot generation optional.

**Definition of Done:**

- [ ] A documented browser-test command succeeds from a clean checkout with no organizer XLSX files.
- [ ] Dedicated smoke tests run on Linux and Windows CI using a known browser version; failures retain useful trace/screenshot evidence.
- [ ] Tests run against production output, exercise the configured subpath, and handle first service-worker activation deterministically.
- [ ] IndexedDB persistence and season archive round-trip retain the expected season/event data.
- [ ] XLSX/PDF downloads are valid and contain expected synthetic results; browser checks go beyond testing a download filename alone.
- [ ] Offline startup and the update prompt are verified, with season data preserved after applying an update.
- [ ] CI smoke tests do not require private fixtures or overwrite tracked README screenshots.
- [ ] Browser-test sources/configs receive the agreed type/lint coverage; the currently unconfigured browser support assumptions are stated accurately.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-11 — Documentation and final integration

**Outcome:** The repository can be handed to a developer on either OS with accurate setup and maintenance instructions.

**Primary files:** README.md, this plan, docs/ACCOMPLISHMENTS.md, and relevant portions of PROJECT_PLAN.md. The orchestrator owns shared-file integration.

**Tasks:** Document the runtime/package-manager pins, installation, Linux browser dependencies, Windows browser selection, quality and smoke-test commands, optional organizer fixtures, archive-based migration from the old browser, SheetJS release checks, and advisory decisions. Update dependency and folder descriptions where this maintenance changed them. Keep historical feature status changes evidence-based. Review the combined diff and run the final gates.

**Definition of Done:**

- [ ] README instructions match the implemented scripts and selected tools on both OSes.
- [ ] Documentation explains that browser data is migrated through .stundenlauf-season.zip archives and is absent from a Git checkout.
- [ ] This plan records package status, version decisions, checks, PR/commit references, and pending external verification.
- [ ] Accomplishments describe implemented outcomes; relevant project-plan maintenance links/status are updated without rewriting unrelated historical claims.
- [ ] A fresh frozen install and all final automated gates pass, including lint again after build.
- [ ] Build/check commands produce no unexpected tracked changes, and an independent reviewer has checked the integrated result.
- [ ] GitHub setting activation and remote OS checks are distinguished from locally prepared changes wherever access limits verification.
- [ ] WP-12 is explicitly pending when fixtures or desktop spreadsheet checks remain unavailable.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## WP-12 — Organizer fixtures and desktop spreadsheet acceptance

**Outcome:** The maintained app is checked against actual organizer workbooks and target desktop spreadsheet applications.

**Inputs:** User-provided workbooks; expected outcomes or pre-update reference results; Windows Excel and Linux LibreOffice validation access.

**Primary files:** Local ignored fixture files, privacy-safe expectation documentation, optional synthetic/anonymized regression tests. Do not commit identifiable organizer data as part of the maintenance sweep.

**Tasks:** Run the fixture CLI and optional integration suites once inputs arrive. Compare imported rows, names/year-of-birth/club values, race/category detection, matching outcomes, and rankings against reference expectations. Export singles, couples, kids participation, and PDF results. Open workbook exports in Excel and LibreOffice and check values, Unicode, merges, widths, number formats, print layout, and warnings. Verify an existing season archive restores successfully after migration.

**Definition of Done:**

- [ ] Actual-workbook validation has inputs and expected results recorded without exposing private participant data.
- [ ] Imports and final rankings match the agreed reference outcomes, or each intentional difference is approved and explained.
- [ ] Windows Excel and Linux LibreOffice acceptance results identify application versions and checks performed.
- [ ] Existing season archives restore with unchanged relevant metadata and event content.
- [ ] Any discovered defect has a meaningful regression and passes the relevant automated suite after repair.
- [ ] Organizer-only validation is not represented as completed while fixtures or desktop access are missing.
- [ ] Independent review by a non-author is accepted and recorded; required fixes are resolved and re-reviewed.

## Milestones and final gates

### Milestone A — Reliable baseline and dependency automation

WP-00 through WP-06 are integrated and verified: synthetic tests pass, config generation is fixed, tools are pinned, formatting is clean, OS CI passes, and Dependabot activation is verified. A missing external setting/check leaves the corresponding gate pending; independent dependency work may continue.

### Milestone B — Dependency refresh ready for feature work

WP-07 through WP-11 are complete in addition to Milestone A. All selected dependencies are compatible; SheetJS uses its maintained official distribution; production browser/PWA checks pass; documentation and advisory disposition are current.

Use the implemented equivalents of this command sequence, with frozen installation first:

~~~bash
pnpm install --frozen-lockfile
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test:coverage
pnpm run build
pnpm run lint
pnpm run inspect:excel-fixtures
# Run the dedicated fixture-independent Playwright smoke command added in WP-10.
pnpm audit
pnpm audit --prod
git status --short
~~~

Audit commands may return nonzero for reviewed residuals. Retain their findings and decisions; do not conceal them by weakening tests or asserting that every audit record is exploitable. Execute checks on the integrated final versions and retain remote Linux/Windows evidence. Checks must not create unexpected tracked changes; expected branch edits should be committed or compared against the pre-check working-tree state.

### Milestone C — Organizer and desktop acceptance

WP-12 is complete. This is a separate acceptance gate and remains pending until the user supplies fixtures and the desktop checks are performed. Milestone B can be delivered while Milestone C is pending, provided that limitation is stated clearly.

**Overall maintenance Definition of Done (Milestones A and B):**

- [ ] WP-00 through WP-11 meet their individual DoD with recorded evidence and accepted independent review after implementation.
- [ ] Each WP-09 subpackage has an accepted independent review; the combined implementation has also received final independent review.
- [ ] Linux and Windows use the same selected toolchain and pass required automated gates.
- [ ] Application storage, season archives, ranking rules, matching semantics, German workflows, Pages routing, and PWA updates retain verified behavior.
- [ ] Dependabot version/security-update operation is verified and coupled upgrades have a review process.
- [ ] Remaining advisories and held-back majors have concrete owners and review triggers.
- [ ] A reviewer can reproduce the final checks from the README without organizer fixtures.
- [ ] Missing real-workbook, desktop, repository-setting, or remote-CI evidence is listed explicitly rather than represented as completed.

## Execution record

Update this section during implementation. Keep planned work separate from completed evidence.

| Package | Status | Owner | Commit/PR | Validation evidence | Independent reviewer / outcome | Remaining action |
|---|---|---|---|---|---|---|
| WP-00 | Done | /root + target_research | 091e08c | Baseline, exact targets, full/prod inventory verified | independent_reviewer accepted 091e08c after correction/re-review | Future external checks assigned below. |
| WP-01 | Done | browser_prep | 400aa93 | Deterministic red; 130 ingestion/API + 674 full coverage pass on Linux Node24.21.0 | independent_reviewer accepted400aa93; independently reran130 tests | Windows verification assigned WP-05. |
| WP-02 | Done | target_research + /root coordinator | f116db4 | Expanded lint/types; 677tests; two builds; clean CLI | independent_reviewer acceptedf116db4, reran16 focused tests/types/lint/CLI | Browser additions reviewed again WP-10. |
| WP-03 | Done | /root dependency coordinator | 44c7438; remote9c2fda4 | Clean frozen Linux + Windows installs/native tools; real hooks;677tests bothOS | independent_reviewer accepted44c7438 + remote supplemental9c2fda4 | Final toolchain/OS checks after migrations. |
| WP-04 | Done | /root exclusive formatter | 6f43378 | format/lint/types pass;104files pure Prettier3.8.2 output | independent_reviewer accepted6f43378, allfiles compared to formatted baseline | CI owner receives passing baseline. |
| WP-05 | Done | target_research | 9c2fda4; run37130657137 | BothOS677tests, frozen install, format/lint/types/coverage/build/postlint/CLI/gitdiff pass; branch rules inspected | independent_reviewer accepted9c2fda4 incl independent remote fetch/log review | Final OS rerun after09/10; required CI enforcement absent. |
| WP-06 | Reviewed / Pending External Verification | /root | bd7bc4f; 63f8f30 | YAML/options and actual graph/alerts/security activation verified | independent_reviewer acceptedbd7bc4f and63f8f30 after ruleset correction | Actual new configuration update job and representative PR pending. |
| WP-07 | Done | /root coordinator + target_research | 597cc8f; implementation16ff2ae | Frozen full gates677tests; full5/prod3 reviewed findings | independent_reviewer accepted597cc8f;216 independently reproduced tests; no findings | SheetJS→08, Vitest→09B, reviewed UUID residual. |
| WP-08 | Done | /root coordinator | ee7b423; implementation8a445a8; run37132912040 | Official0.20.3/integrity; full677tests; fresh bothOS retrieval/gates | independent_reviewer acceptedee7b423 local155tests and independent bothOS logs; no findings | Organizer/desktop acceptance remains12. |
| WP-09 | Done | /root coordinator + scoped implementation agents | 055a99e; run37137700317 | Compatible serialA→B→C→D; final realbothOS695/68/118 gates pass | independent_reviewer accepted each subpackage and finalbothOS supplement | Production browser integration/remote smoke in10. |
| WP-09A | Done | /root coordinator + target_research | 0b08413; compiler5f977c7; remote740ae4a | Actual5.9+6 full679-test gates; finalbothOS695-test dependency set | independent_reviewer accepted0b08413 + supplement055a99e; no findings | TS7 holdback has specific peer blocker/trigger. |
| WP-09B | Done | /root coordinator + browser_prep + target_research | 954a139; f2eabd2/e9046a5/cbb7ff1; remote740ae4a | Full695tests;118-source scope; finalbothOS gates | independent_reviewer accepted954a139 after required fix/re-review + supplement055a99e | Production PWA lifecycle in10. |
| WP-09C | Done | /root coordinator + build_migration | 42586ff; implementation835a522; remote740ae4a | Frozen695-test gates; real production2-test interop; nativebothOS builds | independent_reviewer accepted42586ff + supplement055a99e | Root production browser integration/CI in10. |
| WP-09D | Done | /root coordinator + build_migration | 055a99e; implementationbfc34fd; run37137700317 | Actual10lint/sequence checks; finalbothOS allgates695/68/118 | independent_reviewer accepted055a99e, independently fetchedbothOS logs | No remaining dependency-set OS gate. |
| WP-10 | In Progress | /root coordinator + browser_prep preparation + scoped browser validation | — | Six-file real production prototype accepted as09Cinterop proof | Pending actual root integration review | Integrate separate smoke config/script/CI; verifybothOS browsers. |
| WP-11 | Planned | TBD | — | — | Pending | Document and verify final integration. |
| WP-12 | Awaiting fixtures | TBD | — | — | Pending | Receive fixtures and perform desktop acceptance. |

For each independent review, record: package/subpackage; reviewer; exact reviewed revision; acceptance or findings; finding dispositions; fixes and re-review evidence; unresolved external gates. Add separate WP-09A through WP-09D execution rows when their migrations begin.

For each advisory disposition, record: package/version; advisory URL; dependency path; execution context and reachability; chosen action; supporting verification; owner; next review trigger.

For each version decision, record: family; selected versions; Node/peer constraints; reason for any holdback; primary-source links; affected work package; verification evidence.

### WP-06 configuration and activation evidence

- Added `.github/dependabot.yml`: npm ecosystem at root for pnpm, github-actions at root; weekly Monday06:00 Europe/Berlin; PR limits5/3; coupled React/Vitest groups, major build/lint groups, routine minor/patch group. No automatic merge configuration. YAML parses and options match current [official reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
- Preparation can proceed after accepted WP-00; activation verification depends on WP-05. Configuration on this unmerged branch is **not** proof of a Dependabot job, graph/alerts/security activation, or a generated PR. Settings route verification and actual update job/representative PR remain pending; repository administrator owns default-branch activation after PR approval. SheetJS CDN manual procedure belongs to WP-08.

### WP-01 implementation evidence

- Changed only synthetic helper and new regression: `new Uint8Array(buf).buffer` copies exactly the returned view; production parsers/ranking/matching untouched. Actual workbook bytes are embedded in an explicitly allocated Buffer view with37-byte prefix and53-byte suffix. Red returned16132 bytes versus16042 expected; green asserts length, byte content and parsed Unicode/custom-sheet values, independent of pool size. Second normal-workbook round-trip passes.
- Linux Node24.21.0/pnpm10.33.0: focused regressions2/2; ingestion/API130/130 across10files; full coverage674/674 across65files; lines/statements74.69%, branches78.29%, functions82.12%. Thresholds unchanged. Focused lint/format and typecheck pass. Evidence `/tmp/stundenlauf-refresh-evidence/wp01-*.log`. Windows verification remains WP-05.

### WP-02 implementation evidence

- Authoritative root `.ts` configs; removed six stale adjacent JS/declaration files. App/tooling configs perform strict no-emit checks, covering src/tests/scripts/e2e/allroot configs with explicit shared aliases and ESM paths. Tooling regression red3 failures, green6 build tests: no generated emissions, browser/config inclusion, alias resolution.
- Preserved the five previously active JS test-only lint exemptions explicitly in `eslint.config.ts`; application/scripts/e2e/tooling retain strict typed lint. Expanded lint passes. ESLint defineConfig replaces deprecated tseslint.config.
- Coordinator directly declared TSX4.23.15 (Node>=18), changed fixture CLI and portable build/type/lint scripts, serialized install/lock update. Lock diff adds TSX/esbuild0.28 native optional packages/peer context, without routine-family upgrades.
- Fresh no-emit checks exposed four pre-existing test-only buffer typing errors previously masked by build/reference output. Root fixed two ExcelJS test loads to use actual ArrayBuffer, and two archive Blob inputs to copy view bytes into ArrayBuffer. Relevant export/portability behavior remains covered by existing tests.
- Linux Node24.21.0/pnpm10.33.0: full coverage plus expanded types/lint pass; two successive builds and post-build lint pass without changing tracked state or recreating config artifacts. Root isolated clean frozen install `/tmp/stundenlauf-clean-wp02` passed; directly declared CLI exits0 and reports no fixtures. TSX IPC needs unsandboxed execution in this agent container; normal CI/developer environments are checked separately. Raw evidence wp02-*.log/status in session evidence directory.
- GitHub settings browser recovery found no available connected browser (`agent.browsers.list()` empty); API protection403 / settings endpoint unavailable remain external administrator actions. No setting activation asserted.

### WP-03 toolchain decisions and evidence

- Selected exact Node24.21.0 LTS, pnpm10.34.6, resolved Node types24.19.1. `.node-version`/`.nvmrc`, manifest engine `>=24.21.0 <25`, packageManager and README agree. Engine floor deliberately uses the installed patch, exceeding jsdom30's24.15 floor. Node26 Current deferred until next LTS/support review; pnpm11/12 deferred because Dependabot currently supports7–10. Coordinator checked current registry/official support metadata retained in WP-00.
- `.npmrc` enforces engines/package manager identity/version and enables repository-version management; scripts are portable pnpm commands with no inline shell env assignments. Format scope now includes src/tests/scripts/e2e/root TS configs; the existing failing style baseline is repaired exclusively in WP-04 before `ci:local` pre-push is expected to pass. Local gate includes frozen install, format, lint, types, coverage, build, post-build lint and CLI.
- Explicit build policy allows esbuild, disables core-js and dependency-level simple-git-hooks; root `prepare` remains enabled. Normal install10.34.6 passed. Removed only generated node_modules and ran fresh frozen install: passed in2.1s, no ignored-script warning, identical lock SHA256 before/after. Real `.git/hooks/pre-push` inspected and contains `pnpm run ci:local`; setup is proven in actual Git checkout, unlike clean copies without .git. Vite build and TSX CLI prove native tool binaries execute on Linux; Windows proof assigned WP-05.
- `.gitattributes`: textLF; .shLF; .cmd/.batCRLF; workbook/archive/PDF/image assets binary. `git check-attr` verified representative paths. No tracked executable scripts currently require mode changes.
- Node24.21.0/pnpm10.34.6 Linux:677tests/66files; coverage74.69% lines/statements,78.28% branches,82.12% functions, thresholds unchanged. Both type projects, expanded lint, production build, post-build lint, empty-fixture CLI pass. Raw wp03 logs/hash files retained in session evidence directory. Windows native install is explicitly delayed to WP-05 as specified by WP-03 DoD.

### WP-05 CI preparation evidence

- `.github/workflows/ts-deploy.yml` now runs allbranch pushes and main-target PRs on ubuntu-latest/windows-latest. Each OS performs frozen install, format, lint, types, coverage, production build, post-build lint, fixture CLI and tracked diff check with logged exact Node/pnpm versions. Uses shared runtimefile and packageManager; fullSHA action pins with versioncomments.
- Current Actions verified via official release/tag/action.yml/README: checkout7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1`; setup-node7.0.0 `820762786026740c76f36085b0efc47a31fe5020`; pnpm/action-setup6.1.0 `ea17c68df8912ef543352723c149a84f56e3d413`; upload-pages-artifact5.0.0 `fc324d3547104276b827a68afc52ff2a11cc49c9`; deploy-pages5.0.1 `368f82528645a54fb793d4d04e342629a3f51346`. Node24 actions require runner>=2.327.1; hosted run evidence remains required. pnpm/action-setup6 supports10; pnpm/setup1 requires11 and is not selected.
- Quality concurrency contains branch/PR plus OS; Pages concurrency is isolated and queues deployments. Only validated Linux mainpush output uploads a Pages artifact; deploy depends on bothOS quality and mainpush, with write permissions only in deploy. PR jobs cannot deploy. Existing Pages environment/subpath preserved.
- Agent actual YAML parse and official action input/SHA/permission/concurrency/conditions checks passed; Prettier workflow check and git diff --check passed. actionlint unavailable, not claimed executed. Raw wp05 validation/handoff logs retained. Actual remote OS/runner/native install evidence and repository required-check settings remain unverified until observed.

### WP-05 remote baseline and access disposition

- Real [run37130657137](https://github.com/andrekuehne/stundenlauf-ts/actions/runs/37130657137), exact head `9c2fda43fc798fd770e0a24cf42a14f3fdfa3eb8`: **success**. [Linux job](https://github.com/andrekuehne/stundenlauf-ts/actions/runs/37130657137/job/111224929400) Ubuntu24.04.5; [Windows job](https://github.com/andrekuehne/stundenlauf-ts/actions/runs/37130657137/job/111224929145) WindowsServer2025/windows-2025-vs2026. Both runners2.337.0, Node24.21.0, pnpm10.34.6. Each full required gate passed;677tests. Coverage74.31%lines/statements,78.28%branches,82.12%functions after formatting altered instrumented line count, without changing thresholds/behavior. Deploy correctly skipped on feature branch. Raw remote logs saved wp05-remote-{linux,windows}.log.
- independent_reviewer independently fetched run/jobs/logs and accepted the remote evidence for9c2fda4. This closes WP-01/WP-03 baseline Windows verification and releases WP-07 after acceptance is recorded. Final migrations/browser suite still require newbothOS runs.
- Initial direct CLI reads for alerts/security-update settings and classic main protection returned403 requiring Administration(read). An attempted activation request was **rejected before execution by automatic approval review**, because the access prerequisite was absent. No setting mutation was performed at that attempt. User then granted repo-scoped Administration(read/write) and signalled readiness. Read-only verification succeeded: alerts404(disabled), security updates200/disabled, classic branch protection404. Activation was then executed successfully under the changed access prerequisite; evidence below. Independent review required correcting an overbroad interpretation of the classic protection404: active ruleset15073731 "Main Protection" prevents branch deletion and force pushes. `GET /rules/branches/main` confirms these two rules and no required-status-check rules. Existing rules remain unchanged; adding CI enforcement is a repository-administrator decision.

### WP-06 verified activation and remaining update-job gate

- User restored repo-scoped Administration access. Root verified admin permission with read-only API calls before retrying the previously rejected activation. PUT vulnerability-alerts204 and PUT automated-security-fixes204; follow-up GET alerts204, GET security-updates200 with `{enabled:true,paused:false}`. Dependency graph SBOM GET200 contains401packages and creator `GitHub.com-Dependency-Graph`. This verifies graph/alerts/security activation on the repository; it does not verify update generation from this unmerged config. Logs wp06-{alerts,security}-{enable,verified}.log and wp06-sbom.json retained.
- Classic main branch protection endpoint returns404 `Branch not protected`; this endpoint alone does not describe ruleset protection. Active repository ruleset15073731 "Main Protection" prevents deletion and force pushes. Branch rules and ruleset APIs independently confirm no required-status-check rule. No branch policy was changed. Reviewers must require both quality jobs before merge, as documented. Evidence wp05-main-rules.json/wp05-rulesets.json and independent wp06-independent-ruleset.json.
- Actual Dependabot version-update run using new pnpm10.34.6/allowBuilds configuration and representative generated PR frozen-install/quality validation still await default-branch activation. This branch must not be merged by the agent. Owner: repository maintainer after PR approval; run/check updates, validate generated manifest/lock and bothOS gates. Package remains Reviewed / Pending External Verification.

### WP-07 decisions and advisory disposition

- Coordinator serialized within-range updates at `fd80e27`: React/DOM/types19.3.0; Router7.18.4; AutoTable5.0.8; JSZip3.10.2; Zustand5.0.15; Vite6.4.3/React plugin4.7.0; Vitest/coverage3.2.7; ESLint/@eslint/js9.39.5/typescript-eslint8.71.0; jsdom26.1.0; Testing Library React16.3.3/DOM10.4.2/jest-dom6.10.0; Playwright1.63.0; Prettier3.9.9; hooks2.14.0; jiti2.7.0; PWA1.3.0/Workbox build+window7.4.1. Node24.21.0 meets engines; upstream peers rechecked. Direct DOM and Workbox build declarations satisfy required peers. An initial retained auto-peer Workbox7.4.0 was repaired through its declared compatible range, removing the old serialization chain. `.npmrc` now enforces strict peers. No overrides introduced. Two files affected by Prettier3.9.9 are isolated in formatting-only commit `6bc4fa1`.
- Source/config/script inspection (`rg`, excluding manifest/lock and historical plans) proves pdfjs-dist unused; removed it without replacing app PDF exports. ExcelJS4.4.0 remains latest official stable and exports stay unchanged. Major migrations remain WP-09; newly observed PWA2.0.0 is evaluated there rather than silently held back.
- Compatible transitives now include tmp0.2.7, plugin-terser1.0.0/serialize-javascript7.1.2, DOMPurify3.4.16, fflate0.8.3, fast-uri3.1.8, PostCSS8.5.28/nanoid3.3.19, js-yaml4.3.2, brace-expansion1.1.21/2.1.7/5.0.12, ws8.22.0, Babel7.29.7/systemjs7.29.8, Browserslist4.29.3/browser mapping2.11.27. New full/prod audits confirm all baseline advisory records absent except the concrete residuals below. This is installed-version remediation evidence, not a claim that every baseline path was exploitable. Windows Vite development-server issues and Vitest critical UI issue are fixed in supported maintenance lines before majors.
- Post-update audit on2026-10-03: full5records (2high/3moderate/0critical); production3records (2high/1moderate). Full/prod JSON retained as wp07-audit.json/wp07-audit-prod.json. Each high is assigned to WP-08. Owner for all rows: root dependency coordinator/repository maintainer. Final migration audits will supersede these intermediate results.
- Scoped implementation agent target_research repaired ten newly exposed strict lint findings in six files at `16ff2ae`: removed redundant buffer casts and unused local values; typed mock call signatures remain intact, and matching's positional API is preserved. No rule disabled or semantic change. Root normal frozen `ci:local` passes on Linux Node24.21.0/pnpm10.34.6: format, expanded lint, both strict type projects,677tests/66files, coverage74.31%lines/statements/78.29%branches/82.12%functions, build, post-build lint and empty-fixture CLI. No tracked writes; wp07-gates.log/wp07-tracked-check.log. Major migrations and final bothOS runs remain separate gates.

| Package/version; advisory | Exact dependency path/context and applicability | Disposition; verification and next review trigger |
|---|---|---|
| xlsx0.18.5; [prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), high | `.>xlsx`; production browser and fixture CLI import arbitrary spreadsheet input; reachable parser | Replace with official versioned0.20.3 in WP-08, beyond affected<0.19.3. Trigger: WP-08 installation, synthetic parser regression checks and new upstream advisory. |
| xlsx0.18.5; [ReDoS](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9), high | `.>xlsx`; same reachable import path | Replace official distribution in WP-08, beyond affected<0.20.2. Trigger: WP-08 checks and each official release review. |
| uuid8.3.2; [buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq), moderate | `.>exceljs>uuid`; production dependency. Browser prebuilt ExcelJS physically contains v3/v5 UUID code. Actual ExcelJS calls only v4() without output buffers for conditional-formatting IDs; app does not add conditional formatting. Advisory affects v3/v5/v6 external-buffer bounds, not v4(). Node tmp/streaming/glob paths are absent from the shipped browser map. | Reviewed residual: no patched8.x in ExcelJS^8.3.0. Forcing UUID11+ violates parent compatibility and would not rewrite ExcelJS's prebuilt browser bundle. Retain without override; source/browser-map/caller inspection and official advisory support applicability. Trigger: next dependency refresh, ExcelJS release/backport, or conditional-formatting/UUID API changes; re-inspect final browser output in WP-09C/10. |
| vitest3.2.7; [mocker redirect](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), moderate | `.>vitest`; development Node/jsdom tests. Public mocker/UI/browser RPC server is not configured; static deployment has no test server. | Fix through mutually compatible Vitest/coverage5.0.3 WP-09B; fixed range4.1.11+. Trigger: WP-09B/final audit or server configuration change. |
| @vitest/mocker3.2.7; [same advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), moderate | `.>vitest>@vitest/mocker`; same development/test context | Upgrade parent in WP-09B rather than incompatible transitive override. Trigger: WP-09B/final audit or public mocker exposure. |

### WP-08 implementation and validation

- Official installation guidance revalidated2026-10-03 still names0.20.3 and authoritative CDN. `8a445a8` pins `xlsx` to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; package name/imports unchanged, version0.20.3, Apache-2.0, Node>=0.8. Lock integrity `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==` matches independently verified official bytes. Normal pnpm URL retrieval succeeds; no vendoring needed. Fresh isolated checkout/store fetch also passes (wp08-clean-install.log); its archive has no .git, so lifecycle messages are not hook evidence. Real checkout hooks were verified WP-03.
- No production source/parser/matching/ranking/event/schema change. Existing synthetic ingestion/API and export/archive matrix passes within677tests/66files; Unicode/German decimals/missing values/empty rows/duration/division/routing/error behavior stay covered. Linux Node24.21.0/pnpm10.34.6 frozen full `ci:local` passes: format/lint/types/coverage74.31%lines/statements/78.29%branches/82.12%functions/build/postlint/CLI, wp08-gates.log. BothOS artifact retrieval/quality evidence is required before Done.
- Full audit3moderate/0high/0critical; production1moderate/0high/0critical (wp08-audit{,-prod}.json). Both SheetJS records absent and0.20.3 exceeds affected ranges; Vitest/mocker WP-09B and reviewed ExcelJS UUID residual remain as above. README documents coordinator-owned manual quarterly/advisory-triggered official source/version/license/integrity/migration review and bothOS checks; no recurring automation. ExcelJS4.4.0 retained. Organizer/desktop acceptance remains WP-12.
- Real [run37132912040](https://github.com/andrekuehne/stundenlauf-ts/actions/runs/37132912040) at exactee7b423: Linux job111231432628 Ubuntu24.04.5 and Windows job111231432524 Server2025/windows-2025-vs2026, runner2.337.0, Node24.21.0/pnpm10.34.6. Both frozen installs downloaded675packages/reused0, including officialxlsx0.20.3; native tools/root hooks and all required677-test gates pass. Coverage Linux74.31/78.28/82.12; Windows74.32/78.31/82.12 (lines/branches/functions), unchanged thresholds. Pages skipped. Raw wp08-remote-{linux,windows}.log; independently fetched and accepted by reviewer.

### WP-09A compiler decisions and evidence

- Revalidated TypeScript5.9.3 then6.0.3; Node>=14.17, selected24.21.0 satisfies engines. typescript-eslint8.71.0 explicitly supports>=4.8.4<6.1 and ESLint8/9/10. Selected manifest `~6.0.3` keeps the supported compiler line; registry7.0.2 held back until lint-tool support extends, reviewed next tooling refresh. Sources: [5.9 migration](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html), [6.0 migration](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html), [lint compiler support](https://typescript-eslint.io/users/dependency-versions/).
- Implementation `b305e28` advances5.9 with three byte-view conversions authored by target_research; private hash conversion now guarantees ArrayBuffer backing while public inputs and exact byteOffset/byteLength are preserved. No casts/config relaxations. Known-digest offset Uint8Array/DataView regression includes sentinel allocation bytes and SharedArrayBuffer: red shared-buffer rejection, green16focused export/archive/integrity tests. `719ec15` separately repairs eight test-only lint findings from more precise DOM/TextEncoder types; all100focused tests retain assertions and nullable array access.
- Actual normal frozen full gates on5.9.3 and6.0.3 both exit0:679tests/66files, coverage74.31%lines/statements/78.31%branches/82.12%functions, unchanged thresholds; format, strict expanded lint, both no-emit type projects, production build, postlint and fixture CLI. Compiler6 defaults/deprecations require no suppression: explicit ES2022/ESNext/bundler/strict/noEmit/relative aliases retained, tooling node types explicit, app ambient modules already covered. Lock updates limited to compiler/peer contexts. Logs wp09a-ts59-gates-fixed.log/wp09a-ts60-gates.log; earlier expanded-lint failure and scoped corrections retained.
- Full/prod advisory results remain3moderate/1moderate, zero high/critical; unchanged residual assignments to09B and reviewed UUID. Final dependency set bothOS evidence is assigned to WP-09D integration before browser release; this compiler package's implementation review does not assert that future remote run.

### WP-09B test-tooling decisions, required finding and repair

- Revalidated Vitest/coverage matching^5.0.3 declarations locked/installed exactly5.0.3, jsdom30.1.1 and jest-dom7.0.1 at `f2eabd2`. Node24.21.0 satisfies Vitest^24 and jsdom>=24.15; existing Vite6.4.3 satisfies runner^6.4/7/8, direct DOM10.4.2 satisfies jest-dom>=10<11. Testing Library React16.3.3 supports React19.3.0. [Vitest migration](https://vitest.dev/guide/migration/), [jsdom releases](https://github.com/jsdom/jsdom/releases), [jest-dom7](https://github.com/testing-library/jest-dom/releases/tag/v7.0.0) rechecked. New default clearMocks preserved; no nested hoisted calls found and async assertions remain awaited. TSX4.23.15 fixture CLI remains independent of runner internals.
- Baseline guard repair is separate `e9046a5`: browser_prep added positive global/actual-season-hook regressions; red on3.2.7 showed season beforeEach removed the guard, minimal owned-mock cleanup fix green21/21. Vitest5 spy overload requires explicit `MockInstance<typeof console.error>`; no unsafe casts or disabled rules. Same21tests pass after migration.
- Independent reviewer required fixing a real coverage loss: new provider warned rawTSX could not parse UpdatePrompt, dropping118→117files despite passing thresholds. `cbb7ff1` repairs only unit resolution through a typed throwing virtual-PWA shim and exact Vitest alias, plus three meaningful actual-component idle/prompt/update-action tests. Production config/SW path stays real and is exercised in10. Added source-scope checker plus10test cases (missing unexecuted module, exclusions, Linux/Windows relative/absolute paths, native CLI success/missing/read failure). `test:coverage` now fails if any expected app source is silently omitted. Sandbox spawn denial was separated from native implementation behavior; native tests assert absence of spawn errors and all10pass. No coverage exclusions added.
- Root normal frozen full gates after repair exit0:695tests/68files, exact118-source LCOV inventory restored with no omissions/additions/parse warnings; source-scope gate verifies118. Statement72.54%, lines73.99%, branches61.47%, functions72.88%; existing50/50/50/45 thresholds and source scope unchanged. Both type projects/full lint/build/postlint/CLI/format pass. Logs wp09b-gates-restored.log and inventory wp09b-coverage-files-restored.json; previous omission preserved as failed review evidence.
- Coverage semantics checked against isolated exact pre-major `e9046a5` (682tests) with unchanged production sources (`git diff --exit-code ... -- src`). Its actual3.2.7 provider selects legacy v8ToIstanbul unless experimentalAstAwareRemapping is enabled; our prior config did not enable it. New5 provider uses AST directly. Actual counters before→after: lines11634/15655→3719/5026, functions579/705→895/1228, branches2318/2960→2260/3676. These ratios are not directly comparable across instrumentation/runtime/test changes. Full file inventory, meaningful added tests and unchanged thresholds verify scope; no percentage was repaired by lowering a gate. wp09b-coverage-counter-comparison.json and installed provider sources inspected independently. General current documentation's 'since3.2' description does not replace this package-specific evidence.
- Full/prod audits each1moderate, zero high/critical: only reviewed ExcelJS UUID remains; both Vitest/mocker findings removed. wp09b-audit{,-prod}.json. Final dependency set bothOS proof remains09D; browser PWA lifecycle checks remain10.

### WP-09C build-tooling decisions and evidence

- Fresh official registry/tag/artifact reads select Vite8.3.2, matching React plugin6.1.1 and PWA2.0.0 with existing Workbox build/window7.4.1. PWA2 was published2026-10-03 at14:13UTC after the original target research: official release/source comparison changes engine/assets-generator support and metadata, with no runtime plugin source changes; tarball integrity verified. Node24.21.0 meets Vite/React^20.19 or>=22.12, PWA>=20.19 and Workbox>=20. Strict engine/peer installation succeeds; optional Babel/compiler/assets-generator peers are unused. [Vite7 migration](https://v7.vite.dev/guide/migration), [Vite8 migration](https://vite.dev/guide/migration), [React plugin changelog](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md), [PWA2 release](https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v2.0.0) inspected before updating.
- Separate coherent migration835a522 changes only dependency manifest/lock, canonical `rolldownOptions` API and its explicit-entry regression. build_migration owns the one test edit: deterministic red under Vite6.4.3, green all16build tests after migration, both strict type projects/focused lint/format pass. Root preserves plain React plugin, source aliases, explicit index entry, sourcemaps, Pages base and prompt/clientsClaim:false/skipWaiting:false. No application algorithm/data behavior or check relaxation.
- Keep Vite8 default syntax targets Chrome/Edge111, Firefox114, Safari16.4 rather than invent a legacy support promise. These are build targets, not proof of runtime support. Actual browser validation uses matched bundled Chromium; other browsers remain unverified. Rolldown/Oxc native optional packages require final Linux/Windows install/build evidence in09D; approved esbuild setup remains needed by direct TSX fixture runner, and Workbox retains its own Rollup path.
- Root normal frozen `ci:local` exit0 on Ubuntu26.04 x64/Node24.21.0/pnpm10.34.6:695tests/68files, all118source files covered, statements72.65%, lines74.13%, branches61.47%, functions72.88%; unchanged thresholds. Format, full strict lint, both no-emit projects, production build, post-build lint and empty-fixture CLI pass. Build generates34precache entries/2768.36KiB with no precache error; ordinary large-chunk warning retained. Manifest scope/start_url `/stundenlauf-ts/`,25JavaScript precache entries and separate lazy ExcelJS/jsPDF/JSZip/SheetJS chunks inspected. Evidence wp09c-ci-local.log/wp09c-output-inspection.json.
- Full/prod audits each1moderate, zero high/critical. Final Rolldown ExcelJS chunk maps to the same prebuilt browser distribution: embedded UUIDv3/v4/v5, actual conditional-formatting caller uses only v4() without buffers, app has no conditional-formatting use. Reviewed UUID disposition remains unchanged; no incompatible override. Evidence wp09c-audit{,-prod}.json and output inspection. Production interoperability and final remote OS evidence remain pending until recorded below.
- build_migration's isolated exact835a522 archive plus the six WP-10 preparation files (temporary config only outside repository) passes both real production tests in12.4s: actual browser SheetJS imports/manual review, ExcelJS workbook values, jsPDF content/structure, JSZip event/hash round trip, IndexedDB reload, Pages-subpath SW activation/offline startup and actual changed second-build update prompt with retained complete events. Selected Playwright1.63.0/matching Chromium1243 (Chrome153.0.8010.12), Ubuntu26.04/Node24.21.0, no host override/system executable; canonical Vite8/PWA2 builds both outputs without changing root sources/dist. Evidence wp09c-production-interop.log/wp09c-interop-candidate.json. This closes local bundler interoperability; it is preparation proof for WP-10, whose root integration/strict checks/remote browser jobs still await WP-09 acceptance.

### WP-09D lint-tooling decisions and verification

- Immediately rechecked official registry latest stable ESLint10.12.0, @eslint/js10.0.1 and globals17.13.0; existing typescript-eslint8.71.0 supports ESLint^10 and TypeScript>=4.8.4<6.1, jiti2.7.0 exceeds loader minimum2.2 and eslint-config-prettier10.1.8 supports ESLint>=7. Node24.21.0 meets all engines. Normal strict engine/peer installation succeeds. [ESLint10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0) and [TypeScript config loading](https://eslint.org/docs/latest/use/configure/configuration-files#typescript-configuration-files) checked; root authoritative TS flat config, jiti loader and strict scopes require no migration flags or weakened rules.
- Actual installed10 full lint red has exactly3 no-useless-assignment errors and zero warnings, matching scoped diagnostics. Newly recommended no-unassigned-vars/no-useless-assignment/preserve-caught-error remain active. Bounded build_migration ownership is only src/api/ts/index.ts and src/stores/season.ts; fixes preserve final event sequence values and every loop increment. Earlier read-only ESLint9 preflight is research, not installed10 acceptance. Evidence wp09d-final-registry-recheck.json/wp09d-install.log/wp09d-lint-before.log/wp09d-owned-lint-red.log; final checks follow.
- Coherent implementationbfc34fd: selected lint family plus exactly3terminal counter-write removals, no root config change. Root normal frozen full `ci:local` passes on Ubuntu26.04/Node24.21.0/pnpm10.34.6:695tests/68files, all118source files verified, full format/lint/both no-emit projects/production build/post-build lint/empty-fixture CLI. Refreshed full/prod audits each1moderateUUIDonly, zero high/critical. Evidence wp09d-ci-local.log/wp09d-audit{,-prod}.json. Independent source/sequence review and final dependency-set realbothOS evidence remain pending; no WP-09 package is yet marked Done.
- build_migration's existing52tests/5suites and actual public temporary3-case probe pass: atomic seq5, grouped2races+batch seq5/6/7, store same with retained complete0..7log and unrelated race active. Existing tests do not separately establish atomic API/store rollback sequence coverage; the bounded probe and argument-preserving diff provide that evidence without adding implementation-mirroring permanent tests. Independent reviewer reran31API/store/history tests, the actual probe and full lint; calculated config confirms all3new recommended rules severity2 across app/tests/scripts/root configs, with unchanged strict typed scopes/test allowances and working jiti loader. No local required findings.
- Final dependency-set actual [CI run37137700317](https://github.com/andrekuehne/stundenlauf-ts/actions/runs/37137700317), exacthead740ae4a563d768576010d287c32a27b7d0e64abb: Linux job111245488912 and Windows111245489178 both success; feature-branch Pages deployment correctly skipped. Fresh normal frozen installs download624packages with zero reuse on bothOS, approved esbuild0.28.2 native setup/root hooks succeed, actual Rolldown/Oxc production build and Workbox34-entry SW succeed. Ubuntu24.04.5 image20260927.320.1 and Windows Server2025 imagewindows-2025-vs2026/20260925.250.1, runner2.337.0, Node24.21.0/pnpm10.34.6. All format/lint/types/coverage/build/postlint/emptyCLI/gitdiff gates pass; each695tests/68files and118source gate, statements72.65/lines74.13/branches61.47/functions72.88%, unchanged thresholds. Logs wp09d-{linux,windows}-ci.log and jobs metadata inspected by root; final independent remote review remains required before WP-09A–D/09 Done and10 release.

### WP-10 production browser integration and evidence

- Scoped browser_prep preparation supplied only six e2e spec/helper files; root integrated them unchanged at0daf081 after65cf9f9 recorded accepted WP-09 dependency/realbothOS gates. build_migration independently validates their actual ESLint10 strict typing/lint/format and portability; root owns all manifest/config/workflow integration. `pnpm run test:smoke` selects dedicated `playwright.smoke.config.ts`; `ci:local`/real pre-push append it after frozen format/lint/types/coverage/build/postlint/CLI. Install browser first: Linux `pnpm exec playwright install --with-deps chromium`, Windows `pnpm exec playwright install chromium`. Matching Playwright1.63.0 bundled Chromium is default on bothOS; no system Chrome/host override. Optional README config selects only its old screenshot spec, with explicit optional system-Chrome environment selection; no private fixtures are needed by smoke.
- Two actual canonical production builds go to OS-temp directories, with only version text changed and distinct generated SWs required; loopback server serves `/stundenlauf-ts/` and switches outputs without stubbing PWA registration or changing source. Smoke asserts season creation; two in-memory Unicode/German-decimal XLSX imports; actual below-perfect manual review selection; exact standings; IndexedDB reload; ExcelJS-parsed values; PDF structure/content; ZIP manifest/SHA256/event array round trip into an empty selected target. Real worker readiness/controller handling, service-worker offline response, changed-build waiting worker/prompt/action and retained complete season events are asserted before/after update. Matching/ranking/storage algorithms remain unchanged.
- Root normal frozen full gates exit0 on Ubuntu26.04/Node24.21.0/pnpm10.34.6, matched Chromium1243/Chrome153.0.8010.12:695unit/integration tests/68files and118source coverage gate plus2production browser tests (12.4s) pass; strict e2e/config type/lint/format coverage included. No organizer XLSX available; CLI confirms empty fixtures. List-only checks prove smoke selects exactly2production tests and optional README config exactly1screenshot test. Evidence wp10-ci-local.log/wp10-{smoke,readme}-list.log/wp10-owned-{lint,typecheck,format}.log. Tracked changes are only intended integration; optional README assets untouched.
- BothOS CI now installs the selected bundled Chromium (Linux system libraries included), runs dedicated smoke and retains OS-specific traces/screenshots/report on failure via full-SHA upload-artifact7.0.1 (fresh official release/tag/action Node24 metadata rechecked). `trace: retain-on-failure` / `screenshot: only-on-failure` and7-day retention configured; no actual failure upload is claimed without a failure. Actual root-integrated remote browser results and independent implementation/DoD review remain pending. Browser acceptance covers bundled Chromium only, not Firefox/Safari/Edge/native Excel/LibreOffice or unavailable historical organizer seasons.
- Scoped follow-up logs `browser.version()` once per actual smoke worker; strict lint/types/format rechecked. Linux signal cleanup was verified in09C. Playwright's gracefulShutdown is ignored on Windows, where runner-owned process termination does not prove the helper's signal-based temporary-directory cleanup; no Windows temporary-cleanup claim is made. CI runners are disposable, and outputs are outside tracked files. Browser/config/assertion behavior remains unchanged.
- Independent combined_reviewer reran real production smoke successfully (2tests/13.2s, actual Chromium153.0.8010.12), strict e2e/config lint/format and both no-emit projects. A reviewer list-command mistake forwarded a literal separator and accidentally ran the optional README flow; absent organizer fixtures caused its expected failure after three generated PNG writes. Reviewer restored only those previously clean images from exactd9ce3ff; root verified clean tracked state. Correct list-only commands independently confirm smoke2tests/1spec and optionalREADME1test/1spec. This incident is not an optional-fixture acceptance claim or a production smoke regression.
- Actual [browser CI run37138602220](https://github.com/andrekuehne/stundenlauf-ts/actions/runs/37138602220), exactd9ce3ff6b1b10f43c4d5454ba1f85fa676fb16a5: Linux111248164007 and Windows111248164158 both success with all frozen quality/build/postlint/CLI/gitdiff gates,695tests/68files/118-source scope plus2production smoke tests (Linux20.2s, Windows19.1s). Both install matching Chromium1243 and actual launched version log153.0.8010.12; Linux installs system libraries via--with-deps, Windows uses bundled win64 Chrome without system channel/default. Same Node24.21.0/pnpm10.34.6/runner2.337.0 and OS images as09D. Linux coverage statements72.67/lines74.15/branches61.50/functions72.88%, Windows72.65/74.13/61.47/72.88%; unchanged thresholds/source scope, small render/instrumentation variation recorded. Real production imports/exports/archive/offline/update pass, feature Pages deploy skips. Logs wp10-{linux,windows}-ci.log; final independent actual remote/doc review remains before10 Done and11 release.

### Review acceptance log

- WP-09D: independent_reviewer accepted `055a99e41e3f6f526996d91fdd06e2d9f449a3f3`, implementationbfc34fd and realbothOS source740ae4a. No required findings. Independently31API/store/history tests/full lint/new-rule config/public3-case sequence probe; independently fetched run37137700317 job metadata and both decoded logs confirming fresh frozen624-package installs/native setup/selected toolchain/allgates695tests/68files/118-source coverage/build/postlint/CLI/gitdiff and correct Pages skip. This accepts finalbothOS supplements for09A/09B/09C. Root records each09A–D and09 Done before releasing10; browserintegration/CI10 and organizer/desktop12 remain separate.

- WP-09C: independent_reviewer accepted `42586fffc5280bf3e45adab660399a3dfa3caf9e`, actual migration835a522. No required findings. Independently16build tests/both type projects/118-source gate; actual lock/native policy/engine/peers/migration guidance/PWA2 stable source comparison inspected. Independently compared exact candidate hashes, inspected all real smoke assertions and reran2production Chromium tests (12.4s) with actual imports/exports/archive/offline/update/events preserved; clean root and teardown verified. Full frozen695-test gates/unchanged thresholds/UUID-only audits accepted. Root records acceptance before09D release; final bothOS dependency-set proof assigned09D and root browser integration/remote smoke10.

- WP-09B: independent_reviewer accepted `954a1398ec88ecc745bfb102731d28f8e12bfe6e`, migrationf2eabd2/baselineguarde9046a5/requiredfixcbb7ff1. Required UpdatePrompt omission resolved and re-reviewed; independent34prompt/guard/scope tests plus75migration-relevant tests and both type projects pass. Independently verified118→118 inventory/no parse warning, actual provider transition/counters, successful frozen695-test gates, unchanged thresholds/strict rules and only reviewed UUID residual. Manifest ranges are matching carets; frozen lock/installed runner+coverage exactly5.0.3. Acceptance recorded before releasing09C; final bothOS proof remains09D.

- WP-09A: independent_reviewer accepted `0b08413b62d07be8a3212b95a481335b3d2b946e`, compiler5f977c7/sourceb305e28/test repair719ec15. No required findings. Independently both no-emit projects/full lint/116tests on installed6.0.3; reviewed both compiler full frozen679-test gates, strict config preservation, migration/engine/peer/holdback decisions and refreshed3full/1prod moderate audits. Root recorded acceptance before WP-09B release; final bothOS dependency set verification remains09D.

- WP-08: independent_reviewer accepted `ee7b423497aaf9a2c1205d418061e9824062f68c`, implementation8a445a8, no findings. Independently155import/export/archive tests and synthetic semantics/source/integrity/manual-procedure inspection; successful677-test full frozen gates. Supplemental independent fetch of real run37132912040 and bothOS logs proves fresh CDN artifact retrieval/native setup/allquality gates. Root recorded full acceptance before releasing WP-09A. No organizer/desktop evidence claimed.

- WP-07: independent_reviewer accepted `597cc8f6ca2c9267313dd28b2947fae0a6ee0bbe`, implementation through16ff2ae, no findings. Independently216focused tests, installed engines/peers, lock scope, removal inspection, two-file pure formatter comparison and UUID advisory/source/map inspection; successful full frozen677-test gates and clean tracked state reviewed. Root recorded acceptance before releasing WP-08; remaining findings assigned concrete subsequent packages.

- WP-06 supplemental: independent_reviewer accepted `63f8f3097c99b2937eefc238d0599c536f22321d` after requiring and re-reviewing the classic-protection/ruleset distinction. Independently verified alerts/security enabled and dependency graph SBOM401packages. Actual new configuration update job/representative PR remain pending; no default-branch merge performed.

- WP-05: independent_reviewer accepted exact `9c2fda43fc798fd770e0a24cf42a14f3fdfa3eb8` for workflow sources and independently fetched realbothOS success evidence. No findings. API-inaccessible required settings are explicitly recorded, as allowed in DoD; final dependency/browser checks remain scheduled.

- WP-04: independent_reviewer accepted `6f4337897ba87548e39df4186ee90b7d5106a20a`; independently verified all104files equal Prettier3.8.2 applied to prior revision, no behavior/dependency/docs changes; reproduced format/lint/both typechecks. No findings. Acceptance recorded before releasing WP-05.

- WP-03: independent_reviewer accepted `44c7438`; inspected actual pins/lock/policy/hook/line endings; reproduced10.34.6/types24.19.1/both strict type checks; clean frozen lock hashes verified. No findings. Status remains Reviewed / Pending External Verification until the explicitly assigned WP-05 Windows native install/OS checks. The local accepted result releases formatting/CI preparation, whose remote checks supply that delayed evidence.

- WP-02: independent_reviewer accepted `f116db4`; reran16 tooling/export/archive tests, expanded lint, both type projects and CLI; inspected677coverage/two-build/no-recreated-artifact evidence and exact lock scope. No findings. Clean-copy hook messages do not prove actual hook setup; actual root Git hook verification assigned WP-03. Root recorded acceptance before WP-03 dependency changes.

- WP-06 preparation: independent_reviewer accepted `bd7bc4fa6dd96264aebf1410cb6459e635f8a7e0`; independently parsed YAML/inspected grouping and current options; no findings. Full package remains Reviewed / Pending External Verification for settings, real job, representative PR and WP-08 procedure.
- WP-01: independent_reviewer accepted `400aa9313cfb4ce5ae3c4a5ace56f4ee88fc23d4`; independently reran130 ingestion/API tests, inspected deterministic red and674-test coverage pass; no actionable findings. Windows assigned to WP-05 per WP-01 DoD. Acceptance recorded before WP-03 release.

- WP-00: independent_reviewer accepted exact revision `091e08cfcd59de300fd9f801ed9aa23efcaa2397`; baseline install/check logs and current engine/peer guidance inspected, typecheck/lint/CLI independently reproduced, tarball integrity verified. Required finding on advisory path-context conflation fixed in 091e08c; re-review checked all78 exact labels against production audit. No actionable findings remain. Root recorded acceptance before releasing WP-01/WP-02. External Windows/settings/Dependabot/organizer gates remain assigned, not verified.

### Implementation baseline (WP-00)

- Branch: `codex/dependency-and-platform-refresh`, created from freshly fetched `origin/main` at `993f6b80a722b8a770bed364ebdb8a66eaf126e9`. Initial tree: only untracked `docs/workplans/2026-10-dependency-and-platform-refresh.md` (user-provided plan). Its requirements are preserved; only execution evidence/status is extended.
- Environment: Linux x86_64, Ubuntu kernel `7.0.0-34-generic`; Node `24.21.0`; pnpm `10.33.0` via Corepack using temporary cache. pnpm was initially absent from PATH. Chromium/headless Chromium build 1243 and system Chrome are available; final browser version will be installed from selected Playwright.
- Normal `pnpm install --frozen-lockfile` passed with lifecycle scripts enabled and unchanged lockfile. esbuild's permitted install script ran; root `prepare` installed the pre-push hook. pnpm warned about the ignored dependency-level simple-git-hooks script; explicit policy is reviewed in WP-03. Validation commands use the repository packageManager pin through Corepack.
- Baseline Linux checks: typecheck and pre-build lint pass; coverage run: **637 pass / 35 fail, 64 files**, matching malformed synthetic workbook bytes. `format:check`: **99 files** fail. Fixture CLI: fails because `vite-node` is undeclared. Production build passes, then lint fails with **191 errors**. Build rewrites `eslint.config.js`, removing four test exemptions; only this self-generated change was restored before implementation. No upgrade regression is inferred from these existing failures.
- Baseline raw logs/audits/registry metadata are retained during this session under `/tmp/stundenlauf-refresh-evidence`; durable outcomes and advisory identities are in this record.
- Current upstream strategy: Node24 LTS `24.21.0`; pnpm10 `10.34.6` (Dependabot-supported line); Node24 types `24.19.1`; TypeScript `5.9.3` then `6.0.3`, Vitest/coverage `5.0.3`, Vite `8.3.2`, React plugin `6.1.1`, PWA `1.3.0`, Workbox `7.4.1`, ESLint `10.12.0`, typescript-eslint `8.71.0`. Exact engine/peer matrix follows. Recheck selected families immediately before mutation.
- Access: local `gh` tokens are invalid (including stored login); GitHub MCP authenticates as `andrekuehne`. Connector repository metadata reports push/admin, but branch-protection API returns **403 Resource not accessible by integration** and vulnerability-alert endpoint is outside connector allowlist. Owner: repository administrator; action: verify required checks and graph/alert/security-update settings in GitHub settings (WP-05/06). Attempt available signed-in browser/settings routes during activation; do not claim activation from configuration alone.
- External actions: root will push/open PR and inspect both OS runs after workflow integration. Repository administrator verifies settings and a real Dependabot update/representative PR after default-branch configuration becomes active. User supplies organizer files and reference expectations plus Excel/LibreOffice access for WP-12. WP-12 remains **Awaiting Fixtures** and does not block synthetic validation.

### WP-00 baseline advisory inventory

Fresh registry audits on 2026-10-03: full 78 records (1 critical, 45 high, 26 moderate, 6 low); production 36 records (18 high, 13 moderate, 5 low). Each distinct advisory/path below is a baseline finding, not a reachability verdict. WP-07 will record final dispositions. Owner: root dependency coordinator.

| Package/version | Advisory | Baseline path | Context / assigned remediation |
|---|---|---|---|
| xlsx 0.18.5 | [1108110: high](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) | `.>xlsx (production)` | exact path contexts labelled at left; WP-08 maintained SheetJS |
| xlsx 0.18.5 | [1108111: high](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) | `.>xlsx (production)` | exact path contexts labelled at left; WP-08 maintained SheetJS |
| serialize-javascript 6.0.2 | [1113686: high](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) | `.>vite-plugin-pwa>workbox-build>@rollup/plugin-terser>serialize-javascript (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| postcss 8.5.9 | [1117015: moderate](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | `.>vite>postcss (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| ws 8.20.0 | [1119108: moderate](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) | `.>jsdom>ws (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| serialize-javascript 6.0.2 | [1119440: moderate](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) | `.>vite-plugin-pwa>workbox-build>@rollup/plugin-terser>serialize-javascript (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| uuid 8.3.2 | [1119441: moderate](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | `.>exceljs>uuid (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| react-router 7.14.1 | [1120063: high](https://github.com/advisories/GHSA-49rj-9fvp-4h2h) | `.>react-router-dom>react-router (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| react-router 7.14.1 | [1120069: high](https://github.com/advisories/GHSA-8x6r-g9mw-2r78) | `.>react-router-dom>react-router (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| @babel/plugin-transform-modules-systemjs 7.29.0 | [1120258: high](https://github.com/advisories/GHSA-fv7c-fp4j-7gwp) | `.>vite-plugin-pwa>workbox-build>@babel/preset-env>@babel/plugin-transform-modules-systemjs (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 5.0.5 | [1120311: moderate](https://github.com/advisories/GHSA-jxxr-4gwj-5jf2) | `.>@vitest/coverage-v8>test-exclude>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| tmp 0.2.5 | [1120654: high](https://github.com/advisories/GHSA-ph9p-34f9-6g65) | `.>exceljs>tmp (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| vite 6.4.2 | [1120784: moderate](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) | `.>vite (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1120802: moderate](https://github.com/advisories/GHSA-hpcv-96wg-7vj8) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1120803: moderate](https://github.com/advisories/GHSA-r47g-fvhr-h676) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| react-router 7.14.1 | [1120807: low](https://github.com/advisories/GHSA-84g9-w2xq-vcv6) | `.>react-router-dom>react-router (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1120813: moderate](https://github.com/advisories/GHSA-rp9w-3fw7-7cwq) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| js-yaml 4.1.1 | [1121860: moderate](https://github.com/advisories/GHSA-h67p-54hq-rp68) | `.>eslint>@eslint/eslintrc>js-yaml (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| ws 8.20.0 | [1123259: high](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | `.>jsdom>ws (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| vite 6.4.2 | [1123525: high](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) | `.>vite (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| @babel/core 7.29.0 | [1123528: low](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | `.>@vitejs/plugin-react>@babel/core (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 2.1.0 | [1123896: high](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | `.>@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 1.1.14 | [1123897: high](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | `.>eslint>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 5.0.5 | [1123898: high](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | `.>@vitest/coverage-v8>test-exclude>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| js-yaml 4.1.1 | [1123911: high](https://github.com/advisories/GHSA-52cp-r559-cp3m) | `.>eslint>@eslint/eslintrc>js-yaml (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fast-uri 3.1.0 | [1124064: high](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1124233: moderate](https://github.com/advisories/GHSA-cmwh-pvxp-8882) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1124234: low](https://github.com/advisories/GHSA-vxr8-fq34-vvx9) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1124235: low](https://github.com/advisories/GHSA-gvmj-g25r-r7wr) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1124236: low](https://github.com/advisories/GHSA-x4vx-rjvf-j5p4) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1124237: moderate](https://github.com/advisories/GHSA-76mc-f452-cxcm) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| postcss 8.5.9 | [1124252: high](https://github.com/advisories/GHSA-6g55-p6wh-862q) | `.>vite>postcss (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| react-router 7.14.1 | [1124268: moderate](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) | `.>react-router-dom>react-router (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| react-router 7.14.1 | [1124271: moderate](https://github.com/advisories/GHSA-h8fp-f39c-q6mh) | `.>react-router-dom>react-router (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| react-router 7.14.1 | [1124272: moderate](https://github.com/advisories/GHSA-337j-9hxr-rhxg) | `.>react-router-dom>react-router (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| react-router 7.14.1 | [1124276: high](https://github.com/advisories/GHSA-chx6-hx7r-mcp5) | `.>react-router-dom>react-router (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 1.1.14 | [1130588: high](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | `.>eslint>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 2.1.0 | [1130589: high](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | `.>@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 5.0.5 | [1130591: high](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | `.>@vitest/coverage-v8>test-exclude>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| postcss 8.5.9 | [1130709: moderate](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | `.>vite>postcss (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fast-uri 3.1.0 | [1130720: high](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 5.0.5 | [1130734: high](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | `.>@vitest/coverage-v8>test-exclude>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 2.1.0 | [1130736: high](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | `.>@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 1.1.14 | [1130737: high](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | `.>eslint>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| js-yaml 4.1.1 | [1138115: high](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | `.>eslint>@eslint/eslintrc>js-yaml (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| pdfjs-dist 5.6.205 | [1138116: high](https://github.com/advisories/GHSA-hq66-cqwq-w95j) | `.>pdfjs-dist (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1138538: moderate](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| react-router 7.14.1 | [1138769: high](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) | `.>react-router-dom>react-router (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| nanoid 3.3.11 | [1138811: high](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | `.>vite>postcss>nanoid (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| nanoid 3.3.11 | [1139427: high](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | `.>vite>postcss>nanoid (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| postcss 8.5.9 | [1139510: high](https://github.com/advisories/GHSA-r28c-9q8g-f849) | `.>vite>postcss (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| vitest 3.2.4 | [1139528: critical](https://github.com/advisories/GHSA-5xrq-8626-4rwp) | `.>vitest (development/build)` | exact path contexts labelled at left; WP-09B test tooling |
| fast-uri 3.1.0 | [1145559: high](https://github.com/advisories/GHSA-q3j6-qgpj-74h6) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fast-uri 3.1.0 | [1153168: high](https://github.com/advisories/GHSA-v39h-62p7-jpjc) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| browserslist 4.28.2 | [1153171: high](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | `.>@vitejs/plugin-react>@babel/core>@babel/helper-compilation-targets>browserslist (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| browserslist 4.28.2 | [1153172: high](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | `.>@vitejs/plugin-react>@babel/core>@babel/helper-compilation-targets>browserslist (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| nanoid 3.3.11 | [1153189: high](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | `.>vite>postcss>nanoid (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| @humanfs/node 0.16.7 | [1158499: moderate](https://github.com/advisories/GHSA-p498-v437-472g) | `.>eslint>@humanfs/node (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fast-uri 3.1.0 | [1158524: high](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fast-uri 3.1.0 | [1158530: high](https://github.com/advisories/GHSA-jqff-g426-hqxp) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fflate 0.8.2 | [1164782: moderate](https://github.com/advisories/GHSA-px8p-9vwx-vf98) | `.>jspdf>fflate (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| vitest 3.2.4 | [1193683: moderate](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | `.>vitest (development/build)` | exact path contexts labelled at left; WP-09B test tooling |
| @vitest/mocker 3.2.4 | [1193684: moderate](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | `.>vitest>@vitest/mocker (development/build)` | exact path contexts labelled at left; WP-09B test tooling |
| baseline-browser-mapping 2.10.19 | [1193686: moderate](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | `.>@vitejs/plugin-react>@babel/core>@babel/helper-compilation-targets>browserslist>baseline-browser-mapping (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| js-yaml 4.1.1 | [1193727: high](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | `.>eslint>@eslint/eslintrc>js-yaml (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fast-uri 3.1.0 | [1204921: high](https://github.com/advisories/GHSA-4c8g-83qw-93j6) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fast-uri 3.1.0 | [1239943: high](https://github.com/advisories/GHSA-qw65-cvwx-89v3) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| fast-uri 3.1.0 | [1240091: moderate](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | `.>vite-plugin-pwa>workbox-build>ajv>fast-uri (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 1.1.14 | [1240100: moderate](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `.>eslint>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 2.1.0 | [1240101: moderate](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `.>@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 5.0.5 | [1240103: moderate](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `.>@vitest/coverage-v8>test-exclude>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 1.1.14 | [1240104: high](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `.>eslint>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 2.1.0 | [1240105: high](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `.>@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 5.0.5 | [1240107: high](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `.>@vitest/coverage-v8>test-exclude>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 1.1.14 | [1240108: high](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `.>eslint>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 2.1.0 | [1240109: high](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `.>@vitest/coverage-v8>test-exclude>glob>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| brace-expansion 5.0.5 | [1240111: high](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `.>@vitest/coverage-v8>test-exclude>minimatch>brace-expansion (development/build)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |
| dompurify 3.4.0 | [1240978: low](https://github.com/advisories/GHSA-c2j3-45gr-mqc4) | `.>jspdf>dompurify (production)` | exact path contexts labelled at left; WP-07 compatible refresh; residual review |

# WP-00 current target research

Research owner: `/root/target_research`; integration/dependency coordinator: `/root`.
Date: 2026-10-03. Read complete workplan and `.cursor/rules/{tdd-workflow,typescript-testing-standards}.mdc`. No repository files or dependency files changed.

Environment: Linux; locally available Node `24.21.0`; unqualified `pnpm` absent on initial agent PATH. Registry network DNS blocked inside sandbox; read-only registry requests succeeded using approved `require_escalated` execution. Parent established pinned pnpm10.33.0 separately. Registry raw metadata saved in `registry-targets.json`. These are proposed targets, not installed/tested compatibility results.

## Platform decision

Pin Node24.21.0 (latest LTS per official Node release page); use Node engine `^24.15.0` or a stricter chosen24.x floor that includes24.21.0 and excludes25.x. The strongest selected24.x engine floor is jsdom30.1.1: `^22.22.2 || ^24.15.0 || >=26.0.0`. Node26 is Current and outside chosen LTS strategy; Node25 EOL. Pin pnpm10.34.6: registry latest is12.8.1, but GitHub documents pnpm7–10 support, making pnpm11/12 a specific Dependabot compatibility holdback. Exact pins still require normal frozen Linux/Windows install evidence.

## Exact proposed target matrix

| Package | Selected | Node engine | Important peers | Package / decision | Registry evidence |
|---|---|---|---|---|---|
| `pnpm` | `10.34.6` | `>=18.12` | none declared | WP-03: Keep 10.x; Dependabot official support stops at pnpm10. | [metadata](https://registry.npmjs.org/pnpm) |
| `@types/node` | `24.19.1` | `not declared` | none declared | WP-03: Align types to selected Node24 runtime. | [metadata](https://registry.npmjs.org/@types%2fnode) |
| `exceljs` | `4.4.0` | `>=8.3.0` | none declared | WP-07/08: Latest official stable; preserve export implementation and review Node-only transitives. | [metadata](https://registry.npmjs.org/exceljs) |
| `idb` | `8.0.3` | `not declared` | none declared | WP-07: Current stable unchanged. | [metadata](https://registry.npmjs.org/idb) |
| `jspdf` | `4.2.1` | `not declared` | none declared | WP-07: Current stable unchanged. | [metadata](https://registry.npmjs.org/jspdf) |
| `jspdf-autotable` | `5.0.8` | `not declared` | jspdf ^2 || ^3 || ^4 | WP-07: Compatible patch; jspdf2/3/4 peer. | [metadata](https://registry.npmjs.org/jspdf-autotable) |
| `jszip` | `3.10.2` | `not declared` | none declared | WP-07: Compatible patch. | [metadata](https://registry.npmjs.org/jszip) |
| `react` | `19.3.0` | `>=0.10.0` | none declared | WP-07: Refresh React family together. | [metadata](https://registry.npmjs.org/react) |
| `react-dom` | `19.3.0` | `not declared` | react ^19.3.0 | WP-07: Requires react^19.3.0. | [metadata](https://registry.npmjs.org/react-dom) |
| `react-router-dom` | `7.18.4` | `>=20.0.0` | react >=18; react-dom >=18 | WP-07: Compatible minor/patch; Node>=20. | [metadata](https://registry.npmjs.org/react-router-dom) |
| `workbox-window` | `7.4.1` | `not declared` | none declared | WP-07/09C: Refresh Workbox together. | [metadata](https://registry.npmjs.org/workbox-window) |
| `zustand` | `5.0.15` | `>=12.20.0` | immer >=9.0.6 (optional); react >=18.0.0 (optional); @types/react >=18.0.0 (optional); use-sync-external-store >=1.2.0 (optional) | WP-07: Compatible patch; optional peers noted in JSON. | [metadata](https://registry.npmjs.org/zustand) |
| `@eslint/js` | `10.0.1` | `^20.19.0 || ^22.13.0 || >=24` | eslint ^10.0.0 (optional) | WP-09D: Migrate with ESLint10. | [metadata](https://registry.npmjs.org/@eslint%2fjs) |
| `@playwright/test` | `1.63.0` | `>=20` | none declared | WP-07/10: Compatible minor; bundled Chromium from exact Playwright release. | [metadata](https://registry.npmjs.org/@playwright%2ftest) |
| `@testing-library/jest-dom` | `7.0.1` | `>=22` | vitest >= 0.32 (optional); @testing-library/dom >=10 <11 | WP-09B: Node>=22; explicit DOM peer^10 needed. | [metadata](https://registry.npmjs.org/@testing-library%2fjest-dom) |
| `@testing-library/react` | `16.3.3` | `>=18` | react ^18.0.0 || ^19.0.0; react-dom ^18.0.0 || ^19.0.0; @types/react ^18.0.0 || ^19.0.0 (optional); @types/react-dom ^18.0.0 || ^19.0.0 (optional); @testing-library/dom ^10.0.0 | WP-07/09B: Compatible minor; explicit @testing-library/dom^10 peer. | [metadata](https://registry.npmjs.org/@testing-library%2freact) |
| `@types/react` | `19.3.0` | `not declared` | none declared | WP-07: React19 types together. | [metadata](https://registry.npmjs.org/@types%2freact) |
| `@types/react-dom` | `19.3.0` | `not declared` | @types/react ^19.3.0 | WP-07: Requires @types/react^19.3.0. | [metadata](https://registry.npmjs.org/@types%2freact-dom) |
| `@vitejs/plugin-react` | `6.1.1` | `^20.19.0 || >=22.12.0` | vite ^8.0.0; oxc-transform-react ^0.145.0 (optional); @rolldown/plugin-babel ^0.1.7 || ^0.2.0 (optional); babel-plugin-react-compiler ^1.0.0 (optional) | WP-09C: Requires Vite8; compiler/Babel/Oxc peers optional. | [metadata](https://registry.npmjs.org/@vitejs%2fplugin-react) |
| `@vitest/coverage-v8` | `5.0.3` | `not declared` | vitest 5.0.3; @vitest/browser 5.0.3 (optional) | WP-09B: Exactly match Vitest5.0.3; browser peer optional. | [metadata](https://registry.npmjs.org/@vitest%2fcoverage-v8) |
| `eslint` | `10.12.0` | `^20.19.0 || ^22.13.0 || >=24` | jiti * (optional) | WP-09D: Current ESLint10; jiti>=2.2 for TS config. | [metadata](https://registry.npmjs.org/eslint) |
| `eslint-config-prettier` | `10.1.8` | `not declared` | eslint >=7.0.0 | WP-07/09D: eslint>=7 compatible. | [metadata](https://registry.npmjs.org/eslint-config-prettier) |
| `globals` | `17.13.0` | `>=18` | none declared | WP-09D: Major migration with lint family. | [metadata](https://registry.npmjs.org/globals) |
| `jiti` | `2.7.0` | `not declared` | none declared | WP-07/09D: TS ESLint config loader; >=2.2 satisfied. | [metadata](https://registry.npmjs.org/jiti) |
| `jsdom` | `30.1.1` | `^22.22.2 || ^24.15.0 || >=26.0.0` | canvas ^3.2.3 (optional) | WP-09B: Raises selected Node24 floor to24.15.0; optional canvas unnecessary. | [metadata](https://registry.npmjs.org/jsdom) |
| `prettier` | `3.9.9` | `>=14` | none declared | WP-07: Compatible minor/patch. | [metadata](https://registry.npmjs.org/prettier) |
| `simple-git-hooks` | `2.14.0` | `not declared` | none declared | WP-07: Compatible minor; root prepare retains hooks. | [metadata](https://registry.npmjs.org/simple-git-hooks) |
| `typescript` | `6.0.3` | `>=14.17` | none declared | WP-09A: First5.9.3 then6.0.3; defer7 because lint peer<6.1. | [metadata](https://registry.npmjs.org/typescript) |
| `typescript-eslint` | `8.71.0` | `^18.18.0 || ^20.9.0 || >=21.1.0` | eslint ^8.57.0 || ^9.0.0 || ^10.0.0; typescript >=4.8.4 <6.1.0 | WP-07/09D: Supports ESLint8/9/10 and TS>=4.8.4<6.1. | [metadata](https://registry.npmjs.org/typescript-eslint) |
| `vite` | `8.3.2` | `^20.19.0 || >=22.12.0` | tsx ^4.8.1 (optional); jiti >=1.21.0 (optional); less ^4.0.0 (optional); sass ^1.70.0 (optional); yaml ^2.4.2 (optional); stylus >=0.54.8 (optional); terser ^5.16.0 (optional); esbuild ^0.27.0 || ^0.28.0 (optional); sugarss ^5.0.0 (optional); @types/node ^20.19.0 || >=22.12.0 (optional); sass-embedded ^1.70.0 (optional); @vitejs/devtools ^0.7.1 (optional) | WP-09C: First routine6.4.3; Vitest5 can migrate before Vite8. | [metadata](https://registry.npmjs.org/vite) |
| `vite-plugin-pwa` | `1.3.0` | `>=16.0.0` | vite ^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0; workbox-build ^7.4.1; workbox-window ^7.4.1; @vite-pwa/assets-generator ^1.0.0 (optional) | WP-07/09C: Vite3–8 peers; requires workbox-build/window^7.4.1. | [metadata](https://registry.npmjs.org/vite-plugin-pwa) |
| `vitest` | `5.0.3` | `^22.12.0 || ^24.0.0 || >=26.0.0` | vite ^6.4.0 || ^7.0.0 || ^8.0.0; jsdom * (optional); happy-dom * (optional); @vitest/ui 5.0.3 (optional); @types/node ^22.0.0 || >=24.0.0 (optional); @edge-runtime/vm * (optional); @opentelemetry/api ^1.9.0 (optional); @vitest/coverage-v8 5.0.3 (optional); @vitest/browser-preview 5.0.3 (optional); @vitest/coverage-istanbul 5.0.3 (optional); @vitest/browser-playwright 5.0.3 (optional); @vitest/browser-webdriverio ^5.0.0-beta.5 || >=5.0.0 (optional) | WP-09B: Vite>=6.4 and Node>=22.12; exactly matching coverage. | [metadata](https://registry.npmjs.org/vitest) |
| `tsx` | `4.23.15` | `>=18.0.0` | none declared | WP-02: Suggested directly declared portable CLI runner; honors tsconfig paths (verify actual script). | [metadata](https://registry.npmjs.org/tsx) |

SheetJS: select official `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` under import name `xlsx`; npm `xlsx` latest remains0.18.5. Official installation page identifies0.20.3 and authoritative CDN. Official tarball was obtained using a Mozilla User-Agent after the initial urllib HTTP403. SHA512 integrity: `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`; extracted package version0.20.3 / Node>=0.8. Clean pnpm installation and lock integrity remain WP-08 verification. `pdfjs-dist`: proposed removal only if source/config/script inspection proves unused. No replacement or blanket advisory override proposed.

## Sequencing and migration references

1. WP-03 platform/types pins; directly declare CLI runner in WP-02/03.
2. WP-07 within declared ranges: Vite6.4.3, plugin-react4.7.0, Vitest+coverage3.2.7, jsdom26.1.0, ESLint+@eslint/js9.39.5, globals16.5.0 (verify exact available line), Testing Library jest-dom6.x exact raw metadata, and routine dependencies above. Keep major-family changes for WP-09.
3. WP-08 official SheetJS0.20.3; retain ExcelJS4.4.0.
4. WP-09A TS5.9.3 then6.0.3; supported by current typescript-eslint8.71.0. Explicit TypeScript7 holdback: parser peer<6.1.0. Follow-up trigger: official typescript-eslint TypeScript7 support and successful compiler/lint tests.
5. WP-09B Vitest+coverage5.0.3 and jsdom30.1.1, possibly jest-dom7.0.1; Vite6.4.3 meets new Vite peer floor.
6. WP-09C Vite8.3.2/plugin-react6.1.1/PWA1.3.0/Workbox7.4.1 after Vitest migration (Vitest3 dependency does not support Vite8).
7. WP-09D ESLint10.12.0/@eslint/js10.0.1/typescript-eslint8.71.0/globals17.13.0/jiti2.7.0.

Primary upstream guidance:

- [Node release/LTS table](https://nodejs.org/en/about/previous-releases).
- [Dependabot ecosystem support](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories): use ecosystem `npm` for pnpm; supports7–10. This does not prove an actual update job accepts `allowBuilds`; WP-06 requires actual job and representative PR frozen install.
- [pnpm settings](https://pnpm.io/settings): current build-policy reference includes `allowBuilds`; current reference redirects/grouping must not be confused with10.x support. Read10.x reference/release evidence before modifying build-policy fields.
- [SheetJS official Node installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/): versioned authoritative CDN, npm registry obsolete; vendoring possible but default workplan CDN decision remains.
- [SheetJS prototype-pollution advisory](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) and [ReDoS advisory](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9): selected0.20.3 exceeds applicable vulnerable ranges.
- [TypeScript6 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html): review deprecated compiler options and changed defaults; preserve explicit module/moduleResolution/strict choices.
- [typescript-eslint dependency support](https://typescript-eslint.io/users/dependency-versions/): ESLint^8.57/^9/^10; TypeScript>=4.8.4<6.1.0.
- [Vitest5 migration](https://vitest.dev/guide/migration/), [Vitest4 migration](https://v4.vitest.dev/guide/migration/): review clearMocks default true, top-level-only hoisted mocks, removed sequential/pool options, precise coverage relative-root matching, default mock behavior and coverage file set. Preserve coverage thresholds and React act guard.
- [Vite8 migration](https://vite.dev/guide/migration) and [Vite7 migration](https://v7.vite.dev/guide/migration): use Rolldown/Oxc; rename build.rollupOptions to build.rolldownOptions; inspect CommonJS interop (ExcelJS/jsPDF/JSZip), input/lazy chunks, PWA hooks; document browser baseline changes. Default Vite8 baseline Chrome/Edge111, Firefox114, Safari16.4.
- [ESLint10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0): Node floors satisfied, jiti>=2.2, flat config only, per-file config lookup, updated recommended rules no-unassigned-vars/no-useless-assignment/preserve-caught-error; do not disable strict application lint merely for pass.
- [jsdom releases](https://github.com/jsdom/jsdom/releases): migration from26 spans selector/CSS/DOM changes and current Node24>=24.15 requirement; existing public behavior tests determine compatibility.
- [Vite PWA guidance](https://vite-pwa-org.netlify.app/guide/): preserve prompt registration, Pages scope/start_url, Workbox activation behavior.

## Remaining verification and owners

- Root coordinator: capture baseline commits/user changes/audits/install/test evidence; this research intentionally did not duplicate or mutate baseline.
- Coordinator and each family implementer: re-read selected exact metadata before update, inspect lock peers and run applicable gates. Engine/peer compatibility is evidence-based proposal, not proof of install/build/browser behavior.
- WP-05/06 owner: actual remote Linux/Windows jobs, required repository checks/settings, actual Dependabot job + representative PR must remain pending until observed.
- WP-08/10 owner: real fixture/Excel/LibreOffice checks remain WP-12 pending; use synthetic fixtures for maintenance gates.
- Independent reviewer: inspect target matrix/raw metadata/current official guidance; this research is Ready for Review, not self-approved.

## Copyable orchestrator handoff

Implement the workplan in docs/workplans/2026-10-dependency-and-platform-refresh.md using scoped subagents. Read current repository instructions first, preserve user changes, reproduce the baseline, and update the execution record. Follow the dependency order and per-package DoD. Delegate disjoint implementation, research, tests, and review; keep shared manifests, lockfiles, build-policy files, and integration under one named coordinator. Require independent review by a separate non-author subagent after every work package and WP-09 subpackage is implemented. Resolve required findings, obtain re-review of fixes, and record accepted review of the exact candidate before marking a package Done or releasing dependent work. Obtain final independent review of the combined result as well. Revalidate upstream versions and peer compatibility before updating. Deliver baseline repairs plus Linux/Windows CI and Dependabot first, then coherent dependency migrations and fixture-independent production browser/PWA verification. Organizer fixtures will arrive later: continue WP-00 through WP-11 and keep WP-12 explicitly pending. Report completed packages, exact checks and environments, independent review outcomes, current advisory decisions, and every remaining external verification action. Do not claim a DoD item without its evidence.
