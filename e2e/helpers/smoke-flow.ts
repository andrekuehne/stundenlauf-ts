import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

import { APP_BASE_PATH } from "./smoke-settings.ts";
import { syntheticSingles } from "./synthetic-workbooks.ts";

export async function createSeason(page: Page, label: string): Promise<void> {
  await page.goto(`${APP_BASE_PATH}#/season`);
  await expect(page.getByRole("heading", { name: "Bestehende Saisons" })).toBeVisible();
  await expect(page.getByText("Saisons werden geladen...", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Saison anlegen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Neue Saison", exact: true });
  await dialog.getByLabel("Saisonname", { exact: true }).fill(label);
  await dialog.getByRole("button", { name: "Neue Saison erstellen", exact: true }).click();
  await expect(page).toHaveURL(/#\/import$/);
  await expect(page.getByTestId("import-select-meta")).toContainText(label);
}

export async function createAndImportSeason(page: Page, label: string): Promise<void> {
  await createSeason(page, label);
  for (const race of [1, 2] as const) {
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: /Datei wählen/ }).click(),
    ]);
    await chooser.setFiles(syntheticSingles(race));
    await page.getByRole("button", { name: "Weiter zu Zuordnungen", exact: true }).click();
    if (race === 2) {
      // The misspelling is below perfect-match automation and above the review floor.
      await expect(page.locator(".import-review__incoming")).toContainText("Anna Roth");
      const candidate = page.getByRole("button", { name: /^Anna Rauch(?: |$)/ });
      await expect(candidate).toBeVisible();
      await candidate.click();
      await expect(candidate).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Zusammenfassung ➡️", exact: true }).click();
    }
    await expect(
      page.getByRole("heading", { name: "Import-Zusammenfassung", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Import abschließen", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Datei und Kontext auswählen", exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Auswertung", exact: true }).click();
}

export async function assertStandings(page: Page, label: string): Promise<void> {
  await expect(page.getByTestId("standings-meta")).toContainText(label);
  await expect(page.getByTestId("standings-kpi-teams").locator("strong")).toHaveText("2");
  await expect(page.getByTestId("standings-kpi-races").locator("strong")).toHaveText("2 / 2");
  await expect(page.getByTestId("standings-team-name")).toHaveText(["Anna Rauch", "Eva Müller"]);
  for (const [name, expectedCells] of [
    [
      "Anna Rauch",
      ["1", "Anna Rauch(1990)", "TSV Süd", "5,200", "100", "5,300", "100", "10,500", "200"],
    ],
    ["Eva Müller", ["2", "Eva Müller(1992)", "—", "4,800", "95", "4,900", "95", "9,700", "190"]],
  ] as const) {
    const row = page
      .getByRole("row")
      .filter({ has: page.getByTestId("standings-team-name").filter({ hasText: name }) });
    // Collapse layout whitespace while retaining exact cell contents/order.
    await expect
      .poll(async () =>
        (await row.getByRole("cell").allTextContents()).map((cell) =>
          cell.replace(/\s+/g, "").trim(),
        ),
      )
      .toEqual(expectedCells.map((cell) => cell.replace(/\s+/g, "")));
  }
}

export async function downloadBytes(
  page: Page,
  trigger: Locator,
  testInfo: TestInfo,
  filename: string,
): Promise<Buffer> {
  const [download] = await Promise.all([page.waitForEvent("download"), trigger.click()]);
  expect(await download.failure()).toBeNull();
  const target = testInfo.outputPath(filename);
  await download.saveAs(target);
  return readFile(target);
}

export async function downloadBackup(
  page: Page,
  label: string,
  testInfo: TestInfo,
  filename: string,
): Promise<Buffer> {
  await page.getByRole("link", { name: "Saison", exact: true }).click();
  const row = page.getByRole("row").filter({ has: page.getByText(label, { exact: true }) });
  return downloadBytes(
    page,
    row.getByRole("button", { name: "Datensicherung", exact: true }),
    testInfo,
    filename,
  );
}

export async function waitForServiceWorker(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state;
      }),
    )
    .toBe("activated");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe(APP_BASE_PATH);
  // Production clientsClaim is false: the first load is deliberately uncontrolled.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}
