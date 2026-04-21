"use client";

/**
 * /products/[key] — single product drill-down on the v2 shell.
 *
 * Migrated from `(app)/products/[key]/page.tsx` as part of the
 * Drill-downs batch. Inherits the V2Layout from /products' layout.
 * StatCard grid swapped for lean KpiCard with sparkline.
 */

import Link from "next/link";
import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import { ArrowLeft, Banknote, Wallet, Undo2, Users } from "lucide-react";

import { useProductDetail } from "@/hooks/use-product-detail";
import { DashboardShell } from "@/components/dashboard-v2/shell";
import { KpiCard, type KpiColor, type KpiDir } from "@/components/dashboard/new";
import { LoadingCard } from "@/components/loading-card";
import { ErrorRetry } from "@/components/error-retry";
import { EmptyState } from "@/components/empty-state";
import { MiniTrendChart } from "@/components/shared/mini-trend-chart";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { TimeSeriesPoint } from "@/types/api";

function toSparkline(points: TimeSeriesPoint[] | undefined): number[] {
  if (!points?.length) return [];
  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(...values, 1);
  return values.map((v) => 32 - (v / max) * 28);
}

export default function ProductDetailPage() {
  const params = useParams<{ key: string }>();
  const productKey = Number(params.key);
  if (isNaN(productKey)) {
    notFound();
  }
  const { data, error, isLoading, mutate } = useProductDetail(productKey);

  const kpis = useMemo(() => {
    if (!data) return null;
    const sparkline = toSparkline(data.monthly_trend);
    const returnDir: KpiDir = (data.return_rate ?? 0) < 0.05 ? "up" : "down";

    return [
      {
        id: "sales",
        label: "Total Sales",
        value: formatCurrency(data.total_sales),
        delta: { dir: "up" as KpiDir, text: formatNumber(data.total_quantity) + " units" },
        sub: "gross sales, all periods",
        color: "accent" as KpiColor,
        sparkline,
        icon: Banknote,
      },
      {
        id: "net",
        label: "Net Amount",
        value: formatCurrency(data.total_net_amount),
        delta: { dir: "up" as KpiDir, text: "after returns" },
        sub: "net revenue contribution",
        color: "purple" as KpiColor,
        sparkline: [] as number[],
        icon: Wallet,
      },
      {
        id: "return-rate",
        label: "Return Rate",
        value: formatPercent(data.return_rate),
        delta: {
          dir: returnDir,
          text: returnDir === "up" ? "healthy" : "watch",
        },
        sub: "returned ÷ sold units",
        color: "red" as KpiColor,
        sparkline: [] as number[],
        icon: Undo2,
      },
      {
        id: "customers",
        label: "Unique Customers",
        value: formatNumber(data.unique_customers),
        delta: { dir: "up" as KpiDir, text: "distinct buyers" },
        sub: "bought this SKU",
        color: "amber" as KpiColor,
        sparkline: [] as number[],
        icon: Users,
      },
    ];
  }, [data]);

  return (
    <DashboardShell
      activeHref="/products"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Operations" },
        { label: "Products", href: "/products" },
        { label: data?.drug_name ?? "Detail" },
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
            title="Failed to load product details"
            description={error.message || "An error occurred while fetching product data."}
            onRetry={() => mutate()}
          />
        ) : !data ? (
          <EmptyState title="Product not found" description="The requested product could not be found." />
        ) : (
          <>
            <div>
              <h1 className="page-title">{data.drug_name}</h1>
              <p className="page-sub">
                {data.drug_brand} · {data.drug_category} · code {data.drug_code}
              </p>
            </div>

            <section
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Product detail KPIs"
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
              href="/products"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Products
            </Link>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
