import { createContext, useContext, useState, type ReactNode } from "react";
import type { AppApi } from "./contracts/index.ts";
import { createMockAppApi } from "./mock/index.ts";

const AppApiContext = createContext<AppApi | null>(null);

interface AppApiProviderProps {
  children: ReactNode;
  api?: AppApi;
}

export function AppApiProvider({ children, api }: AppApiProviderProps) {
  const [stableApi] = useState<AppApi>(() => api ?? createMockAppApi());
  return <AppApiContext.Provider value={stableApi}>{children}</AppApiContext.Provider>;
}

export function useAppApi(): AppApi {
  const value = useContext(AppApiContext);
  if (!value) {
    throw new Error("useAppApi must be used within AppApiProvider.");
  }
  return value;
}
