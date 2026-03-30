import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "No data available",
  description = "Try adjusting your filters or check back later.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border border-dashed bg-card/50 p-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
        <Inbox className="h-8 w-8 text-accent/60" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-1.5 max-w-sm text-center text-sm text-text-secondary">{description}</p>
    </div>
  );
}
