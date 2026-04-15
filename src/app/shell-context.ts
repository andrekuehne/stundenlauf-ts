import { useOutletContext } from "react-router-dom";
import type { ReactNode } from "react";
import type { ShellData } from "@/api/contracts/index.ts";

export interface AppShellContextValue {
  shellData: ShellData;
  refreshShellData: () => Promise<void>;
  setSidebarControls: (content: ReactNode | null) => void;
}

export function useAppShellContext() {
  return useOutletContext<AppShellContextValue>();
}
