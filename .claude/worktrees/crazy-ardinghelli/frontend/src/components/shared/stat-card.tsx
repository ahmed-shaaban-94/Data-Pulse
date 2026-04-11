import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  className?: string;
}

export function StatCard({ label, value, className }: StatCardProps) {
  return (
    <div className={cn("glow-card rounded-xl border border-border bg-card p-4", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-text-primary" data-kpi-value>{value}</p>
    </div>
  );
}
