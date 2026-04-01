import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
}

interface SummaryStatsProps {
  stats: StatItem[];
  className?: string;
}

export function SummaryStats({ stats, className }: SummaryStatsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 md:grid-cols-4", className)}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border bg-card p-4",
              "transition-all duration-300 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5",
            )}
          >
            {/* Subtle top accent line */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent/50 via-accent to-accent/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {stat.label}
              </p>
              {Icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 transition-colors group-hover:bg-accent/15">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
              )}
            </div>
            <p className="mt-2 text-lg font-bold tracking-tight text-text-primary truncate" title={stat.value}>
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
