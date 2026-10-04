// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { missingCoverageSources } from "../../scripts/check-coverage-scope.ts";

const temporaryDirectories: string[] = [];
const scriptPath = fileURLToPath(new URL("../../scripts/check-coverage-scope.ts", import.meta.url));

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createProject(lcov?: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "stundenlauf-coverage-scope-"));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, "src"));
  await writeFile(join(directory, "src", "covered.ts"), "export const covered = true;\n");
  await writeFile(join(directory, "src", "covered.test.ts"), "export const coveredTest = true;\n");
  await mkdir(join(directory, "src", "components"));
  await writeFile(
    join(directory, "src", "components", "covered.test.tsx"),
    "export const coveredTest = true;\n",
  );
  if (lcov !== undefined) {
    await mkdir(join(directory, "coverage"));
    await writeFile(join(directory, "coverage", "lcov.info"), lcov);
  }
  return directory;
}

describe("coverage source scope", () => {
  it("accepts every source file represented in LCOV, including zero-hit modules", () => {
    const sources = ["src/covered.ts", "src/components/UpdatePrompt.tsx"];
    const lcov =
      "SF:src/covered.ts\nDA:1,1\nend_of_record\nSF:src/components/UpdatePrompt.tsx\nDA:1,0\nend_of_record\n";
    expect(missingCoverageSources(sources, lcov, "/project")).toEqual([]);
  });

  it("reports an unexecuted source module that vanished from LCOV", () => {
    expect(
      missingCoverageSources(
        ["src/covered.ts", "src/components/UpdatePrompt.tsx"],
        "SF:src/covered.ts\nend_of_record\n",
        "/project",
      ),
    ).toEqual(["src/components/UpdatePrompt.tsx"]);
  });

  it("ignores co-located test modules while still reporting absent application sources", () => {
    expect(
      missingCoverageSources(
        [
          "src/covered.ts",
          "src/covered.test.ts",
          "src/components/UpdatePrompt.test.tsx",
          "src/components/Unexecuted.tsx",
          "src/components/application.spec.tsx",
          "src/tests/application.ts",
        ],
        "SF:src/covered.ts\nend_of_record\n",
        "/project",
      ),
    ).toEqual([
      "src/components/Unexecuted.tsx",
      "src/components/application.spec.tsx",
      "src/tests/application.ts",
    ]);
  });

  it("excludes the application entry, declarations and other file types", () => {
    expect(
      missingCoverageSources(
        [
          "src/covered.ts",
          "src/main.tsx",
          "src/vite-env.d.ts",
          "src/nested/types.d.ts",
          "src/theme.css",
        ],
        "SF:src/covered.ts\n",
        "/project",
      ),
    ).toEqual([]);
  });

  it.each([
    { root: "/project", file: "src/components/UpdatePrompt.tsx" },
    { root: "/project", file: "/project/src/components/UpdatePrompt.tsx" },
    { root: "C:\\project", file: "src\\components\\UpdatePrompt.tsx" },
    { root: "C:\\project", file: "c:\\project\\src\\components\\UpdatePrompt.tsx" },
  ])("normalizes native relative and absolute paths: $file", ({ root, file }) => {
    expect(
      missingCoverageSources(["src/components/UpdatePrompt.tsx"], `SF:${file}\r\n`, root),
    ).toEqual([]);
  });

  it("exits successfully when application sources are represented and test modules are absent", async () => {
    const directory = await createProject("SF:src/covered.ts\n");
    const result = spawnSync(process.execPath, [scriptPath], { cwd: directory, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Coverage scope verified (1 source files).");
  });

  it("fails and lists every missing filesystem source", async () => {
    const directory = await createProject("SF:src/covered.ts\n");
    await writeFile(join(directory, "src", "missing.ts"), "export const missing = true;\n");
    await writeFile(join(directory, "src", "unexecuted.tsx"), "export const unexecuted = true;\n");
    const result = spawnSync(process.execPath, [scriptPath], { cwd: directory, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/missing.ts");
    expect(result.stderr).toContain("src/unexecuted.tsx");
    expect(result.stderr).not.toContain("covered.test.ts");
    expect(result.stderr).not.toContain("covered.test.tsx");
  });

  it("fails when the LCOV report cannot be read", async () => {
    const directory = await createProject();
    const result = spawnSync(process.execPath, [scriptPath], { cwd: directory, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("lcov.info");
  });
});
