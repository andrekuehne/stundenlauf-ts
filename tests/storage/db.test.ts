import { describe, expect, it, vi } from "vitest";

const openDBMock = vi.fn();
vi.mock("idb", () => ({
  openDB: (...args: unknown[]) => openDBMock(...args),
}));

describe("openStundenlaufDB", () => {
  it("opens DB with expected stores in upgrade", async () => {
    const workspaceCreate = vi.fn();
    const eventLogCreate = vi.fn();
    openDBMock.mockImplementation(async (_name: string, _version: number, options: { upgrade: (db: { objectStoreNames: { contains: (name: string) => boolean }; createObjectStore: (name: string, opts: unknown) => void }) => void }) => {
      options.upgrade({
        objectStoreNames: { contains: () => false },
        createObjectStore: (name: string) => {
          if (name === "workspace") workspaceCreate();
          if (name === "event_logs") eventLogCreate();
        },
      });
      return {} as never;
    });

    const mod = await import("@/storage/db.ts");
    await mod.openStundenlaufDB();

    expect(openDBMock).toHaveBeenCalledWith("stundenlauf-ts", 1, expect.any(Object));
    expect(workspaceCreate).toHaveBeenCalledTimes(1);
    expect(eventLogCreate).toHaveBeenCalledTimes(1);
  });
});
