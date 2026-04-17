// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("lazy loading guardrails", () => {
  it("keeps feature routes lazy-loaded", () => {
    const routerSource = readSource("src/app/router.tsx");
    expect(routerSource).toContain("lazy(async () =>");
  });

  it("loads heavy export/portability modules on demand", () => {
    const apiSource = readSource("src/api/ts/index.ts");
    expect(apiSource).toContain("await import(\"@/export/pdf.ts\")");
    expect(apiSource).toContain("await import(\"@/export/excel.ts\")");
    expect(apiSource).toContain("await import(\"@/portability/export-season.ts\")");
    expect(apiSource).toContain("await import(\"@/portability/import-season.ts\")");
  });
});
