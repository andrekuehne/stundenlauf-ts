import { STR } from "@/app/strings.ts";
import { PhasePlaceholderPage } from "@/features/shared/PhasePlaceholderPage.tsx";

export function CorrectionsPage() {
  return (
    <PhasePlaceholderPage
      title={STR.views.corrections.title}
      description={STR.views.corrections.subtitle}
      emptyTitle="Korrekturen folgen spaeter"
      emptyMessage={STR.views.corrections.placeholder}
    />
  );
}
