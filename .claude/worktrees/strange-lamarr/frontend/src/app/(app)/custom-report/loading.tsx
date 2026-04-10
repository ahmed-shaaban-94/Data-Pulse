import { LoadingCard } from "@/components/loading-card";

export default function CustomReportLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-divider" />
      <div className="h-4 w-96 animate-pulse rounded-lg bg-divider" />
      {/* Template cards skeleton */}
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 w-[130px] flex-shrink-0 animate-pulse rounded-xl bg-divider"
          />
        ))}
      </div>
      {/* Config panel skeleton */}
      <LoadingCard />
      <LoadingCard />
    </div>
  );
}
