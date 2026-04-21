"use client";

import { DashboardShell } from "@/components/dashboard-v2/shell";
import { ScheduleOverview } from "@/components/reports/schedule-overview";

export default function SchedulesPage() {
  return (
    <DashboardShell
      activeHref="/reports/schedules"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Reports", href: "/reports" },
        { label: "Schedules" },
      ]}
    >
      <div className="page">
        <div>
          <h1 className="page-title">Report schedules.</h1>
          <p className="page-sub">Manage automated PDF report delivery.</p>
        </div>
        <ScheduleOverview />
      </div>
    </DashboardShell>
  );
}
