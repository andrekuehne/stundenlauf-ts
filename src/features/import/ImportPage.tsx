import { STR } from "@/app/strings.ts";
import { PhasePlaceholderPage } from "@/features/shared/PhasePlaceholderPage.tsx";

export function ImportPage() {
  return (
    <PhasePlaceholderPage
      title={STR.views.import.title}
      description={STR.views.import.subtitle}
      emptyTitle="Import folgt in Phase 2"
      emptyMessage="Der gefuehrte Import- und Matching-Ablauf wird im naechsten Migrationsschritt in diese Route verlagert."
    />
  );
}
