"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { usePosHistory } from "@/hooks/use-pos-history";
import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@/types/pos";

const STATUS_COLORS: Record<TransactionStatus, string> = {
  draft: "text-text-secondary bg-surface-raised",
  completed: "text-green-400 bg-green-500/10",
  voided: "text-destructive bg-destructive/10",
  returned: "text-amber-400 bg-amber-500/10",
};

function fmt(n: number): string {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosHistoryPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const limit = 15;

  const { transactions, total, isLoading, isError, mutate } = usePosHistory({ page, limit });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
        <button
          type="button"
          onClick={() => router.push("/terminal")}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-sm font-semibold text-text-primary">Transaction History</span>
        <button
          type="button"
          onClick={() => mutate()}
          aria-label="Refresh"
          className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-raised"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
            Failed to load history
          </div>
        )}

        {isLoading && !transactions.length && (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        )}

        {!isLoading && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <p className="text-sm">No transactions found</p>
          </div>
        )}

        <div className="space-y-2">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              className="rounded-xl border border-border bg-surface p-3 transition-colors hover:border-border/80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums text-text-primary">
                      #{txn.receipt_number ?? txn.id}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        STATUS_COLORS[txn.status],
                      )}
                    >
                      {txn.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {new Date(txn.created_at).toLocaleString()} · {txn.site_code}
                  </p>
                  {txn.customer_id && (
                    <p className="text-xs text-text-secondary">Customer: {txn.customer_id}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-text-primary">
                    EGP {fmt(txn.grand_total)}
                  </p>
                  <p className="text-xs uppercase text-text-secondary">{txn.payment_method}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-text-secondary">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
