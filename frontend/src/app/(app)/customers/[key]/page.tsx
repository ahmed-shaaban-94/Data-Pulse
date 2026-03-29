"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCustomerDetail } from "@/hooks/use-customer-detail";
import { LoadingCard } from "@/components/loading-card";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency, formatNumber } from "@/lib/formatters";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ key: string }>();
  const customerKey = Number(params.key);
  const { data, error, isLoading } = useCustomerDetail(customerKey);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard lines={2} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <LoadingCard key={i} lines={2} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load customer details"
        description={error.message || "An error occurred while fetching customer data."}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Customer not found"
        description="The requested customer could not be found."
      />
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/customers" className="hover:text-accent transition-colors">
          Customers
        </Link>
        <span>/</span>
        <span className="text-text-primary">{data.customer_name}</span>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary">{data.customer_name}</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Customer ID" value={data.customer_id} />
        <StatCard label="Total Quantity" value={formatNumber(data.total_quantity)} />
        <StatCard label="Net Amount" value={formatCurrency(data.total_net_amount)} />
        <StatCard label="Transactions" value={formatNumber(data.transaction_count)} />
        <StatCard label="Unique Products" value={formatNumber(data.unique_products)} />
        <StatCard label="Return Count" value={formatNumber(data.return_count)} />
      </div>

      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
      >
        &larr; Back to Customers
      </Link>
    </div>
  );
}
