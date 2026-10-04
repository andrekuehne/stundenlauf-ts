import { beforeEach, describe, expect, it } from "vitest";
import { checksumMatches, sha256Hex } from "@/portability/integrity.ts";
import { buildManifest, validateManifest } from "@/portability/manifest.ts";
import { sanitizeFilename } from "@/portability/sanitize.ts";
import { resetSeqCounter } from "../helpers/event-factories.ts";

beforeEach(() => {
  resetSeqCounter();
});

describe("portability helpers", () => {
  it("builds and validates a manifest", () => {
    const manifest = buildManifest({
      seasonId: "season-1",
      label: "Trainingsblock Alpha",
      eventlogFormatVersion: 1,
      eventsTotal: 3,
      lastEventSeq: 2,
      sha256Eventlog: "abcdef",
      exportedAt: "2026-04-14T18:30:00.000Z",
      appVersion: "test-version",
    });

    expect(validateManifest(manifest)).toEqual({
      ...manifest,
      sha256_eventlog: "abcdef",
    });
  });

  it("rejects unsupported archive format versions", () => {
    expect(() =>
      validateManifest({
        format: "stundenlauf-ts-season-archive",
        format_version: 2,
        exported_at: "2026-04-14T18:30:00.000Z",
        app_version: "test",
        eventlog_format_version: 1,
        season_id: "season-1",
        label: "Test",
        events_total: 0,
        last_event_seq: -1,
        sha256_eventlog: "abcdef",
      }),
    ).toThrow("Nicht unterstützte Saisonarchiv-Version");
  });

  it("computes stable SHA-256 digests", async () => {
    const bytes = new TextEncoder().encode("stundenlauf");
    expect(await sha256Hex(bytes)).toMatch(/^[0-9a-f]{64}$/);
    expect(await checksumMatches(bytes, await sha256Hex(bytes))).toBe(true);
  });

  it.each(["ArrayBuffer", "SharedArrayBuffer"] as const)(
    "hashes only the payload of offset views backed by %s",
    async (backingType) => {
      const payload = new TextEncoder().encode("stundenlauf");
      const offset = 3;
      const allocationLength = offset + payload.byteLength + 5;
      const backing =
        backingType === "ArrayBuffer"
          ? new ArrayBuffer(allocationLength)
          : new SharedArrayBuffer(allocationLength);
      const allocation = new Uint8Array(backing);
      allocation.fill(0x5a);
      allocation.set(payload, offset);
      const bytes = allocation.subarray(offset, offset + payload.byteLength);
      const dataView = new DataView(backing, offset, payload.byteLength);
      const expectedDigest = "4aba3ce731fd32267574d38ccf2ee9fd0ff073a7744ccd407a418c707b566338";

      expect(await sha256Hex(bytes)).toBe(expectedDigest);
      expect(await sha256Hex(dataView)).toBe(expectedDigest);
      expect(await checksumMatches(dataView, expectedDigest)).toBe(true);
      expect(await sha256Hex(allocation)).not.toBe(expectedDigest);
    },
  );

  it("sanitizes generic season names for archive downloads", () => {
    expect(sanitizeFilename("Trainingsblock Süd 2026")).toBe("trainingsblock-sud-2026");
    expect(sanitizeFilename("   ")).toBe("season");
  });
});
