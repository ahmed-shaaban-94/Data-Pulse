"use client";

import { DashboardShell } from "@/components/dashboard-v2/shell";
import { DataOpsCommandBar } from "@/components/data-ops/command-bar";
import { UploadOverview } from "@/components/upload/upload-overview";

export default function UploadPage() {
  return (
    <DashboardShell
      activeHref="/upload"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Data Ops" },
        { label: "Import" },
      ]}
    >
      <div className="page">
        <div>
          <h1 className="page-title">Import data.</h1>
          <p className="page-sub">Upload files, validate, and launch the pipeline.</p>
        </div>
        <DataOpsCommandBar />
        <UploadOverview />
      </div>
    </DashboardShell>
  );
}
