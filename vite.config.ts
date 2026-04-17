import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

function readGitValue(command: string, fallback: string): string {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const appCommit = readGitValue("git rev-parse --short HEAD", "unknown");
const appVersion = readGitValue(
  "git describe --tags --always --dirty",
  appCommit,
);
const basePath = process.env.VITE_BASE_PATH ?? "/stundenlauf-ts/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "Stundenlauf-Auswertung",
        short_name: "Stundenlauf",
        description:
          "Auswertung und Verwaltung von Stundenlauf-Rennserien - lokal im Browser, ohne Server.",
        lang: "de",
        start_url: basePath,
        scope: basePath,
        display: "standalone",
        orientation: "any",
        theme_color: "#1565C0",
        background_color: "#FFFFFF",
        categories: ["sports", "utilities"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT__: JSON.stringify(appCommit),
  },
});
