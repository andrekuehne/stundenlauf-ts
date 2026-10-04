import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRegisterSW } from "virtual:pwa-register/react";
import { UpdatePrompt } from "@/components/feedback/UpdatePrompt.tsx";

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: vi.fn(),
}));

type Registration = ReturnType<typeof useRegisterSW>;
const registerSW = vi.mocked(useRegisterSW);
const updateServiceWorker = vi.fn<Registration["updateServiceWorker"]>();

function registration(needRefresh: boolean): Registration {
  return {
    needRefresh: [needRefresh, vi.fn<Registration["needRefresh"][1]>()],
    offlineReady: [false, vi.fn<Registration["offlineReady"][1]>()],
    updateServiceWorker,
  };
}

beforeEach(() => {
  registerSW.mockReset().mockReturnValue(registration(false));
  updateServiceWorker.mockReset().mockResolvedValue(undefined);
});

describe("UpdatePrompt", () => {
  it("renders nothing while no update is waiting", () => {
    const { container } = render(<UpdatePrompt />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it("announces a waiting update and exposes the refresh action", () => {
    registerSW.mockReturnValue(registration(true));
    render(<UpdatePrompt />);

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("alert")).toHaveTextContent("Neue Version verfuegbar.");
    expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeEnabled();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it("updates the service worker with reload requested after clicking refresh", () => {
    registerSW.mockReturnValue(registration(true));
    render(<UpdatePrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Aktualisieren" }));

    expect(updateServiceWorker).toHaveBeenCalledExactlyOnceWith(true);
  });
});
