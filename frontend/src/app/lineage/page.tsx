"use client";

import { Info } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-v2/shell";
import { DataOpsCommandBar } from "@/components/data-ops/command-bar";
import { LineageOverview } from "@/components/lineage/lineage-overview";

export default function LineagePage() {
  return (
    <DashboardShell
      activeHref="/lineage"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Data Ops" },
        { label: "Lineage" },
      ]}
    >
      <div className="page">
        <div>
          <h1 className="page-title">Model lineage (admin).</h1>
          <p className="page-sub">
            dbt model dependency graph for debugging and impact analysis.
          </p>
        </div>
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-text-secondary">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <p>
            This is a debug surface for admins. For run-level impact and data
            trust signals, see{" "}
            <a href="/quality" className="font-medium text-accent hover:underline">
              Pipeline Health
            </a>
            .
          </p>
        </div>
        <DataOpsCommandBar />
        <LineageOverview />
      </div>
    </DashboardShell>
  );
}
