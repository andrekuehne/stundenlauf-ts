import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test } from "@playwright/test";

const screenshotPath = "docs/readme/main-screen.png";

/** Must match `STR.status.appLoading` */
const APP_LOADING = "Oberflaeche wird geladen...";
/** Must match `STR.views.season.loading` */
const SEASON_LOADING = "Saisons werden geladen...";

test("captures main screen (Saison) for README", async ({ page }) => {
  await page.goto(`${appPathPrefix()}/#/season`);
  await expect(page.getByRole("heading", { name: "Stundenlauf-Auswertung" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Saison" })).toBeVisible();

  await expect(page.getByText(APP_LOADING)).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText(SEASON_LOADING)).toBeHidden({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Bestehende Saisons" })).toBeVisible();
  await expect(page.getByTestId("season-meta")).toBeVisible();

  await page.evaluate(() => document.fonts.ready);

  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
});

/** Vite app base without trailing slash, e.g. `/stundenlauf-ts` */
function appPathPrefix(): string {
  const base = process.env.PLAYWRIGHT_APP_BASE_PATH ?? "/stundenlauf-ts/";
  return base.replace(/\/$/, "") || "/";
}
