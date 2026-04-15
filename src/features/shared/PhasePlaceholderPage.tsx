import { EmptyState } from "@/components/feedback/EmptyState.tsx";
import { PageHeader } from "@/components/layout/PageHeader.tsx";

interface PhasePlaceholderPageProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyMessage: string;
}

export function PhasePlaceholderPage({
  title,
  description,
  emptyTitle,
  emptyMessage,
}: PhasePlaceholderPageProps) {
  return (
    <div className="page-stack">
      <PageHeader title={title} description={description} />
      <EmptyState title={emptyTitle} message={emptyMessage} />
    </div>
  );
}
