import { createHashRouter, RouterProvider } from "react-router-dom";
import { App } from "./App.tsx";

const router = createHashRouter([
  {
    path: "*",
    element: <App />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
