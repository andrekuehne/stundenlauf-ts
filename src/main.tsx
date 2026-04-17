import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRouter } from "./app/router.tsx";
import "./app/theme.css";

const rootEl = document.getElementById("root");
if (rootEl == null) throw new Error("Missing #root element");

createRoot(rootEl).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
