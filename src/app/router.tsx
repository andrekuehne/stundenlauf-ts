import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { CorrectionsPage } from "@/features/corrections/index.ts";
import { HistoryPage } from "@/features/history/index.ts";
import { ImportPage } from "@/features/import/index.ts";
import { SeasonPage } from "@/features/season/index.ts";
import { StandingsPage } from "@/features/standings/index.ts";
import { App } from "./App.tsx";

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
        element: <SeasonPage />,
      },
      {
        path: "standings",
        element: <StandingsPage />,
      },
      {
        path: "import",
        element: <ImportPage />,
      },
      {
        path: "corrections",
        element: <CorrectionsPage />,
      },
      {
        path: "history",
        element: <HistoryPage />,
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
