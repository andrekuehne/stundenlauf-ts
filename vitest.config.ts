import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
      // Unit tests mock the hook; production browser tests exercise the actual SW.
      "virtual:pwa-register/react": resolve(import.meta.dirname, "tests/mocks/pwa-register.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/**/*.d.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 50,
        functions: 50,
        statements: 50,
        branches: 45,
      },
    },
  },
});
