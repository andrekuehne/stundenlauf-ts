import { defineConfig, devices } from "@playwright/test";

const host = "127.0.0.1";
const port = 4173;
const previewOrigin = `http://${host}:${port}`;
/** Matches Vite `base` default in vite.config.ts */
const appBasePath = "/stundenlauf-ts/";
const appEntryUrl = `${previewOrigin}${appBasePath.replace(/\/$/, "")}/`;

/** Set `PW_USE_SYSTEM_CHROME=1` to use Google Chrome (skip `playwright install`). On Windows, defaults on unless `PW_USE_BUNDLED_CHROMIUM=1`. */
const useSystemChrome =
  process.env.PW_USE_SYSTEM_CHROME === "1" ||
  (process.platform === "win32" && process.env.PW_USE_BUNDLED_CHROMIUM !== "1");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: previewOrigin,
    trace: "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 720 },
    ...(useSystemChrome ? { channel: "chrome" as const } : {}),
  },
  projects: [{ name: "chromium", use: {} }],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview -- --host ${host} --port ${String(port)} --strictPort`,
    url: appEntryUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
