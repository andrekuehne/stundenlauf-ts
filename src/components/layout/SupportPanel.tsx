import type { ReactNode } from "react";

type SupportPanelProps = {
  children: ReactNode;
};

export function SupportPanel({ children }: SupportPanelProps) {
  return <div className="support-panel">{children}</div>;
}
