import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { App } from "./App.tsx";
import "./theme.css";

const rootEl = document.getElementById("root");
if (rootEl == null) throw new Error("Missing #root element");

const router = createHashRouter([
  {
    path: "*",
    element: <App />,
  },
]);

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
