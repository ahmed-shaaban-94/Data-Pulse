"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useProductDetail } from "@/hooks/use-product-detail";
import { LoadingCard } from "@/components/loading-card";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";

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

export default function ProductDetailPage() {
  const params = useParams<{ key: string }>();
  const productKey = Number(params.key);
  const { data, error, isLoading } = useProductDetail(productKey);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard lines={2} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <LoadingCard key={i} lines={2} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load product details"
        description={error.message || "An error occurred while fetching product data."}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Product not found"
        description="The requested product could not be found."
      />
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/products" className="hover:text-accent transition-colors">
          Products
        </Link>
        <span>/</span>
        <span className="text-text-primary">{data.drug_name}</span>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary">{data.drug_name}</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Drug Code" value={data.drug_code} />
        <StatCard label="Brand" value={data.drug_brand} />
        <StatCard label="Category" value={data.drug_category} />
        <StatCard label="Total Quantity" value={formatNumber(data.total_quantity)} />
        <StatCard label="Total Sales" value={formatCurrency(data.total_sales)} />
        <StatCard label="Net Amount" value={formatCurrency(data.total_net_amount)} />
        <StatCard label="Return Rate" value={formatPercent(data.return_rate)} />
        <StatCard label="Unique Customers" value={formatNumber(data.unique_customers)} />
      </div>

      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
      >
        &larr; Back to Products
      </Link>
    </div>
  );
}
