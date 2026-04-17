import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const readmeDir = "docs/readme";
/** Ordered workflow shots (`01`…`13`) for README sequence. */
const shotSeasonOverview = `${readmeDir}/01-season-overview.png`;
const shotCreateDialog = `${readmeDir}/02-season-create-modal.png`;
const shotImport = `${readmeDir}/03-import-landing.png`;
const shotImportFileChosen = `${readmeDir}/04-import-file-selected.png`;
const shotImportReview = `${readmeDir}/05-import-review-matches.png`;
const shotAfterFinalize = `${readmeDir}/06-import-after-finalize.png`;
const shotMw2Selected = `${readmeDir}/07-import-mw2-file-selected.png`;
const shotMw2Review = `${readmeDir}/08-import-mw2-zuordnungen.png`;
const shotMw2CandidateSelected = `${readmeDir}/09-import-mw2-candidate-selected.png`;
const shotCorrectionModal = `${readmeDir}/10-import-correction-modal.png`;
const shotAfterSaveAndNext = `${readmeDir}/11-import-after-save-and-next.png`;
const shotImportSummary = `${readmeDir}/12-import-summary.png`;
const shotStandingsAuswertung = `${readmeDir}/13-standings-auswertung.png`;

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const singlesFixtureMw1 = path.join(e2eDir, "..", "tests", "data", "xlsx", "Ergebnisliste MW_1.xlsx");
const singlesFixtureMw2 = path.join(e2eDir, "..", "tests", "data", "xlsx", "Ergebnisliste MW_2.xlsx");

/** Extra wait after sidebar active tab changes so CSS highlight animation can finish before screenshots. */
const SIDEBAR_NAV_SETTLE_MS = 450;

/** Must match `STR.status.appLoading` */
const APP_LOADING = "Oberflaeche wird geladen...";
/** Must match `STR.views.season.loading` */
const SEASON_LOADING = "Saisons werden geladen...";
/** Must match `STR.views.season.createOpenAction` */
const CREATE_SEASON_BUTTON = "Saison anlegen";
/** Must match `STR.views.season.createTitle` */
const CREATE_SEASON_DIALOG = "Neue Saison";
/** Must match `STR.views.season.createLabel` */
const SEASON_NAME_LABEL = "Saisonname";
/** Must match `STR.views.season.createAction` */
const CREATE_SEASON_SUBMIT = "Neue Saison erstellen";
/** Must match `STR.views.import.filePickButton` (button also prefixes 📂) */
const FILE_PICK_BUTTON = /Datei wählen/;
/** Must match `STR.views.import.stepNextToReview` */
const STEP_NEXT_TO_REVIEW = "Weiter zu Zuordnungen";
/** Must match `STR.views.import.stepBackToSelection` */
const STEP_BACK_TO_SELECTION = "Zurück zu Datei";
/** Must match `STR.views.import.summaryTitle` */
const SUMMARY_TITLE = "Import-Zusammenfassung";
/** Must match `STR.views.import.finalizeImport` */
const FINALIZE_IMPORT = "Import abschließen";
/** Must match `STR.views.import.reviewNextEntry` + trailing emoji in ImportPage */
const REVIEW_NEXT = "Nächste ➡️";
/** Must match `STR.views.import.summaryNext` */
const REVIEW_TO_SUMMARY = "Zusammenfassung ➡️";
/** Must match `STR.views.import.selectFileTitle` */
const SELECT_FILE_TITLE = "Datei und Kontext auswählen";
/** Must match `STR.views.import.fixData` (leading emoji in UI) */
const FIX_DATA_BUTTON = /Daten korrigieren/;
/** Import correction modal: `ImportPage` dialog `aria-label` / heading */
const CORRECTION_MODAL = "Daten korrigieren";
/** Must match correction modal primary action label in `ImportPage` */
const CORRECTION_SAVE = "Speichern";
/** Must match `STR.shell.tabs.import` */
const NAV_IMPORT = "Import";
/** Must match `STR.shell.tabs.standings` */
const NAV_STANDINGS = "Auswertung";
/** Must match `STR.views.standings.loading` */
const STANDINGS_LOADING = "Wertungen werden geladen...";

test("readme workflow: season, create dialog, import", async ({ page }) => {
  await mkdir(readmeDir, { recursive: true });

  await page.goto(`${appPathPrefix()}/#/season`);
  await expect(page.getByRole("heading", { name: "Stundenlauf-Auswertung" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Saison" })).toBeVisible();

  await expect(page.getByText(APP_LOADING)).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText(SEASON_LOADING)).toBeHidden({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Bestehende Saisons" })).toBeVisible();
  await expect(page.getByTestId("season-meta")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  await page.screenshot({ path: shotSeasonOverview, fullPage: true });

  await page.getByRole("button", { name: CREATE_SEASON_BUTTON }).click();
  const dialog = page.getByRole("dialog", { name: CREATE_SEASON_DIALOG });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(SEASON_NAME_LABEL).fill("Stundenlauf 2025");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotCreateDialog, fullPage: true });

  await dialog.getByRole("button", { name: CREATE_SEASON_SUBMIT }).click();
  await expect(page).toHaveURL(/#\/import\b/);
  await expect(page.getByTestId("import-select-meta")).toBeVisible({ timeout: 30_000 });
  await settleAfterSidebarRoute(page, NAV_IMPORT);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotImport, fullPage: true });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: FILE_PICK_BUTTON }).click(),
  ]);
  await fileChooser.setFiles(singlesFixtureMw1);
  await expect(page.getByRole("button", { name: STEP_NEXT_TO_REVIEW })).toBeEnabled({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotImportFileChosen, fullPage: true });

  await page.getByRole("button", { name: STEP_NEXT_TO_REVIEW }).click();
  await expect(
    page.getByRole("button", { name: STEP_BACK_TO_SELECTION }).or(page.getByRole("heading", { name: SUMMARY_TITLE })),
  ).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotImportReview, fullPage: true });

  await goToImportSummaryFromReviewOrStay(page);
  await page.getByRole("button", { name: FINALIZE_IMPORT }).click();
  await expect(page.getByRole("heading", { name: SELECT_FILE_TITLE })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotAfterFinalize, fullPage: true });

  const [fileChooser2] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: FILE_PICK_BUTTON }).click(),
  ]);
  await fileChooser2.setFiles(singlesFixtureMw2);
  await expect(page.getByRole("button", { name: STEP_NEXT_TO_REVIEW })).toBeEnabled({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotMw2Selected, fullPage: true });

  await page.getByRole("button", { name: STEP_NEXT_TO_REVIEW }).click();
  await expect(
    page.getByRole("button", { name: STEP_BACK_TO_SELECTION }).or(page.getByRole("heading", { name: SUMMARY_TITLE })),
  ).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotMw2Review, fullPage: true });

  await expect(page.getByRole("button", { name: STEP_BACK_TO_SELECTION })).toBeVisible({ timeout: 30_000 });
  const firstMergeCandidate = page.locator("button.import-candidate:not(.import-candidate--new)").first();
  await expect(firstMergeCandidate).toBeVisible({ timeout: 30_000 });
  await firstMergeCandidate.click();
  await expect(firstMergeCandidate).toHaveClass(/is-selected/);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotMw2CandidateSelected, fullPage: true });

  const fixData = page.getByRole("button", { name: FIX_DATA_BUTTON });
  await expect(fixData).toBeEnabled({ timeout: 30_000 });
  await fixData.click();
  await expect(page.getByRole("dialog", { name: CORRECTION_MODAL })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotCorrectionModal, fullPage: true });

  const correctionDialog = page.getByRole("dialog", { name: CORRECTION_MODAL });
  await correctionDialog.getByRole("button", { name: CORRECTION_SAVE }).click();
  await expect(page.getByRole("dialog", { name: CORRECTION_MODAL })).toBeHidden({ timeout: 30_000 });

  const reviewForward = page.locator(".import-review__next-button");
  await expect(reviewForward).toBeEnabled({ timeout: 30_000 });
  await reviewForward.click();

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotAfterSaveAndNext, fullPage: true });

  await advanceReviewUntilForwardShowsZusammenfassung(page);
  const mergeCard = page.locator("button.import-candidate:not(.import-candidate--new)").first();
  await expect(mergeCard).toBeVisible({ timeout: 30_000 });
  await mergeCard.click();
  await expect(mergeCard).toHaveClass(/is-selected/);

  const toSummaryBtn = page.locator(".import-review__next-button");
  await expect(toSummaryBtn).toBeEnabled({ timeout: 30_000 });
  await expect(toSummaryBtn).toContainText("Zusammenfassung");
  await toSummaryBtn.click();
  await expect(page.getByRole("heading", { name: SUMMARY_TITLE })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotImportSummary, fullPage: true });

  await page.getByRole("button", { name: FINALIZE_IMPORT }).click();
  await expect(page.getByRole("heading", { name: SELECT_FILE_TITLE })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("link", { name: NAV_STANDINGS }).click();
  await expect(page).toHaveURL(/#\/standings\b/);
  await expect(page.getByText(STANDINGS_LOADING)).toBeHidden({ timeout: 60_000 });
  await expect(page.getByTestId("standings-meta")).toBeVisible({ timeout: 60_000 });
  await settleAfterSidebarRoute(page, NAV_STANDINGS);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shotStandingsAuswertung, fullPage: true });
});

/** Active `NavLink` (`is-active`) plus a short delay for sidebar highlight transitions. */
async function settleAfterSidebarRoute(page: Page, tabLabel: string): Promise<void> {
  await expect(page.getByRole("link", { name: tabLabel })).toHaveClass(/is-active/);
  await delay(SIDEBAR_NAV_SETTLE_MS);
}

/** Vite app base without trailing slash, e.g. `/stundenlauf-ts` */
function appPathPrefix(): string {
  const base = process.env.PLAYWRIGHT_APP_BASE_PATH ?? "/stundenlauf-ts/";
  return base.replace(/\/$/, "") || "/";
}

/**
 * From review step, advance with "Nächste" until "Zusammenfassung" appears, then open summary.
 * If the draft had no review items, we are already on the summary step.
 */
async function goToImportSummaryFromReviewOrStay(page: Page): Promise<void> {
  const summaryHeading = page.getByRole("heading", { name: SUMMARY_TITLE });
  if (await summaryHeading.isVisible()) {
    return;
  }

  const maxClicks = 200;
  for (let i = 0; i < maxClicks; i++) {
    if (await summaryHeading.isVisible()) {
      return;
    }
    const toSummary = page.getByRole("button", { name: REVIEW_TO_SUMMARY });
    if ((await toSummary.count()) > 0 && (await toSummary.isEnabled())) {
      await toSummary.click();
      await expect(summaryHeading).toBeVisible({ timeout: 60_000 });
      return;
    }
    const next = page.getByRole("button", { name: REVIEW_NEXT });
    await expect(next).toBeEnabled({ timeout: 30_000 });
    await next.click();
  }
  throw new Error("Could not reach import summary (too many review steps)");
}

/** Toolbar forward control shows `Nächste` until the last review, then `Zusammenfassung ➡️`. */
async function advanceReviewUntilForwardShowsZusammenfassung(page: Page): Promise<void> {
  const forward = page.locator(".import-review__next-button");
  const maxSteps = 200;
  for (let i = 0; i < maxSteps; i++) {
    const label = (await forward.textContent()) ?? "";
    if (label.includes("Zusammenfassung")) {
      return;
    }
    await expect(forward).toBeEnabled({ timeout: 30_000 });
    await forward.click();
  }
  throw new Error("Review toolbar never reached Zusammenfassung step");
}
