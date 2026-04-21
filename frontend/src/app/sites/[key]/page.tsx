"use client";

/**
 * /sites/[key] — single site drill-down on the v2 shell.
 */

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  ShoppingBag,
  Users,
  Undo2,
} from "lucide-react";

import { useSiteDetail } from "@/hooks/use-site-detail";
import { DashboardShell } from "@/components/dashboard-v2/shell";
import { KpiCard, type KpiColor, type KpiDir } from "@/components/dashboard/new";
import { SiteDetailView } from "@/components/sites/site-detail-view";
import { LoadingCard } from "@/components/loading-card";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { TimeSeriesPoint } from "@/types/api";

function toSparkline(points: TimeSeriesPoint[] | undefined): number[] {
  if (!points?.length) return [];
  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(...values, 1);
  return values.map((v) => 32 - (v / max) * 28);
}

export default function SiteDetailPage() {
  const params = useParams<{ key: string }>();
  const siteKey = parseInt(params.key, 10);
  const { data, isLoading, error } = useSiteDetail(isNaN(siteKey) ? null : siteKey);

  const kpis = useMemo(() => {
    if (!data) return null;
    const sparkline = toSparkline(data.monthly_trend);
    const returnDir: KpiDir = (data.return_rate ?? 0) < 0.05 ? "up" : "down";

    return [
      {
        id: "net",
        label: "Net Revenue",
        value: formatCurrency(data.total_net_amount),
        delta: { dir: "up" as KpiDir, text: `${formatNumber(data.transaction_count)} tx` },
        sub: "branch lifetime net sales",
        color: "accent" as KpiColor,
        sparkline,
        icon: Banknote,
      },
      {
        id: "transactions",
        label: "Transactions",
        value: formatNumber(data.transaction_count),
        delta: { dir: "up" as KpiDir, text: formatNumber(data.unique_customers) + " customers" },
        sub: "at this branch",
        color: "purple" as KpiColor,
        sparkline: [] as number[],
        icon: ShoppingBag,
      },
      {
        id: "insurance",
        label: "Insurance Mix",
        value: formatPercent(data.insurance_ratio),
        delta: { dir: "up" as KpiDir, text: `${formatPercent(data.walk_in_ratio)} walk-in` },
        sub: "insurance share vs walk-in",
        color: "amber" as KpiColor,
        sparkline: [] as number[],
        icon: Users,
      },
      {
        id: "return-rate",
        label: "Return Rate",
        value: formatPercent(data.return_rate),
        delta: { dir: returnDir, text: returnDir === "up" ? "healthy" : "watch" },
        sub: "branch return ratio",
        color: "red" as KpiColor,
        sparkline: [] as number[],
        icon: Undo2,
      },
    ];
  }, [data]);

  return (
    <DashboardShell
      activeHref="/sites"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Operations" },
        { label: "Sites", href: "/sites" },
        { label: data?.site_name ?? "Detail" },
      ]}
    >
      <div className="page">
        {isNaN(siteKey) ? (
          <EmptyState title="Invalid site key" />
        ) : isLoading ? (
          <LoadingCard lines={10} className="h-96" />
        ) : error || !data ? (
          <EmptyState title="Site not found" />
        ) : (
          <>
            <div>
              <h1 className="page-title">{data.site_name}</h1>
              {data.area_manager && (
                <p className="page-sub">Area Manager: {data.area_manager}</p>
              )}
            </div>

            <section
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Site detail KPIs"
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

            <SiteDetailView site={data} />

            <Link
              href="/sites"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sites
            </Link>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
