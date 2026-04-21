"use client";

/**
 * /staff/[key] — single staff drill-down on the v2 shell.
 */

import Link from "next/link";
import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import { ArrowLeft, Banknote, ShoppingBag, Receipt, Users } from "lucide-react";

import { useStaffDetail } from "@/hooks/use-staff-detail";
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

export default function StaffDetailPage() {
  const params = useParams<{ key: string }>();
  const staffKey = Number(params.key);
  if (isNaN(staffKey)) {
    notFound();
  }
  const { data, error, isLoading, mutate } = useStaffDetail(staffKey);

  const kpis = useMemo(() => {
    if (!data) return null;
    const sparkline = toSparkline(data.monthly_trend);

    return [
      {
        id: "net",
        label: "Net Revenue",
        value: formatCurrency(data.total_net_amount),
        delta: { dir: "up" as KpiDir, text: `${formatNumber(data.transaction_count)} tx` },
        sub: "lifetime net contribution",
        color: "accent" as KpiColor,
        sparkline,
        icon: Banknote,
      },
      {
        id: "transactions",
        label: "Transactions",
        value: formatNumber(data.transaction_count),
        delta: { dir: "up" as KpiDir, text: "all-time" },
        sub: "rung-up sales count",
        color: "purple" as KpiColor,
        sparkline: [] as number[],
        icon: ShoppingBag,
      },
      {
        id: "avg",
        label: "Avg Transaction",
        value: formatCurrency(data.avg_transaction_value),
        delta: { dir: "up" as KpiDir, text: "basket size" },
        sub: "avg value per transaction",
        color: "amber" as KpiColor,
        sparkline: [] as number[],
        icon: Receipt,
      },
      {
        id: "customers",
        label: "Unique Customers",
        value: formatNumber(data.unique_customers),
        delta: { dir: "up" as KpiDir, text: "served" },
        sub: "distinct buyers attended",
        color: "red" as KpiColor,
        sparkline: [] as number[],
        icon: Users,
      },
    ];
  }, [data]);

  return (
    <DashboardShell
      activeHref="/staff"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Operations" },
        { label: "Staff", href: "/staff" },
        { label: data?.staff_name ?? "Detail" },
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
            title="Failed to load staff details"
            description={error.message || "An error occurred while fetching staff data."}
            onRetry={() => mutate()}
          />
        ) : !data ? (
          <EmptyState title="Staff member not found" description="The requested staff member could not be found." />
        ) : (
          <>
            <div>
              <h1 className="page-title">{data.staff_name}</h1>
              <p className="page-sub">{data.staff_position}</p>
            </div>

            <section
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Staff detail KPIs"
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
              href="/staff"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Staff
            </Link>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
