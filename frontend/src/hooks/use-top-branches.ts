import useSWR from "swr";
import { fetchAPI } from "@/lib/api-client";
import type { RankingResult } from "@/types/api";

/** SWR hook for `GET /analytics/sites?include_staff=true` (issue #507).
 *
 * Returns the enriched site ranking (each item has `staff_count`) backing the
 * Top Branches card on /dashboard/v3.
 */
export function useTopBranches(limit = 6) {
  const key = `/api/v1/analytics/sites?include_staff=true&limit=${limit}`;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchAPI<RankingResult>(key),
    { refreshInterval: 5 * 60_000 },
  );
  return { data, error, isLoading, mutate };
}
