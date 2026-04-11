import useSWR from "swr";
import { fetchAPI, swrKey } from "@/lib/api-client";
import type { FilterParams } from "@/types/filters";

interface OriginBreakdownItem {
  origin: string;
  value: number;
  product_count: number;
  pct: number;
}

export function useOriginBreakdown(filters?: FilterParams) {
  const key = swrKey("/api/v1/analytics/origin-breakdown", filters);
  const { data, error, isLoading } = useSWR(key, () =>
    fetchAPI<OriginBreakdownItem[]>(
      "/api/v1/analytics/origin-breakdown",
      filters,
    ),
  );
  return { data, error, isLoading };
}
