import { describe, expect, it, vi } from "vitest";
import { triggerDownload } from "@/portability/download.ts";

describe("triggerDownload", () => {
  it("creates anchor click and revokes object URL", () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:test"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      writable: true,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const blob = new Blob(["abc"], { type: "text/plain" });
    triggerDownload(blob, "report.txt");

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");

    Object.defineProperty(URL, "createObjectURL", { value: originalCreate, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: originalRevoke, writable: true });
  });
});
