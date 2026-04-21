"use client";

import { DashboardShell } from "@/components/dashboard-v2/shell";
import { BrandSettings } from "@/components/branding/brand-settings";

export default function BrandingPage() {
  return (
    <DashboardShell
      activeHref="/branding"
      breadcrumbs={[
        { label: "DataPulse", href: "/dashboard" },
        { label: "Settings" },
        { label: "Branding" },
      ]}
    >
      <div className="page">
        <div>
          <h1 className="page-title">Branding & white-label.</h1>
          <p className="page-sub">
            Customize your organization&apos;s branding, colors, and domain.
          </p>
        </div>
        <BrandSettings />
      </div>
    </DashboardShell>
  );
}
