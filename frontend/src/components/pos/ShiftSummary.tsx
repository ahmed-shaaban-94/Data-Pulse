"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShiftSummaryResponse } from "@/types/pos";

interface ShiftSummaryProps {
  shiftData: ShiftSummaryResponse;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function VarianceIndicator({ variance }: { variance: number | null }) {
  if (variance === null) return <Minus className="h-4 w-4 text-text-secondary" />;
  if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (variance < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-text-secondary" />;
}

export function ShiftSummary({ shiftData }: ShiftSummaryProps) {
  const variance = shiftData.variance;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-secondary">Shift Date</p>
            <p className="text-sm font-semibold text-text-primary">{shiftData.shift_date}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary">Cashier</p>
            <p className="text-sm font-semibold text-text-primary">{shiftData.staff_id}</p>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-text-secondary">
          <span>Opened: {new Date(shiftData.opened_at).toLocaleTimeString()}</span>
          {shiftData.closed_at && (
            <span>Closed: {new Date(shiftData.closed_at).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-text-secondary">Total Sales</p>
          <p className="mt-1 text-base font-bold tabular-nums text-accent">
            EGP {fmt(shiftData.total_sales)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-text-secondary">Transactions</p>
          <p className="mt-1 text-base font-bold text-text-primary">
            {shiftData.total_transactions}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-text-secondary">Returns</p>
          <p className="mt-1 text-base font-bold text-text-primary">{shiftData.total_returns}</p>
        </div>
        <div
          className={cn(
            "rounded-xl border bg-surface p-3",
            variance === null
              ? "border-border"
              : variance > 0
                ? "border-green-500/30"
                : variance < 0
                  ? "border-destructive/30"
                  : "border-border",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">Cash Variance</p>
            <VarianceIndicator variance={variance} />
          </div>
          <p
            className={cn(
              "mt-1 text-base font-bold tabular-nums",
              variance === null
                ? "text-text-primary"
                : variance > 0
                  ? "text-green-400"
                  : variance < 0
                    ? "text-destructive"
                    : "text-text-primary",
            )}
          >
            {variance !== null ? `EGP ${fmt(Math.abs(variance))}` : "—"}
          </p>
        </div>
      </div>

      {/* Cash reconciliation */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Cash Reconciliation
        </p>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Opening Cash</span>
          <span className="tabular-nums text-text-primary">EGP {fmt(shiftData.opening_cash)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Expected</span>
          <span className="tabular-nums text-text-primary">EGP {fmt(shiftData.expected_cash)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Closing Count</span>
          <span className="tabular-nums text-text-primary">EGP {fmt(shiftData.closing_cash)}</span>
        </div>
      </div>
    </div>
  );
}
