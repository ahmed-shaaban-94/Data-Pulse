import useSWR from "swr";
import { fetchAPI } from "@/lib/api-client";
import type { ReorderAlertItem } from "@/types/api";

/** Design-handoff reorder watchlist (issue #507).
 *
 * Hits the same backend route as `useReorderAlerts` but returns the raw,
 * enriched response shape (`daily_velocity`, `days_of_stock`, `status`)
 * without the legacy client-side re-projection. Scoped to the v3 dashboard.
 */
export function useReorderWatchlist(siteKey?: number | null, limit = 10) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (siteKey != null) params.set("site_key", String(siteKey));
  const key = `/api/v1/inventory/alerts/reorder?${params.toString()}`;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchAPI<ReorderAlertItem[]>(key),
    { refreshInterval: 5 * 60_000 },
  );
  return { data, error, isLoading, mutate };
}
