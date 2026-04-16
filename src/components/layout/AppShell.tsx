import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { AppRoute } from "@/app/routes.ts";
import { STR } from "@/app/strings.ts";
import type { ShellData } from "@/api/contracts/index.ts";

interface AppShellProps {
  activeRoute: AppRoute;
  shellData: ShellData;
  onSeasonChange: (seasonId: string) => void | Promise<void>;
  sidebarControls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

const NAV_ITEMS: AppRoute[] = ["season", "standings", "import", "corrections", "history"];

const DEFAULT_CONTROL_HINT: Record<AppRoute, string> = STR.shell.defaultControlHint;

export function AppShell({ activeRoute, shellData, onSeasonChange, sidebarControls, children, footer }: AppShellProps) {
  const showSidebarControls =
    Boolean(sidebarControls) || (activeRoute !== "season" && activeRoute !== "standings" && activeRoute !== "import");

  return (
    <div className="shell-layout">
      <header className="shell-topbar">
        <div className="shell-topbar__title">
          <h1>{STR.shell.appTitle}</h1>
        </div>
        <div className="shell-topbar__controls">
          <label className="shell-inline-field">
            <span>{STR.shell.seasonSelectLabel}</span>
            <select
              value={shellData.selectedSeasonId ?? ""}
              onChange={(event) => {
                if (event.target.value) {
                  void onSeasonChange(event.target.value);
                }
              }}
            >
              <option value="">{STR.shell.noSeasonOption}</option>
              {shellData.availableSeasons.map((season) => (
                <option key={season.seasonId} value={season.seasonId}>
                  {season.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="shell-body">
        <aside className="shell-sidebar">
          <div className="shell-sidebar__nav">
            <h2>{STR.shell.sectionsTitle}</h2>
            <nav>
              {NAV_ITEMS.map((route) => (
                <NavLink
                  key={route}
                  to={`/${route}`}
                  className={({ isActive }) =>
                    `shell-nav-link ${isActive ? "is-active" : ""} ${route === "standings" && !shellData.selectedSeasonId ? "is-disabled" : ""}`
                  }
                >
                  <span>{STR.shell.tabs[route]}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          {showSidebarControls ? (
            <div className="shell-sidebar__controls">
              <h3>{STR.shell.tabs[activeRoute]}</h3>
              {sidebarControls ? (
                sidebarControls
              ) : (
                <p className="shell-sidebar__controls-hint">{DEFAULT_CONTROL_HINT[activeRoute]}</p>
              )}
            </div>
          ) : null}
        </aside>

        <main className="shell-main">{children}</main>
      </div>

      {footer ? <footer className="status-bar">{footer}</footer> : null}
    </div>
  );
}
