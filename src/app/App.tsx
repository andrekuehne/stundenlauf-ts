import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import type { ShellData } from "@/api/contracts/index.ts";
import { AppApiProvider, useAppApi } from "@/api/provider.tsx";
import { isAppRoute, type AppRoute } from "@/app/routes.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { UpdatePrompt } from "@/components/feedback/UpdatePrompt.tsx";
import { AppShell } from "@/components/layout/AppShell.tsx";
import { ImportOrchestrationHarness } from "@/devtools/ImportOrchestrationHarness.tsx";
import { ImportSeasonWalkthroughHarness } from "@/devtools/ImportSeasonWalkthroughHarness.tsx";
import { LegacyLayoutParityPage } from "@/devtools/LegacyLayoutParityPage.tsx";
import { useStatusStore } from "@/stores/status.ts";
import { APP_VERSION } from "@/version.ts";

function shouldShowImportHarness(): boolean {
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("harness") === "import";
}

function shouldShowImportSeasonHarness(): boolean {
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("harness") === "import-season";
}

function shouldShowLegacyLayoutHarness(): boolean {
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("harness") === "legacy-layout";
}

export function App() {
  const showImportSeasonHarness = shouldShowImportSeasonHarness();
  const showImportHarness = shouldShowImportHarness();
  const showLegacyLayoutHarness = shouldShowLegacyLayoutHarness();

  if (showImportSeasonHarness) {
    return <ImportSeasonWalkthroughHarness />;
  }
  if (showImportHarness) {
    return <ImportOrchestrationHarness />;
  }
  if (showLegacyLayoutHarness) {
    return <LegacyLayoutParityPage />;
  }

  return (
    <AppApiProvider>
      <Phase1App />
    </AppApiProvider>
  );
}

const EMPTY_SHELL_DATA: ShellData = {
  selectedSeasonId: null,
  selectedSeasonLabel: null,
  unresolvedReviews: 0,
  availableSeasons: [],
};

function activeRouteFromPath(pathname: string): AppRoute {
  const candidate = pathname.split("/").filter(Boolean)[0] ?? "season";
  return isAppRoute(candidate) ? candidate : "season";
}

function Phase1App() {
  const api = useAppApi();
  const location = useLocation();
  const setStatus = useStatusStore((state) => state.setStatus);
  const currentStatus = useStatusStore((state) => state.current);
  const [shellData, setShellData] = useState<ShellData>(EMPTY_SHELL_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarControls, setSidebarControls] = useState<ReactNode | null>(null);
  const activeRoute = activeRouteFromPath(location.pathname);

  const refreshShellData = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.getShellData();
      setShellData(next);
      setError(null);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      setStatus({
        severity: "error",
        message,
        source: "app",
      });
    } finally {
      setLoading(false);
    }
  }, [api, setStatus]);

  useEffect(() => {
    void refreshShellData();
  }, [refreshShellData]);

  const handleSeasonChange = useCallback(
    async (seasonId: string) => {
      const selected = shellData.availableSeasons.find((season) => season.seasonId === seasonId);
      await api.openSeason(seasonId);
      await refreshShellData();
      if (selected) {
        setStatus({
          severity: "info",
          message: `Saison "${selected.label}" geoeffnet.`,
          source: "shell",
        });
      }
    },
    [api, refreshShellData, setStatus, shellData.availableSeasons],
  );

  useEffect(() => {
    setSidebarControls(null);
  }, [activeRoute]);

  const footer = useMemo(
    () => (
      <>
        <span className="status-bar__prefix">{STR.status.prefix}</span>
        <span>{currentStatus?.message ?? (loading ? STR.status.appLoading : STR.status.defaultReady)}</span>
      </>
    ),
    [currentStatus?.message, loading],
  );

  return (
    <>
      <AppShell
        activeRoute={activeRoute}
        shellData={shellData}
        onSeasonChange={handleSeasonChange}
        footer={footer}
        sidebarControls={sidebarControls}
      >
        {error ? (
          <div className="page-stack">
            <EmptyState title={STR.app.errorTitle} message={error} />
          </div>
        ) : (
          <Outlet context={{ shellData, refreshShellData, setSidebarControls }} />
        )}
      </AppShell>
      <div className="version-badge" title={`Version ${APP_VERSION}`}>
        {APP_VERSION}
      </div>
      <UpdatePrompt />
    </>
  );
}
