"use client";

import { cn } from "@/lib/utils";
import { useTopBranches } from "@/hooks/use-top-branches";
import type { RankingItem } from "@/types/api";

/** Top branches widget — live `/analytics/sites?include_staff=true` (issue #507). */
export function BranchList() {
  const { data, error, isLoading } = useTopBranches(6);

  return (
    <section
      aria-label="Top branches"
      className="flex min-h-[240px] flex-col gap-3 rounded-card border border-border/40 bg-card p-6"
    >
      <header className="flex items-center gap-3">
        <h3 className="text-[15px] font-semibold text-text-primary">Top branches</h3>
        <span className="font-mono text-[11px] text-text-tertiary">by revenue</span>
      </header>

      {isLoading ? <SkeletonRows /> : null}
      {!isLoading && error ? (
        <p className="text-sm text-text-tertiary">Unable to load branch ranking.</p>
      ) : null}
      {!isLoading && !error && (!data || data.items.length === 0) ? (
        <p className="text-sm text-text-tertiary">
          No branch activity in the selected period.
        </p>
      ) : null}
      {!isLoading && !error && data && data.items.length > 0 ? (
        <ul className="flex flex-col">
          {data.items.map((item) => (
            <BranchRow key={item.key} item={item} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatRevenue(value: number): string {
  if (value >= 1_000_000) return `EGP ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `EGP ${Math.round(value / 1_000)}K`;
  return `EGP ${Math.round(value)}`;
}

function BranchRow({ item }: { item: RankingItem }) {
  const isTop = item.rank === 1;
  const staffText =
    item.staff_count != null ? `${item.staff_count} staff` : "Staff n/a";

  return (
    <li className="flex items-center gap-3 border-t border-border/30 py-2.5 first:border-t-0">
      <div
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg font-mono text-[12px] font-bold tabular-nums",
          isTop
            ? "bg-chart-amber/20 text-chart-amber"
            : "bg-elevated text-text-secondary",
        )}
      >
        {String(item.rank).padStart(2, "0")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-text-primary">
          {item.name}
        </div>
        <div className="truncate text-[11.5px] text-text-tertiary">{staffText}</div>
      </div>
      <div className="tabular-nums text-[13px] font-semibold text-text-primary">
        {formatRevenue(item.value)}
      </div>
      <div className="w-14 text-right text-[12.5px] font-semibold tabular-nums text-text-tertiary">
        {item.pct_of_total.toFixed(1)}%
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 py-1.5">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-elevated/70" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/2 animate-pulse rounded bg-card/70" />
            <div className="h-2 w-1/4 animate-pulse rounded bg-card/50" />
          </div>
        </li>
      ))}
    </ul>
  );
}
