"use client";

import { DashboardShell } from "@/components/dashboard-v2/shell";
import { GamificationDashboard } from "@/components/gamification/gamification-dashboard";

export default function GamificationPage() {
  return (
    <DashboardShell
      activeHref="/gamification"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Team" },
        { label: "Gamification" },
      ]}
    >
      <div className="page">
        <div>
          <h1 className="page-title">Gamification.</h1>
          <p className="page-sub">
            Badges, XP, streaks, competitions, and leaderboards for your team.
          </p>
        </div>
        <GamificationDashboard />
      </div>
    </DashboardShell>
  );
}
