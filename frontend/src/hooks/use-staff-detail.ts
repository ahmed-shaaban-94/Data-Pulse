import useSWR from "swr";
import { fetchAPI } from "@/lib/api-client";
import type { StaffPerformance } from "@/types/api";

export function useStaffDetail(staffKey: number) {
  const { data, error, mutate } = useSWR(
    `/api/v1/analytics/staff/${staffKey}`,
    () => fetchAPI<StaffPerformance>(`/api/v1/analytics/staff/${staffKey}`),
  );
  return { data, error, isLoading: !data && !error, mutate };
}
