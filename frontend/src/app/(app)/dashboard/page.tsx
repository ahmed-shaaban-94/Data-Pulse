import { Header } from "@/components/layout/header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageTransition } from "@/components/layout/page-transition";
import { KPIGrid } from "@/components/dashboard/kpi-grid";
import { DailyTrendChart } from "@/components/dashboard/daily-trend-chart";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { QuickRankings } from "@/components/dashboard/quick-rankings";
import { FilterBar } from "@/components/filters/filter-bar";

export default function DashboardPage() {
  return (
    <PageTransition>
      <div>
        <Breadcrumbs />
        <Header
          title="Executive Overview"
          description="Sales performance at a glance"
        />
        <FilterBar />
        <KPIGrid />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <DailyTrendChart />
          <MonthlyTrendChart />
        </div>
        <div className="mt-6">
          <QuickRankings />
        </div>
      </div>
    </PageTransition>
  );
}
