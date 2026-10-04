import { defineConfig, devices } from "@playwright/test";

const host = "127.0.0.1";
const port = 4173;
const previewOrigin = `http://${host}:${port}`;
/** Matches Vite `base` default in vite.config.ts */
const appBasePath = "/stundenlauf-ts/";
const appEntryUrl = `${previewOrigin}${appBasePath.replace(/\/$/, "")}/`;

/** Optional README workflow only: explicitly opt into installed Google Chrome. */
const useSystemChrome = process.env.PW_USE_SYSTEM_CHROME === "1";

export default defineConfig({
  testDir: "e2e",
  testMatch: "readme-main-screen.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: previewOrigin,
    trace: "off",
    ...devices["Desktop Chrome"],
    /** Full HD for README / e2e screenshots */
    viewport: { width: 1600, height: 900 },
    channel: useSystemChrome ? "chrome" : "chromium",
  },
  projects: [{ name: "chromium", use: {} }],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview -- --host ${host} --port ${String(port)} --strictPort`,
    url: appEntryUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
