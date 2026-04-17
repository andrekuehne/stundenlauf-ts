import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { AppShell } from "@/components/layout/AppShell.tsx";
import { ContentSplitLayout } from "@/components/layout/ContentSplitLayout.tsx";
vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...mod,
    NavLink: ({ to, className, children }: { to: string; className: ({ isActive }: { isActive: boolean }) => string; children: ReactNode }) => (
      <a href={to} className={className({ isActive: to === "/season" })}>
        {children}
      </a>
    ),
  };
});

describe("shared UI components", () => {
  it("renders DataTable empty state and aligned cells", () => {
    const columns: DataTableColumn<{ name: string }>[] = [
      { key: "name", header: "Name", cell: (row) => row.name, align: "right" },
    ];
    const { rerender } = render(<DataTable columns={columns} rows={[]} emptyMessage="Leer" />);
    expect(screen.getByText("Leer")).toBeInTheDocument();

    rerender(<DataTable columns={columns} rows={[{ name: "Anna" }]} rowKey={(row) => row.name} />);
    expect(screen.getByText("Anna")).toBeInTheDocument();
    expect(screen.getByText("Name").className).toContain("ui-table__cell--right");
  });

  it("renders AppShell main child and sidebar without global season combobox", () => {
    render(
      <AppShell
        activeRoute="season"
        shellData={{
          selectedSeasonId: "s1",
          selectedSeasonLabel: "S1",
          unresolvedReviews: 3,
          availableSeasons: [{ seasonId: "s1", label: "S1" }, { seasonId: "s2", label: "S2" }],
        }}
      >
        <div>Child</div>
      </AppShell>,
    );

    expect(screen.getByText("Child")).toBeInTheDocument();
    expect(screen.queryByText("Offene Prüfungen:")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows the app title in the sidebar above Bereiche", () => {
    render(
      <AppShell
        activeRoute="season"
        shellData={{
          selectedSeasonId: "s1",
          selectedSeasonLabel: "S1",
          unresolvedReviews: 0,
          availableSeasons: [{ seasonId: "s1", label: "S1" }],
        }}
      >
        <div>Child</div>
      </AppShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Stundenlauf-Auswertung" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Bereiche" })).toBeInTheDocument();
  });

  it("styles the sidebar app title for the narrow rail", () => {
    const { container } = render(
      <AppShell
        activeRoute="season"
        shellData={{
          selectedSeasonId: "s1",
          selectedSeasonLabel: "S1",
          unresolvedReviews: 0,
          availableSeasons: [{ seasonId: "s1", label: "S1" }],
        }}
      >
        <div>Child</div>
      </AppShell>,
    );

    const title = container.querySelector(".shell-sidebar__app-title");
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe("Stundenlauf-Auswertung");
  });

  it("renders AppShell sidebar navigation with an accent rail on each nav link", () => {
    const { container } = render(
      <AppShell
        activeRoute="season"
        shellData={{
          selectedSeasonId: "s1",
          selectedSeasonLabel: "S1",
          unresolvedReviews: 0,
          availableSeasons: [{ seasonId: "s1", label: "S1" }],
        }}
      >
        <div>Child</div>
      </AppShell>,
    );

    const navLinks = container.querySelectorAll(".shell-nav-link");
    expect(navLinks.length).toBeGreaterThan(0);
    navLinks.forEach((link) => {
      const rail = link.querySelector(".shell-nav-link__rail");
      expect(rail).not.toBeNull();
    });
  });

  it("passes side max width through css variable", () => {
    const { container } = render(
      <ContentSplitLayout main={<div>Main</div>} side={<div>Side</div>} sideMaxWidth={420} />,
    );

    const grid = container.querySelector(".content-split-layout__grid");
    expect(grid).not.toBeNull();
    expect(grid).toHaveStyle("--content-split-side-max-width: 420px");
  });
});
