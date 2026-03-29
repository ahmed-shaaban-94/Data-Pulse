"use client";

import { useTopProducts } from "@/hooks/use-top-products";
import { useTopCustomers } from "@/hooks/use-top-customers";
import { useFilters } from "@/contexts/filter-context";
import { formatCurrency } from "@/lib/formatters";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LoadingCard } from "@/components/loading-card";
import type { RankingItem } from "@/types/api";

function RankingCard({
  title,
  href,
  items,
  isLoading,
}: {
  title: string;
  href: string;
  items: RankingItem[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <LoadingCard lines={5} />;
  }

  const top5 = items?.slice(0, 5) ?? [];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {top5.map((item) => (
          <li
            key={item.key}
            className="relative px-5 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {item.rank}
                </span>
                <span className="truncate text-sm text-foreground">
                  {item.name}
                </span>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground">
                {formatCurrency(item.value)}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/30 transition-all"
                style={{ width: `${Math.min(item.pct_of_total, 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function QuickRankings() {
  const { filters } = useFilters();
  const hookFilters = { ...filters, limit: 5 };

  const {
    data: products,
    isLoading: productsLoading,
  } = useTopProducts(hookFilters);

  const {
    data: customers,
    isLoading: customersLoading,
  } = useTopCustomers(hookFilters);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <RankingCard
        title="Top 5 Products"
        href="/products"
        items={products?.items}
        isLoading={productsLoading}
      />
      <RankingCard
        title="Top 5 Customers"
        href="/customers"
        items={customers?.items}
        isLoading={customersLoading}
      />
    </div>
  );
}
