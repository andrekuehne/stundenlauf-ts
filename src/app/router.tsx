import { lazy, Suspense, type ReactNode } from "react";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { App } from "./App.tsx";

const SeasonPage = lazy(async () => ({ default: (await import("@/features/season/index.ts")).SeasonPage }));
const StandingsPage = lazy(async () => ({
  default: (await import("@/features/standings/index.ts")).StandingsPage,
}));
const ImportPage = lazy(async () => ({ default: (await import("@/features/import/index.ts")).ImportPage }));
const CorrectionsPage = lazy(async () => ({
  default: (await import("@/features/corrections/index.ts")).CorrectionsPage,
}));
const HistoryPage = lazy(async () => ({ default: (await import("@/features/history/index.ts")).HistoryPage }));

function routeElement(element: ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/season" replace />,
      },
      {
        path: "season",
        element: routeElement(<SeasonPage />),
      },
      {
        path: "standings",
        element: routeElement(<StandingsPage />),
      },
      {
        path: "import",
        element: routeElement(<ImportPage />),
      },
      {
        path: "corrections",
        element: routeElement(<CorrectionsPage />),
      },
      {
        path: "history",
        element: routeElement(<HistoryPage />),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/season" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
