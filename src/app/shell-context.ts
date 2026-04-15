import { useOutletContext } from "react-router-dom";
import type { ShellData } from "@/api/contracts/index.ts";

export interface AppShellContextValue {
  shellData: ShellData;
  refreshShellData: () => Promise<void>;
}

export function useAppShellContext() {
  return useOutletContext<AppShellContextValue>();
}
