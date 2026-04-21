"use client";

/**
 * /customers/[key] — single customer drill-down on the v2 shell.
 *
 * Migrated from `(app)/customers/[key]/page.tsx`. Inherits V2Layout from
 * /customers' layout. StatCard grid swapped for lean KpiCard with
 * monthly_trend sparkline.
 */

import Link from "next/link";
import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  ShoppingBag,
  Package,
  Undo2,
} from "lucide-react";

import { useCustomerDetail } from "@/hooks/use-customer-detail";
import { DashboardShell } from "@/components/dashboard-v2/shell";
import { KpiCard, type KpiColor, type KpiDir } from "@/components/dashboard/new";
import { LoadingCard } from "@/components/loading-card";
import { ErrorRetry } from "@/components/error-retry";
import { EmptyState } from "@/components/empty-state";
import { MiniTrendChart } from "@/components/shared/mini-trend-chart";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import type { TimeSeriesPoint } from "@/types/api";

function toSparkline(points: TimeSeriesPoint[] | undefined): number[] {
  if (!points?.length) return [];
  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(...values, 1);
  return values.map((v) => 32 - (v / max) * 28);
}

export default function CustomerDetailPage() {
  const params = useParams<{ key: string }>();
  const customerKey = Number(params.key);
  if (isNaN(customerKey)) {
    notFound();
  }
  const { data, error, isLoading, mutate } = useCustomerDetail(customerKey);

  const kpis = useMemo(() => {
    if (!data) return null;
    const sparkline = toSparkline(data.monthly_trend);
    const avg = data.transaction_count > 0
      ? data.total_net_amount / data.transaction_count
      : 0;

    return [
      {
        id: "ltv",
        label: "Customer Net Value",
        value: formatCurrency(data.total_net_amount),
        delta: { dir: "up" as KpiDir, text: formatNumber(data.total_quantity) + " units" },
        sub: "lifetime net revenue",
        color: "accent" as KpiColor,
        sparkline,
        icon: Banknote,
      },
      {
        id: "transactions",
        label: "Transactions",
        value: formatNumber(data.transaction_count),
        delta: { dir: "up" as KpiDir, text: `${formatCurrency(avg)} avg` },
        sub: "distinct purchase events",
        color: "purple" as KpiColor,
        sparkline: [] as number[],
        icon: ShoppingBag,
      },
      {
        id: "products",
        label: "Unique Products",
        value: formatNumber(data.unique_products),
        delta: { dir: "up" as KpiDir, text: "variety" },
        sub: "distinct SKUs purchased",
        color: "amber" as KpiColor,
        sparkline: [] as number[],
        icon: Package,
      },
      {
        id: "returns",
        label: "Returns",
        value: formatNumber(data.return_count),
        delta: {
          dir: (data.return_count === 0 ? "up" : "down") as KpiDir,
          text: data.return_count === 0 ? "clean" : "check pattern",
        },
        sub: "return events on record",
        color: "red" as KpiColor,
        sparkline: [] as number[],
        icon: Undo2,
      },
    ];
  }, [data]);

  return (
    <DashboardShell
      activeHref="/customers"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Operations" },
        { label: "Customers", href: "/customers" },
        { label: data?.customer_name ?? "Detail" },
      ]}
    >
      <div className="page">
        {isLoading && !data ? (
          <div className="space-y-6">
            <LoadingCard lines={2} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <LoadingCard key={i} lines={3} className="h-[168px]" />
              ))}
            </div>
          </div>
        ) : error ? (
          <ErrorRetry
            title="Failed to load customer details"
            description={error.message || "An error occurred while fetching customer data."}
            onRetry={() => mutate()}
          />
        ) : !data ? (
          <EmptyState title="Customer not found" description="The requested customer could not be found." />
        ) : (
          <>
            <div>
              <h1 className="page-title">{data.customer_name}</h1>
              <p className="page-sub">ID: {data.customer_id}</p>
            </div>

            <section
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Customer detail KPIs"
            >
              {kpis!.map((k) => (
                <KpiCard
                  key={k.id}
                  label={k.label}
                  value={k.value}
                  delta={k.delta}
                  sub={k.sub}
                  color={k.color}
                  sparkline={k.sparkline}
                  icon={k.icon}
                />
              ))}
            </section>

            {data.monthly_trend && data.monthly_trend.length > 0 && (
              <MiniTrendChart data={data.monthly_trend} title="Monthly Revenue Trend" />
            )}

            <Link
              href="/customers"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Customers
            </Link>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
