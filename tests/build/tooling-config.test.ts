// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function projectPath(name: string): string {
  // TypeScript normalizes config/module paths to forward slashes on both OSes.
  return resolve(import.meta.dirname, "../..", name).replaceAll("\\", "/");
}

function readProjectConfig(name: string): ts.ParsedCommandLine {
  const config = ts.getParsedCommandLineOfConfigFile(
    projectPath(name),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (!config) throw new Error(`Cannot load ${name}`);
  expect(config.errors).toEqual([]);
  return config;
}

describe("tooling type checks", () => {
  it("checks tooling without emitting adjacent JavaScript or declarations", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "stundenlauf-noemit-"));
    try {
      const source = resolve(directory, "tool.config.ts");
      writeFileSync(source, "export const value: number = 1;\n");
      const emitted: string[] = [];
      const config = readProjectConfig("tsconfig.node.json");
      const program = ts.createProgram([source], {
        ...config.options,
        noLib: true,
      });
      program.emit(undefined, (fileName) => emitted.push(fileName));
      expect(emitted).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("includes the browser tests and every root tooling config", () => {
    const files = readProjectConfig("tsconfig.node.json").fileNames;
    for (const file of [
      "vite.config.ts",
      "vitest.config.ts",
      "eslint.config.ts",
      ".pnpmfile.cjs",
      "playwright.config.ts",
      "e2e/readme-main-screen.spec.ts",
      "scripts/dump-local-excel-fixtures.ts",
    ]) {
      expect(files).toContain(projectPath(file));
    }
  });

  it("resolves application aliases from both application and tooling projects", () => {
    for (const name of ["tsconfig.json", "tsconfig.node.json"]) {
      const config = readProjectConfig(name);
      const source = projectPath("scripts/dump-local-excel-fixtures.ts");
      const module = ts.resolveModuleName("@/ingestion/errors", source, config.options, ts.sys);
      expect(module.resolvedModule?.resolvedFileName).toBe(projectPath("src/ingestion/errors.ts"));
    }
  });

  it("checks JavaScript hook types without emitting files", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "stundenlauf-hook-types-"));
    try {
      const source = resolve(directory, "hook.cjs");
      writeFileSync(
        source,
        '/** @type {number} */\nconst value = "wrong";\nmodule.exports = { value };\n',
      );
      const config = readProjectConfig("tsconfig.node.json");
      const program = ts.createProgram([source], config.options);
      expect(ts.getPreEmitDiagnostics(program).some((diagnostic) => diagnostic.code === 2322)).toBe(
        true,
      );
      const emitted: string[] = [];
      program.emit(undefined, (fileName) => emitted.push(fileName));
      expect(emitted).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
