import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { AppShell } from "@/components/layout/AppShell.tsx";
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

  it("renders AppShell default hint and season change callback", () => {
    const onSeasonChange = vi.fn();
    render(
      <AppShell
        activeRoute="season"
        shellData={{
          selectedSeasonId: "s1",
          selectedSeasonLabel: "S1",
          unresolvedReviews: 3,
          availableSeasons: [{ seasonId: "s1", label: "S1" }, { seasonId: "s2", label: "S2" }],
        }}
        onSeasonChange={onSeasonChange}
      >
        <div>Child</div>
      </AppShell>,
    );

    expect(screen.getByText("Child")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "s2" } });
    expect(onSeasonChange).toHaveBeenCalledWith("s2");
  });
});
