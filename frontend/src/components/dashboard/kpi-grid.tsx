"use client";

import { KPICard } from "./kpi-card";
import { LoadingCard } from "@/components/loading-card";
import { useSummary } from "@/hooks/use-summary";
import { useFilters } from "@/contexts/filter-context";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import {
  DollarSign,
  CalendarDays,
  TrendingUp,
  BarChart3,
  Users,
  Target,
  Zap,
} from "lucide-react";

export function KPIGrid() {
  const { filters } = useFilters();
  const { data, isLoading } = useSummary(filters);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <LoadingCard key={i} lines={2} className={`stagger-${i + 1}`} />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7">
      <KPICard
        label="Today Net Sales"
        value={formatCurrency(data.today_net)}
        icon={Zap}
        className="stagger-1 animate-fade-in"
      />
      <KPICard
        label="MTD Net Sales"
        value={formatCurrency(data.mtd_net)}
        icon={CalendarDays}
        className="stagger-2 animate-fade-in"
      />
      <KPICard
        label="YTD Net Sales"
        value={formatCurrency(data.ytd_net)}
        icon={Target}
        className="stagger-3 animate-fade-in"
      />
      <KPICard
        label="MoM Growth"
        value={data.mom_growth_pct !== null ? `${data.mom_growth_pct.toFixed(1)}%` : "N/A"}
        trend={data.mom_growth_pct}
        trendLabel="vs last month"
        icon={TrendingUp}
        className="stagger-4 animate-fade-in"
      />
      <KPICard
        label="YoY Growth"
        value={data.yoy_growth_pct !== null ? `${data.yoy_growth_pct.toFixed(1)}%` : "N/A"}
        trend={data.yoy_growth_pct}
        trendLabel="vs last year"
        icon={BarChart3}
        className="stagger-5 animate-fade-in"
      />
      <KPICard
        label="Daily Transactions"
        value={formatNumber(data.daily_transactions)}
        icon={DollarSign}
        className="stagger-6 animate-fade-in"
      />
      <KPICard
        label="Daily Customers"
        value={formatNumber(data.daily_customers)}
        icon={Users}
        className="stagger-7 animate-fade-in"
      />
    </div>
  );
}
