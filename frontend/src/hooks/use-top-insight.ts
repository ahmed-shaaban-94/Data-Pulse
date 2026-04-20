import { getSession } from "next-auth/react";
import useSWR from "swr";
import { API_BASE_URL } from "@/lib/constants";
import type { TopInsight } from "@/types/api";

/**
 * Fetcher for `/ai-light/top-insight` — the endpoint returns **204 No Content**
 * when there is no active insight (issue #510), so we can't reuse `fetchAPI`
 * which unconditionally parses JSON.  Returns `null` on 204 so SWR treats it
 * as a successful "empty" state and the banner simply hides.
 */
async function fetchTopInsight(path: string): Promise<TopInsight | null> {
  let auth: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const session = await getSession();
      if (session?.accessToken) {
        auth = { Authorization: `Bearer ${session.accessToken}` };
      }
    } catch {
      // SSR / pre-hydration — no token available, proceed unauthenticated
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { headers: auth });
  if (res.status === 204) return null;
  if (!res.ok) {
    throw new Error(`Top-insight fetch failed: ${res.status}`);
  }
  return (await res.json()) as TopInsight;
}

export function useTopInsight() {
  const key = "/api/v1/ai-light/top-insight";
  const { data, error, isLoading, mutate } = useSWR(key, fetchTopInsight, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });
  return { data, error, isLoading, mutate };
}
