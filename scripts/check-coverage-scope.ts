import { readFile, readdir } from "node:fs/promises";
import { join, posix, relative, resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";

function sourcePath(filename: string, projectRoot: string): string {
  const windows = /^[a-z]:[\\/]|^\\\\/i.test(projectRoot);
  const paths = windows ? win32 : posix;
  const relative = paths
    .relative(projectRoot, paths.resolve(projectRoot, filename.replaceAll("\\", "/")))
    .replaceAll("\\", "/");
  return windows ? relative.toLowerCase() : relative;
}

function includedSource(filename: string): boolean {
  return (
    filename.startsWith("src/") &&
    /\.tsx?$/.test(filename) &&
    !filename.endsWith(".d.ts") &&
    filename !== "src/main.tsx"
  );
}

export function missingCoverageSources(
  sourceFiles: readonly string[],
  lcov: string,
  projectRoot: string,
): string[] {
  const covered = new Set(
    lcov
      .split(/\r?\n/)
      .filter((line) => line.startsWith("SF:"))
      .map((line) => sourcePath(line.slice(3), projectRoot)),
  );
  return sourceFiles
    .filter((filename) => includedSource(sourcePath(filename, projectRoot)))
    .filter((filename) => !covered.has(sourcePath(filename, projectRoot)))
    .map((filename) => filename.replaceAll("\\", "/"))
    .sort();
}

async function checkCoverageScope(): Promise<void> {
  const projectRoot = process.cwd();
  const entries = await readdir(join(projectRoot, "src"), { recursive: true, withFileTypes: true });
  const sources = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(projectRoot, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .filter(includedSource);
  const lcov = await readFile(join(projectRoot, "coverage", "lcov.info"), "utf8");
  const missing = missingCoverageSources(sources, lcov, projectRoot);
  if (missing.length > 0) {
    throw new Error(
      `Coverage report is missing source files:\n${missing.map((filename) => `- ${filename}`).join("\n")}`,
    );
  }
  console.log(`Coverage scope verified (${sources.length} source files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await checkCoverageScope();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
