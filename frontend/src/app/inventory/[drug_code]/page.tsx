"use client";

/**
 * /inventory/[drug_code] — drill-down detail page on the v2 focus shell.
 *
 * Focus mode (Wave 3): no sidebar; pulse-bar + back-to-parent + breadcrumb
 * trail. Maximises reading space for the record. Migrated from v1
 * `(app)/inventory/[drug_code]` which manually rolled a back-link.
 */

import useSWR from "swr";
import { useParams } from "next/navigation";

import { FocusShell } from "@/components/dashboard-v2/shell";
import { useFilters } from "@/contexts/filter-context";
import { fetchAPI, swrKey } from "@/lib/api-client";
import { formatDateLabel } from "@/lib/date-utils";
import { formatNumber } from "@/lib/formatters";
import { EmptyState } from "@/components/empty-state";
import { ErrorRetry } from "@/components/error-retry";
import { FilterBar } from "@/components/filters/filter-bar";
import { LoadingCard } from "@/components/loading-card";
import { StockHistoryChart } from "@/components/inventory/stock-history-chart";
import { ReorderConfigForm } from "@/components/inventory/reorder-config-form";
import { StatCard } from "@/components/shared/stat-card";
import { useProductMovements } from "@/hooks/use-product-movements";
import { useProductStock } from "@/hooks/use-product-stock";
import type { BatchInfo } from "@/types/expiry";

export default function ProductInventoryDetailPage() {
  const params = useParams<{ drug_code: string }>();
  const drugCode = params.drug_code;
  const { filters } = useFilters();
  const stock = useProductStock(drugCode, filters);
  const movements = useProductMovements(drugCode, filters);
  const batchesKey = swrKey(`/api/v1/expiry/batches/${drugCode}`, filters);
  const batches = useSWR(drugCode ? batchesKey : null, () =>
    fetchAPI<BatchInfo[]>(`/api/v1/expiry/batches/${drugCode}`, filters),
  );

  const stockRows = stock.data ?? [];
  const totalQuantity = stockRows.reduce((sum, item) => sum + item.current_quantity, 0);
  const totalDispensed = stockRows.reduce((sum, item) => sum + item.total_dispensed, 0);
  const lastMovement = stockRows
    .map((item) => item.last_movement_date)
    .filter((item): item is string => Boolean(item))
    .sort()
    .at(-1);
  const latestMovements = [...(movements.data ?? [])]
    .sort((left, right) => right.movement_date.localeCompare(left.movement_date))
    .slice(0, 8);

  const product = stockRows[0];

  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: "DataPulse", href: "/dashboard" },
    { label: "Operations" },
    { label: "Inventory", href: "/inventory" },
    { label: drugCode ?? "—" },
  ];

  // Loading / error / empty all render inside the focus shell so the
  // back-button + breadcrumbs stay reachable even when data is absent.
  if (stock.isLoading || movements.isLoading || batches.isLoading) {
    return (
      <FocusShell backHref="/inventory" backLabel="Inventory" breadcrumbs={breadcrumbs}>
        <div className="space-y-6">
          <LoadingCard lines={2} />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingCard key={i} lines={2} />
            ))}
          </div>
          <LoadingCard lines={8} className="h-[24rem]" />
        </div>
      </FocusShell>
    );
  }

  if (stock.error || movements.error || batches.error) {
    return (
      <FocusShell backHref="/inventory" backLabel="Inventory" breadcrumbs={breadcrumbs}>
        <ErrorRetry
          title="Failed to load inventory product detail"
          description="The product inventory detail page could not be loaded."
          onRetry={() => {
            void stock.mutate();
            void movements.mutate();
            void batches.mutate();
          }}
        />
      </FocusShell>
    );
  }

  if (!stockRows.length) {
    return (
      <FocusShell backHref="/inventory" backLabel="Inventory" breadcrumbs={breadcrumbs}>
        <EmptyState
          title="Product not found in inventory"
          description="No inventory records were found for this drug code."
        />
      </FocusShell>
    );
  }

  return (
    <FocusShell backHref="/inventory" backLabel="Inventory" breadcrumbs={breadcrumbs}>
      <div>
        <h1 className="page-title">{product.drug_name}</h1>
        <p className="page-sub">
          {product.drug_code} · {product.drug_brand}
        </p>
      </div>

      <FilterBar />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current Stock" value={formatNumber(totalQuantity)} />
        <StatCard label="Sites Covered" value={formatNumber(stockRows.length)} />
        <StatCard label="Total Dispensed" value={formatNumber(totalDispensed)} />
        <StatCard
          label="Last Movement"
          value={lastMovement ? formatDateLabel(lastMovement) : "No activity"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <StockHistoryChart drugCode={drugCode} filters={filters} />
        <ReorderConfigForm drugCode={drugCode} stockLevels={stockRows} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="viz-panel rounded-[1.75rem] p-5">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
              Movement Timeline
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
              {formatNumber(latestMovements.length)} recent movements
            </h3>
          </div>

          {!latestMovements.length ? (
            <EmptyState
              title="No recent movements"
              description="Movement activity for this product will appear here."
            />
          ) : (
            <div className="space-y-3">
              {latestMovements.map((movement) => (
                <div
                  key={movement.movement_key}
                  className="rounded-[1.25rem] border border-border/70 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{movement.movement_type}</p>
                      <p className="text-sm text-text-secondary">
                        {movement.site_code}
                        {movement.batch_number ? ` · Batch ${movement.batch_number}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-text-primary">
                        {formatNumber(movement.quantity)}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {formatDateLabel(movement.movement_date)}
                      </p>
                    </div>
                  </div>
                  {movement.reference && (
                    <p className="mt-2 text-sm text-text-secondary">
                      Reference: {movement.reference}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="viz-panel rounded-[1.75rem] p-5">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
              Batch Inventory
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
              {formatNumber(batches.data?.length ?? 0)} active batches
            </h3>
          </div>

          {!batches.data?.length ? (
            <EmptyState
              title="No active batches"
              description="Batch-level inventory for this product will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-border text-text-secondary">
                  <tr>
                    <th className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.2em]">
                      Batch
                    </th>
                    <th className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.2em]">
                      Site
                    </th>
                    <th className="pb-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em]">
                      Qty
                    </th>
                    <th className="pb-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em]">
                      Days
                    </th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em]">
                      Expiry
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batches.data.map((batch) => (
                    <tr
                      key={`${batch.batch_number}-${batch.site_code}`}
                      className="border-b border-divider/70"
                    >
                      <td className="py-3 pr-4 font-medium text-text-primary">
                        {batch.batch_number}
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">{batch.site_code}</td>
                      <td className="py-3 pr-4 text-right text-text-primary">
                        {formatNumber(batch.current_quantity)}
                      </td>
                      <td className="py-3 pr-4 text-right text-text-primary">
                        {formatNumber(batch.days_to_expiry)}
                      </td>
                      <td className="py-3 text-right text-text-secondary">
                        {formatDateLabel(batch.expiry_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </FocusShell>
  );
}
