import { cn } from "@/lib/utils";

interface LoadingCardProps {
  className?: string;
  lines?: number;
}

export function LoadingCard({ className, lines = 3 }: LoadingCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6",
        className,
      )}
    >
      <div className="shimmer-line mb-4 h-4 w-1/3 rounded" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="shimmer-line mb-2.5 h-3 rounded"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
