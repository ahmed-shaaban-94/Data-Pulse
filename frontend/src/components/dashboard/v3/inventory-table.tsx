"use client";

import { cn } from "@/lib/utils";
import { useReorderWatchlist } from "@/hooks/use-reorder-watchlist";
import type { ReorderAlertItem } from "@/types/api";

/** Reorder watchlist widget — live `/inventory/alerts/reorder` (issue #507). */
export function InventoryTable() {
  const { data, error, isLoading } = useReorderWatchlist(null, 8);

  return (
    <section
      aria-label="Reorder watchlist"
      className="rounded-card border border-border/40 bg-card p-6"
    >
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-[15px] font-semibold text-text-primary">
          Inventory — reorder watchlist
        </h3>
        <span className="font-mono text-[11px] text-text-tertiary">
          sorted by gap to reorder point
        </span>
      </header>

      {isLoading ? <SkeletonTable /> : null}
      {!isLoading && error ? (
        <p className="py-6 text-sm text-text-tertiary">
          Unable to load inventory watchlist.
        </p>
      ) : null}
      {!isLoading && !error && (!data || data.length === 0) ? (
        <p className="py-6 text-sm text-text-tertiary">
          All stock levels are above reorder points. Nothing to reorder right now.
        </p>
      ) : null}
      {!isLoading && !error && data && data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="py-2 text-left font-medium">Product</th>
                <th className="py-2 text-left font-medium">SKU</th>
                <th className="py-2 text-right font-medium">On-hand</th>
                <th className="py-2 text-right font-medium">Days of stock</th>
                <th className="py-2 text-right font-medium">Velocity</th>
                <th className="py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <InventoryRow key={`${row.drug_code}-${row.site_code}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

const STATUS_PILL: Record<ReorderAlertItem["status"], string> = {
  critical: "bg-growth-red/15 text-growth-red",
  low: "bg-chart-amber/15 text-chart-amber",
  healthy: "bg-growth-green/15 text-growth-green",
};

const DOS_TONE: Record<ReorderAlertItem["status"], string> = {
  critical: "text-growth-red",
  low: "text-chart-amber",
  healthy: "text-growth-green",
};

const STATUS_LABEL: Record<ReorderAlertItem["status"], string> = {
  critical: "Critical",
  low: "Low",
  healthy: "Healthy",
};

function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function InventoryRow({ row }: { row: ReorderAlertItem }) {
  return (
    <tr className="border-t border-border/30">
      <td className="py-3 font-medium text-text-primary">{row.drug_name}</td>
      <td className="py-3 font-mono text-text-tertiary">{row.drug_code}</td>
      <td className="py-3 text-right tabular-nums text-text-primary">
        {formatNumber(row.current_quantity)}
      </td>
      <td
        className={cn(
          "py-3 text-right font-semibold tabular-nums",
          DOS_TONE[row.status],
        )}
      >
        {row.days_of_stock != null ? `${row.days_of_stock}d` : "—"}
      </td>
      <td className="py-3 text-right tabular-nums text-text-secondary">
        {formatNumber(row.daily_velocity, 1)} / day
      </td>
      <td className="py-3">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            STATUS_PILL[row.status],
          )}
        >
          {STATUS_LABEL[row.status]}
        </span>
      </td>
    </tr>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-2 py-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-8 w-full animate-pulse rounded bg-card/60" />
      ))}
    </div>
  );
}
