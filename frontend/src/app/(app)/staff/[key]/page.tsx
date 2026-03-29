"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useStaffDetail } from "@/hooks/use-staff-detail";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageTransition } from "@/components/layout/page-transition";
import { LoadingCard } from "@/components/loading-card";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency, formatNumber } from "@/lib/formatters";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glow-card rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

export default function StaffDetailPage() {
  const params = useParams<{ key: string }>();
  const staffKey = Number(params.key);
  const { data, error, isLoading } = useStaffDetail(staffKey);

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <LoadingCard lines={2} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingCard key={i} lines={2} />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <EmptyState
          title="Failed to load staff details"
          description={error.message || "An error occurred while fetching staff data."}
        />
      </PageTransition>
    );
  }

  if (!data) {
    return (
      <PageTransition>
        <EmptyState
          title="Staff member not found"
          description="The requested staff member could not be found."
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <Breadcrumbs />

        <nav className="flex items-center gap-2 text-sm text-text-secondary">
          <Link href="/staff" className="hover:text-accent transition-colors">
            Staff
          </Link>
          <span>/</span>
          <span className="text-text-primary">{data.staff_name}</span>
        </nav>

        <div>
          <h1 className="text-2xl font-bold text-text-primary">{data.staff_name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{data.staff_position}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Staff ID" value={data.staff_id} />
          <StatCard label="Position" value={data.staff_position} />
          <StatCard label="Net Amount" value={formatCurrency(data.total_net_amount)} />
          <StatCard label="Transactions" value={formatNumber(data.transaction_count)} />
          <StatCard label="Avg Transaction Value" value={formatCurrency(data.avg_transaction_value)} />
          <StatCard label="Unique Customers" value={formatNumber(data.unique_customers)} />
        </div>

        <Link
          href="/staff"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Staff
        </Link>
      </div>
    </PageTransition>
  );
}
