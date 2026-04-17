// @vitest-environment node
import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config.ts";

describe("vite build entrypoints", () => {
  it("does not include legacy bridge entrypoint", () => {
    const input = viteConfig.build?.rollupOptions?.input;
    expect(input).toEqual({
      main: expect.stringContaining("index.html"),
    });
  });
});
