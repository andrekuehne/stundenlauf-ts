import { expect, test } from "@playwright/test";

import { APP_BASE_PATH, BUILD_VERSIONS } from "./helpers/smoke-settings.ts";
import { readArchive, validateExcel, validatePdf } from "./helpers/download-validation.ts";
import {
  assertStandings,
  createAndImportSeason,
  createSeason,
  downloadBackup,
  downloadBytes,
  waitForServiceWorker,
} from "./helpers/smoke-flow.ts";

test.beforeAll(({ browser }) => {
  console.log(`Production browser: Chromium ${browser.version()}`);
});

test.beforeEach(async ({ request }) => {
  const response = await request.post("/__smoke__/build/a");
  expect(response.ok()).toBe(true);
});

test("production import review, standings, exports and archive restore", async ({
  page,
}, testInfo) => {
  const seasonName = "Synthetische Saison 2026";
  await test.step("create a season and review/finalize two synthetic workbooks", async () => {
    await createAndImportSeason(page, seasonName);
    await assertStandings(page, seasonName);
  });

  await test.step("retain indexed season data after a reload", async () => {
    await page.reload();
    await assertStandings(page, seasonName);
  });

  await test.step("download valid spreadsheets and PDF with actual result contents", async () => {
    const excel = await downloadBytes(
      page,
      page.getByRole("button", { name: "Excel exportieren" }),
      testInfo,
      "results.xlsx",
    );
    await validateExcel(excel);
    const pdf = await downloadBytes(
      page,
      page.getByRole("button", { name: "PDF exportieren" }),
      testInfo,
      "results.pdf",
    );
    validatePdf(pdf);
  });

  await test.step("round-trip archive event data through an empty target season", async () => {
    const originalBytes = await downloadBackup(
      page,
      seasonName,
      testInfo,
      "original.stundenlauf-season.zip",
    );
    const original = await readArchive(originalBytes, seasonName);
    const restoredName = "Wiederhergestellte Saison 2026";
    await createSeason(page, restoredName);
    await page.getByRole("link", { name: "Saison", exact: true }).click();
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Saison importieren", exact: true }).click(),
    ]);
    await chooser.setFiles({
      name: "synthetic.stundenlauf-season.zip",
      mimeType: "application/zip",
      buffer: originalBytes,
    });
    await expect(
      page.getByText(/aus "synthetic\.stundenlauf-season\.zip" importiert/),
    ).toBeVisible();
    // Season command results do not refresh the season list; read the persisted state.
    await page.reload();
    const restoredRow = page
      .getByRole("row")
      .filter({ has: page.getByText(restoredName, { exact: true }) });
    await restoredRow.getByRole("button", { name: "Öffnen", exact: true }).click();
    await assertStandings(page, restoredName);
    const restoredBytes = await downloadBackup(
      page,
      restoredName,
      testInfo,
      "restored.stundenlauf-season.zip",
    );
    const restored = await readArchive(restoredBytes, restoredName);
    expect(restored.manifest.season_id).not.toBe(original.manifest.season_id);
    expect(restored.eventlog.events).toEqual(original.eventlog.events);
  });
});

test("production PWA offline startup and real release update preserve season events", async ({
  page,
  context,
  request,
}, testInfo) => {
  const seasonName = "PWA Saison 2026";
  await createAndImportSeason(page, seasonName);
  await assertStandings(page, seasonName);
  await waitForServiceWorker(page);
  await expect(page.getByText(BUILD_VERSIONS.a, { exact: true })).toBeVisible();
  const before = await readArchive(
    await downloadBackup(page, seasonName, testInfo, "before-update.zip"),
    seasonName,
  );
  await page.getByRole("link", { name: "Auswertung", exact: true }).click();

  await test.step("start the actual precached production app while offline", async () => {
    await context.setOffline(true);
    try {
      const response = await page.reload();
      expect(response?.fromServiceWorker()).toBe(true);
      await assertStandings(page, seasonName);
      await expect(page.getByText(BUILD_VERSIONS.a, { exact: true })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  await test.step("detect and apply the next generated service worker through the real prompt", async () => {
    const switchResponse = await request.post("/__smoke__/build/b");
    expect(switchResponse.ok()).toBe(true);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error("Production service worker registration is absent");
      await registration.update();
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state,
        ),
      )
      .toBe("installed");
    const prompt = page.getByRole("alert").filter({ hasText: "Neue Version verfuegbar." });
    await expect(prompt).toBeVisible();
    await Promise.all([
      page.waitForEvent("load"),
      prompt.getByRole("button", { name: "Aktualisieren", exact: true }).click(),
    ]);
    await expect(page.getByText(BUILD_VERSIONS.b, { exact: true })).toBeVisible();
    await expect(prompt).toBeHidden();
    expect(new URL(page.url()).pathname).toBe(APP_BASE_PATH);
    await assertStandings(page, seasonName);
  });

  const after = await readArchive(
    await downloadBackup(page, seasonName, testInfo, "after-update.zip"),
    seasonName,
  );
  expect(after.manifest.season_id).toBe(before.manifest.season_id);
  expect(after.eventlog.events).toEqual(before.eventlog.events);
  await page.getByRole("link", { name: "Auswertung", exact: true }).click();
  await context.setOffline(true);
  try {
    const response = await page.reload();
    expect(response?.fromServiceWorker()).toBe(true);
    await assertStandings(page, seasonName);
    await expect(page.getByText(BUILD_VERSIONS.b, { exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
