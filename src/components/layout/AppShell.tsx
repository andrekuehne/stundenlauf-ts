import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { AppRoute } from "@/app/routes.ts";
import { STR } from "@/app/strings.ts";
import type { ShellData } from "@/api/contracts/index.ts";

type NavigationAttempt = { type: "route"; route: AppRoute };

interface AppShellProps {
  activeRoute: AppRoute;
  shellData: ShellData;
  onNavigationAttempt?: (attempt: NavigationAttempt) => boolean;
  sidebarControls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

const NAV_ITEMS: AppRoute[] = ["season", "standings", "import", "corrections", "history"];

export function AppShell({
  activeRoute,
  shellData,
  onNavigationAttempt,
  sidebarControls,
  children,
  footer,
}: AppShellProps) {
  const showSidebarControls = Boolean(sidebarControls);

  return (
    <div className="shell-layout">
      <div className="shell-body">
        <aside className="shell-sidebar">
          <div className="shell-sidebar__nav">
            <h1 className="shell-sidebar__app-title">{STR.shell.appTitle}</h1>
            <h2>{STR.shell.sectionsTitle}</h2>
            <nav>
              {NAV_ITEMS.map((route) => (
                <NavLink
                  key={route}
                  to={`/${route}`}
                  onClick={(event) => {
                    if (!onNavigationAttempt) {
                      return;
                    }
                    const allowed = onNavigationAttempt({ type: "route", route });
                    if (!allowed) {
                      event.preventDefault();
                    }
                  }}
                  className={({ isActive }) =>
                    `shell-nav-link ${isActive ? "is-active" : ""} ${route === "standings" && !shellData.selectedSeasonId ? "is-disabled" : ""}`
                  }
                >
                  <span className="shell-nav-link__rail" aria-hidden="true" />
                  <span className="shell-nav-link__label">{STR.shell.tabs[route]}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          {showSidebarControls ? (
            <div className="shell-sidebar__controls">
              <h3>{STR.shell.tabs[activeRoute]}</h3>
              {sidebarControls}
            </div>
          ) : null}
        </aside>

        <main className="shell-main">{children}</main>
      </div>

      {footer ? <footer className="status-bar">{footer}</footer> : null}
    </div>
  );
}
