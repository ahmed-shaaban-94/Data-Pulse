"use client";

/** /audit — API request + user action log on the v2 shell. */

import { DashboardShell } from "@/components/dashboard-v2/shell";
import { AuditLogOverview } from "@/components/audit/audit-log-overview";

export default function AuditPage() {
  return (
    <DashboardShell
      activeHref="/audit"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Monitoring" },
        { label: "Audit Log" },
      ]}
    >
      <div className="page">
        <div>
          <h1 className="page-title">Audit log.</h1>
          <p className="page-sub">Track all API requests and user actions across the tenant.</p>
        </div>

        <AuditLogOverview />
      </div>
    </DashboardShell>
  );
}
