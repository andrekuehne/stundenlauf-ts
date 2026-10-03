// pnpm 10 can omit remote-tarball integrity during a warm lockfile-only update.
// Restore only this independently verified official artifact; never trust a new hash.
const sheetjsTarball = "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz";
const sheetjsIntegrity =
  "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==";

/** @typedef {{ packages?: Record<string, unknown> }} Lockfile */
/** @typedef {{ tarball?: unknown, integrity?: unknown }} Resolution */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {Lockfile} lockfile
 * @returns {Lockfile}
 */
function afterAllResolved(lockfile) {
  if (lockfile.packages === undefined) return lockfile;
  if (!isRecord(lockfile.packages))
    throw new Error("SheetJS lockfile package metadata is malformed");
  const artifact = `xlsx@${sheetjsTarball}`;
  if (!Object.hasOwn(lockfile.packages, artifact)) return lockfile;

  const entry = lockfile.packages[artifact];
  if (!isRecord(entry) || !isRecord(entry.resolution)) {
    throw new Error("SheetJS lockfile artifact metadata is malformed");
  }
  if (entry.version !== "0.20.3")
    throw new Error("SheetJS lockfile version differs from reviewed 0.20.3");

  /** @type {Resolution} */
  const resolution = entry.resolution;
  if (resolution.tarball !== sheetjsTarball) {
    throw new Error("SheetJS lockfile tarball differs from the reviewed official URL");
  }
  if (resolution.integrity !== undefined && resolution.integrity !== sheetjsIntegrity) {
    throw new Error("SheetJS lockfile integrity differs from the reviewed official checksum");
  }
  if (resolution.integrity === undefined) resolution.integrity = sheetjsIntegrity;
  return lockfile;
}

module.exports = { hooks: { afterAllResolved } };
