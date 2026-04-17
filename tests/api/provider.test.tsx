import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppApi } from "@/api/contracts/index.ts";
import { AppApiProvider, useAppApi } from "@/api/provider.tsx";

const createTsAppApiMock = vi.fn();

vi.mock("@/api/ts/index.ts", () => ({
  createTsAppApi: () => createTsAppApiMock(),
}));

function Probe() {
  const api = useAppApi();
  return <div data-testid="api-kind">{(api as { kind?: string }).kind ?? "unknown"}</div>;
}

describe("AppApiProvider", () => {
  it("uses TsAppApi by default, even when url requests mock mode", () => {
    const liveApi = { kind: "live" } as unknown as AppApi;
    createTsAppApiMock.mockReturnValueOnce(liveApi);
    window.history.replaceState({}, "", "/?api=mock");

    render(
      <AppApiProvider>
        <Probe />
      </AppApiProvider>,
    );

    expect(createTsAppApiMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("api-kind")).toHaveTextContent("live");
  });

  it("uses explicitly injected api when provided", () => {
    const injectedApi = { kind: "injected" } as unknown as AppApi;
    createTsAppApiMock.mockReset();

    render(
      <AppApiProvider api={injectedApi}>
        <Probe />
      </AppApiProvider>,
    );

    expect(createTsAppApiMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("api-kind")).toHaveTextContent("injected");
  });
});
