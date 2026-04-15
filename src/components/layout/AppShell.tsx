import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { AppRoute } from "@/app/routes.ts";
import { STR } from "@/app/strings.ts";
import type { ShellData } from "@/api/contracts/index.ts";

interface AppShellProps {
  activeRoute: AppRoute;
  shellData: ShellData;
  onSeasonChange: (seasonId: string) => void | Promise<void>;
  children: ReactNode;
  footer?: ReactNode;
}

const NAV_ITEMS: AppRoute[] = ["season", "standings", "import", "corrections", "history"];

const CONTEXT_COPY: Record<AppRoute, { title: string; message: string; href: string; action: string }> = {
  season: {
    title: "Saisonen im Blick behalten",
    message: "Neue Saison anlegen oder eine bestehende Saison fuer die weitere Arbeit oeffnen.",
    href: "/season",
    action: "Zur Saisonverwaltung",
  },
  standings: {
    title: "Wertung pruefen",
    message: "Kategorie waehlen, Tabellenstand kontrollieren und Export vorbereiten.",
    href: "/standings",
    action: "Zur Auswertung",
  },
  import: {
    title: "Import folgt als naechstes",
    message: "Die gefuehrte Importstrecke wird in Phase 2 auf die neue Oberflaeche umgezogen.",
    href: "/season",
    action: "Vorher Saison pruefen",
  },
  corrections: {
    title: "Korrekturen spaeter ausbauen",
    message: "Phase 1 haelt den Navigationsplatz stabil, ohne die echte Korrekturlogik vorzuziehen.",
    href: "/standings",
    action: "Aktuelle Wertung ansehen",
  },
  history: {
    title: "Historie spaeter anbinden",
    message: "Die Timeline folgt in einer spaeteren Phase, bleibt aber jetzt schon als Ziel sichtbar.",
    href: "/standings",
    action: "Zur Auswertung",
  },
};

export function AppShell({ activeRoute, shellData, onSeasonChange, children, footer }: AppShellProps) {
  const contextCopy = CONTEXT_COPY[activeRoute];

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
              <option value="">Keine Saison</option>
              {shellData.availableSeasons.map((season) => (
                <option key={season.seasonId} value={season.seasonId}>
                  {season.label}
                </option>
              ))}
            </select>
          </label>
          <div className="shell-inline-count">
            <span>{STR.shell.reviewLabel}</span>
            <strong>{shellData.unresolvedReviews}</strong>
          </div>
        </div>
      </header>

      <div className="shell-body">
        <aside className="shell-sidebar">
          <div className="shell-sidebar__nav">
            <h2>Bereiche</h2>
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

          <div className="shell-sidebar__context">
            <h3>{STR.shell.contextTitle}</h3>
            <div className="shell-sidebar__context-copy">
              <p className="shell-sidebar__context-title">{contextCopy.title}</p>
              <p>{contextCopy.message}</p>
            </div>
            <NavLink to={contextCopy.href} className="button button--primary shell-sidebar__context-link">
              {contextCopy.action}
            </NavLink>
          </div>
        </aside>

        <main className="shell-main">{children}</main>
      </div>

      {footer ? <footer className="status-bar">{footer}</footer> : null}
    </div>
  );
}
