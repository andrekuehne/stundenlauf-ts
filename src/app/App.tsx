import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { ShellData } from "@/api/contracts/index.ts";
import { AppApiProvider, useAppApi } from "@/api/provider.tsx";
import { isAppRoute, type AppRoute } from "@/app/routes.ts";
import type { NavigationGuardConfig } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { UpdatePrompt } from "@/components/feedback/UpdatePrompt.tsx";
import { AppShell } from "@/components/layout/AppShell.tsx";
import { useStatusStore } from "@/stores/status.ts";
import { APP_VERSION } from "@/version.ts";

const ImportOrchestrationHarness = lazy(async () => ({
  default: (await import("@/devtools/ImportOrchestrationHarness.tsx")).ImportOrchestrationHarness,
}));
const ImportSeasonWalkthroughHarness = lazy(async () => ({
  default: (await import("@/devtools/ImportSeasonWalkthroughHarness.tsx")).ImportSeasonWalkthroughHarness,
}));
const LegacyLayoutParityPage = lazy(async () => ({
  default: (await import("@/devtools/LegacyLayoutParityPage.tsx")).LegacyLayoutParityPage,
}));

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
    return (
      <Suspense fallback={null}>
        <ImportSeasonWalkthroughHarness />
      </Suspense>
    );
  }
  if (showImportHarness) {
    return (
      <Suspense fallback={null}>
        <ImportOrchestrationHarness />
      </Suspense>
    );
  }
  if (showLegacyLayoutHarness) {
    return (
      <Suspense fallback={null}>
        <LegacyLayoutParityPage />
      </Suspense>
    );
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
  const navigate = useNavigate();
  const setStatus = useStatusStore((state) => state.setStatus);
  const currentStatus = useStatusStore((state) => state.current);
  const [shellData, setShellData] = useState<ShellData>(EMPTY_SHELL_DATA);
  const [navigationGuard, setNavigationGuard] = useState<NavigationGuardConfig | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{ type: "route"; route: AppRoute } | null>(null);
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

  const requestNavigation = useCallback(
    (attempt: { type: "route"; route: AppRoute }) => {
      if (!navigationGuard) {
        return true;
      }
      setPendingNavigation(attempt);
      return false;
    },
    [navigationGuard],
  );

  function confirmPendingNavigation() {
    const pending = pendingNavigation;
    if (!pending) {
      return;
    }
    setPendingNavigation(null);
    void navigate(`/${pending.route}`);
  }

  useLayoutEffect(() => {
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
        onNavigationAttempt={requestNavigation}
        footer={footer}
        sidebarControls={sidebarControls}
      >
        {error ? (
          <div className="page-stack">
            <EmptyState title={STR.app.errorTitle} message={error} />
          </div>
        ) : (
          <Outlet context={{ shellData, refreshShellData, setSidebarControls, setNavigationGuard }} />
        )}
      </AppShell>
      <div className="version-badge" title={`Version ${APP_VERSION}`}>
        {APP_VERSION}
      </div>
      {pendingNavigation ? (
        <div className="confirm-modal__backdrop" role="presentation">
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={STR.views.import.leaveInProgressTitle}
          >
            <div className="confirm-modal__header">
              <h2>{STR.views.import.leaveInProgressTitle}</h2>
            </div>
            <div className="confirm-modal__body">
              <p>{navigationGuard?.message ?? STR.views.import.leaveInProgressConfirm}</p>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setPendingNavigation(null);
                }}
              >
                {STR.confirmModal.cancel}
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={() => {
                  confirmPendingNavigation();
                }}
              >
                {STR.views.import.leaveInProgressProceed}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <UpdatePrompt />
    </>
  );
}
