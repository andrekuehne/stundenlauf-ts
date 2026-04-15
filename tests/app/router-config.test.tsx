import { describe, expect, it, vi } from "vitest";

const createHashRouterMock = vi.fn((..._args: unknown[]) => ({}));
const routerProviderMock = vi.fn((_props: unknown) => null);

vi.mock("react-router-dom", () => ({
  createHashRouter: (...args: unknown[]) => createHashRouterMock(...args),
  Navigate: () => null,
  RouterProvider: (props: unknown) => routerProviderMock(props),
}));
vi.mock("@/features/corrections/index.ts", () => ({ CorrectionsPage: () => null }));
vi.mock("@/features/history/index.ts", () => ({ HistoryPage: () => null }));
vi.mock("@/features/import/index.ts", () => ({ ImportPage: () => null }));
vi.mock("@/features/season/index.ts", () => ({ SeasonPage: () => null }));
vi.mock("@/features/standings/index.ts", () => ({ StandingsPage: () => null }));
vi.mock("@/app/App.tsx", () => ({ App: () => null }));

describe("router config", () => {
  it("declares main routes and wildcard redirect", async () => {
    const mod = await import("@/app/router.tsx");
    expect(createHashRouterMock).toHaveBeenCalledTimes(1);
    const firstCall = createHashRouterMock.mock.calls[0];
    const routes = (firstCall?.[0] ?? []) as Array<{ path?: string; children?: Array<{ path?: string }> }>;
    expect(routes[0]?.path).toBe("/");
    expect(routes[0]?.children?.map((r) => r.path)).toEqual([undefined, "season", "standings", "import", "corrections", "history"]);
    expect(routes[1]?.path).toBe("*");
    expect(typeof mod.AppRouter).toBe("function");
  });
});
