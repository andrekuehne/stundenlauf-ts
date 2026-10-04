// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

interface Pnpmfile {
  hooks: {
    afterAllResolved(lockfile: {
      packages?: Record<string, unknown>;
      [key: string]: unknown;
    }): unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPnpmfile(value: unknown): value is Pnpmfile {
  return (
    isRecord(value) && isRecord(value.hooks) && typeof value.hooks.afterAllResolved === "function"
  );
}

const pnpmfile: unknown = createRequire(import.meta.url)("../../.pnpmfile.cjs");
if (!isPnpmfile(pnpmfile)) throw new Error("pnpm afterAllResolved hook is unavailable");

const tarball = "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz";
const artifact = `xlsx@${tarball}`;
const integrity =
  "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==";

function lockfileWith(entry: unknown) {
  return {
    lockfileVersion: "9.0",
    importers: { ".": { dependencies: { xlsx: { specifier: tarball, version: tarball } } } },
    packages: {
      [artifact]: entry,
      "unrelated@1.0.0": { resolution: { integrity: "sha512-unrelated" } },
    },
    snapshots: { [artifact]: {}, "unrelated@1.0.0": {} },
  };
}

describe("pnpm official SheetJS integrity boundary", () => {
  it("restores the reviewed checksum when a warm resolution drops it", () => {
    const resolution = { tarball };
    const entry = { version: "0.20.3", resolution, engines: { node: ">=0.8" }, hasBin: true };
    const lockfile = lockfileWith(entry);
    const expected = structuredClone(
      lockfileWith({ ...entry, resolution: { tarball, integrity } }),
    );

    expect(pnpmfile.hooks.afterAllResolved(lockfile)).toBe(lockfile);
    expect(lockfile).toEqual(expected);
    expect(lockfile.packages[artifact]).toBe(entry);
    expect(entry.resolution).toBe(resolution);
  });

  it("preserves an already matching checksum and every other field", () => {
    const lockfile = lockfileWith({ version: "0.20.3", resolution: { tarball, integrity } });
    const original = structuredClone(lockfile);

    expect(pnpmfile.hooks.afterAllResolved(lockfile)).toBe(lockfile);
    expect(lockfile).toEqual(original);
  });

  it("treats an undefined checksum as absent", () => {
    const resolution = { tarball, integrity: undefined };
    const lockfile = lockfileWith({ version: "0.20.3", resolution });

    pnpmfile.hooks.afterAllResolved(lockfile);
    expect(resolution.integrity).toBe(integrity);
  });

  it.each([
    { integrity: "sha512-conflicting", label: "conflicting checksum" },
    { integrity: "", label: "empty checksum" },
    { integrity: null, label: "null checksum" },
    { integrity: 42, label: "non-string checksum" },
  ])("rejects a $label without replacing untrusted metadata", ({ integrity: candidate }) => {
    const lockfile = lockfileWith({
      version: "0.20.3",
      resolution: { tarball, integrity: candidate },
    });
    const original = structuredClone(lockfile);

    expect(() => pnpmfile.hooks.afterAllResolved(lockfile)).toThrow(/SheetJS.*integrity/i);
    expect(lockfile).toEqual(original);
  });

  it.each([
    { tarball: "https://untrusted.example/xlsx-0.20.3.tgz", label: "different origin" },
    { tarball: "https://cdn.sheetjs.com/xlsx-0.20.4/xlsx-0.20.4.tgz", label: "different artifact" },
    { tarball: `${tarball}?redirect=other`, label: "extra URL parameters" },
    { tarball: undefined, label: "missing tarball" },
  ])("rejects a $label in the exact locked entry", ({ tarball: candidate }) => {
    const lockfile = lockfileWith({ version: "0.20.3", resolution: { tarball: candidate } });
    const original = structuredClone(lockfile);

    expect(() => pnpmfile.hooks.afterAllResolved(lockfile)).toThrow(/SheetJS.*tarball/i);
    expect(lockfile).toEqual(original);
  });

  it.each(["0.20.4", "0.18.5", undefined, null])("rejects mismatched version %s", (version) => {
    const lockfile = lockfileWith({ version, resolution: { tarball } });
    const original = structuredClone(lockfile);

    expect(() => pnpmfile.hooks.afterAllResolved(lockfile)).toThrow(/SheetJS.*version/i);
    expect(lockfile).toEqual(original);
  });

  it.each([
    { entry: undefined, label: "undefined" },
    { entry: null, label: "null" },
    { entry: "0.20.3", label: "string" },
    { entry: [], label: "array" },
    { entry: { version: "0.20.3" }, label: "missing resolution" },
    { entry: { version: "0.20.3", resolution: [] }, label: "array resolution" },
  ])("rejects malformed target entry $label", ({ entry }) => {
    const lockfile = lockfileWith(entry);
    const original = structuredClone(lockfile);

    expect(() => pnpmfile.hooks.afterAllResolved(lockfile)).toThrow(/SheetJS.*metadata/i);
    expect(lockfile).toEqual(original);
  });

  it("leaves unrelated packages and other SheetJS versions untouched", () => {
    const lockfile = {
      packages: {
        "xlsx@0.18.5": { resolution: { integrity: "sha512-old" } },
        "xlsx@https://cdn.sheetjs.com/xlsx-0.20.4/xlsx-0.20.4.tgz": {
          version: "0.20.4",
          resolution: { tarball: "https://cdn.sheetjs.com/xlsx-0.20.4/xlsx-0.20.4.tgz" },
        },
        "unrelated@1.0.0": { resolution: { integrity: "sha512-unrelated" } },
      },
    };
    const original = structuredClone(lockfile);

    expect(pnpmfile.hooks.afterAllResolved(lockfile)).toBe(lockfile);
    expect(lockfile).toEqual(original);
  });

  it("leaves a lockfile without package entries untouched", () => {
    const lockfile = { importers: {} };

    expect(pnpmfile.hooks.afterAllResolved(lockfile)).toBe(lockfile);
    expect(lockfile).toEqual({ importers: {} });
  });
});
