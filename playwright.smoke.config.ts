import { defineConfig, devices } from "@playwright/test";

import { APP_BASE_PATH, SMOKE_ORIGIN } from "./e2e/helpers/smoke-settings.ts";

export default defineConfig({
  testDir: "e2e",
  testMatch: "production-smoke.spec.ts",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    channel: "chromium",
    baseURL: SMOKE_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
  },
  webServer: {
    command: "node e2e/helpers/production-server.ts",
    url: `${SMOKE_ORIGIN}${APP_BASE_PATH}`,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
