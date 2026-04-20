import useSWR from "swr";
import { fetchAPI } from "@/lib/api-client";
import type { AnomalyCard } from "@/types/api";

/** SWR hook for `GET /anomalies/cards` — issue #508. */
export function useAnomalyCards(limit = 10) {
  const key = `/api/v1/anomalies/cards?limit=${limit}`;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchAPI<AnomalyCard[]>(key),
    { refreshInterval: 60_000 },
  );
  return { data, error, isLoading, mutate };
}
