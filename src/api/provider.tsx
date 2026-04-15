import { createContext, useContext, useState, type ReactNode } from "react";
import type { AppApi } from "./contracts/index.ts";
import { createMockAppApi } from "./mock/index.ts";
import { createTsAppApi } from "./ts/index.ts";

const AppApiContext = createContext<AppApi | null>(null);

interface AppApiProviderProps {
  children: ReactNode;
  api?: AppApi;
}

function resolveApiMode(): "mock" | "live" {
  const envMode = (import.meta.env as Record<string, unknown>)["VITE_APP_API_MODE"];
  if (envMode === "mock" || envMode === "live") {
    return envMode;
  }
  const params = new URLSearchParams(window.location.search);
  const queryMode = params.get("api");
  if (queryMode === "mock" || queryMode === "live") {
    return queryMode;
  }
  return "live";
}

export function AppApiProvider({ children, api }: AppApiProviderProps) {
  const [stableApi] = useState<AppApi>(() => {
    if (api) {
      return api;
    }
    return resolveApiMode() === "mock" ? createMockAppApi() : createTsAppApi();
  });
  return <AppApiContext.Provider value={stableApi}>{children}</AppApiContext.Provider>;
}

export function useAppApi(): AppApi {
  const value = useContext(AppApiContext);
  if (!value) {
    throw new Error("useAppApi must be used within AppApiProvider.");
  }
  return value;
}
