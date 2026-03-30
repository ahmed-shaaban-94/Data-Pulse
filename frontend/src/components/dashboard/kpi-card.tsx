import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  trend?: number | null;
  trendLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  accentGradient?: string;
}

export function KPICard({ label, value, trend, trendLabel, icon: Icon, className, accentGradient }: KPICardProps) {
  const isPositive = trend !== null && trend !== undefined && trend > 0;
  const isNegative = trend !== null && trend !== undefined && trend < 0;

  const trendColor = isPositive
    ? "text-growth-green"
    : isNegative
      ? "text-growth-red"
      : "text-text-secondary";

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  const pillBg = isPositive
    ? "bg-growth-green/10 text-growth-green"
    : isNegative
      ? "bg-growth-red/10 text-growth-red"
      : "bg-text-secondary/10 text-text-secondary";

  const defaultGradient = isPositive
    ? "from-growth-green/20 to-transparent"
    : isNegative
      ? "from-growth-red/20 to-transparent"
      : "from-accent/20 to-transparent";

  const gradient = accentGradient || defaultGradient;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5",
        "transition-all duration-300 hover:scale-[1.03] hover:shadow-lg",
        "hover:border-accent/40 hover:shadow-accent/5",
        className,
      )}
    >
      {/* Gradient accent strip at top */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
        isPositive ? "from-growth-green to-growth-green/50" :
        isNegative ? "from-growth-red to-growth-red/50" :
        "from-accent to-accent/50"
      )} />

      {/* Background glow on hover */}
      <div className={cn(
        "absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
        gradient,
      )} />

      <div className="relative flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </p>
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 transition-all duration-300 group-hover:bg-accent/20 group-hover:scale-110">
            <Icon className="h-5 w-5 text-accent" />
          </div>
        )}
      </div>

      <p className="relative mt-3 text-3xl font-bold tracking-tight text-text-primary">
        {value}
      </p>

      {trend !== undefined && (
        <div className="relative mt-3 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              "transition-all duration-300 group-hover:scale-105",
              pillBg,
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {trend !== null ? `${isPositive ? "+" : ""}${trend.toFixed(1)}%` : "N/A"}
          </span>
          {trendLabel && (
            <span className="text-xs text-text-secondary">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
