"use client";

import React from "react";
import dynamic from "next/dynamic";
import { LoadingCard } from "@/components/loading-card";

// Lazy-load dashboard components to keep bundle size manageable
const load = <P extends object>(
  loader: () => Promise<React.ComponentType<P>>,
  lines = 4,
) => dynamic(loader, { loading: () => <LoadingCard lines={lines} /> });

const KPIGrid = load(() => import("@/components/dashboard/kpi-grid").then(m => m.KPIGrid), 2);
const TrendKPICards = load(() => import("@/components/dashboard/trend-kpi-cards").then(m => m.TrendKPICards), 2);
const DailyTrendChart = load(() => import("@/components/dashboard/daily-trend-chart").then(m => m.DailyTrendChart));
const MonthlyTrendChart = load(() => import("@/components/dashboard/monthly-trend-chart").then(m => m.MonthlyTrendChart));
const BillingBreakdownChart = load(() => import("@/components/dashboard/billing-breakdown-chart").then(m => m.BillingBreakdownChart));
const CustomerTypeChart = load(() => import("@/components/dashboard/customer-type-chart").then(m => m.CustomerTypeChart));
const CalendarHeatmap = load(() => import("@/components/dashboard/calendar-heatmap").then(m => m.CalendarHeatmap));
const WaterfallChart = load<object>(() => import("@/components/dashboard/waterfall-chart").then(m => m.WaterfallChart as React.ComponentType));
const QuickRankings = load(() => import("@/components/dashboard/quick-rankings").then(m => m.QuickRankings), 6);
const ForecastCard = load(() => import("@/components/dashboard/forecast-card").then(m => m.ForecastCard));
const TargetProgress = load(() => import("@/components/dashboard/target-progress").then(m => m.TargetProgress), 3);
const TopMoversCard = load(() => import("@/components/dashboard/top-movers-card").then(m => m.TopMoversCard));
const NarrativeSummaryCard = load(() => import("@/components/dashboard/narrative-summary-card").then(m => m.NarrativeSummaryCard), 3);

interface WidgetRendererProps {
  widgetKey: string;
}

export function WidgetRenderer({ widgetKey }: WidgetRendererProps) {
  switch (widgetKey) {
    case "kpi-grid":
      return <KPIGrid />;
    case "trend-kpis":
      return <TrendKPICards />;
    case "daily-trend":
      return <DailyTrendChart />;
    case "monthly-trend":
      return <MonthlyTrendChart />;
    case "billing-breakdown":
      return <BillingBreakdownChart />;
    case "customer-type":
      return <CustomerTypeChart />;
    case "calendar-heatmap":
      return <CalendarHeatmap />;
    case "waterfall":
      return <WaterfallChart />;
    case "top-products":
    case "top-customers":
    case "top-staff":
      return <QuickRankings />;
    case "forecast":
      return <ForecastCard />;
    case "target-progress":
      return <TargetProgress />;
    case "top-movers":
      return <TopMoversCard />;
    case "narrative":
      return <NarrativeSummaryCard />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-sm text-text-secondary">
          Unknown widget: {widgetKey}
        </div>
      );
  }
}
