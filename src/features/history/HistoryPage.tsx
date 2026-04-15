import { STR } from "@/app/strings.ts";
import { PhasePlaceholderPage } from "@/features/shared/PhasePlaceholderPage.tsx";

export function HistoryPage() {
  return (
    <PhasePlaceholderPage
      title={STR.views.history.title}
      description={STR.views.history.subtitle}
      emptyTitle="Historie folgt spaeter"
      emptyMessage="Die Timeline- und Audit-Ansichten werden in Phase 3 in diese Route uebernommen."
    />
  );
}
