"use client";

import { useTopInsight } from "@/hooks/use-top-insight";
import { AlertBanner } from "./alert-banner";

/**
 * Live wrapper over `AlertBanner` — fetches the single top insight
 * from `/ai-light/top-insight` (issue #510).
 *
 * Behavior:
 * - Loading: renders a low-contrast skeleton so the page doesn't jump.
 * - 204 / null: renders nothing — the banner hides cleanly.
 * - Error: renders nothing (AI availability is optional; not a blocker).
 * - Success: forwards to the presentational `AlertBanner` with
 *   action_target as the CTA href.
 */
export function AlertBannerConnected() {
  const { data, error, isLoading } = useTopInsight();

  if (isLoading) {
    return (
      <div
        aria-hidden
        className="h-14 animate-pulse rounded-xl border border-border/20 bg-card/40"
      />
    );
  }

  if (error || !data) return null;

  return (
    <AlertBanner
      data={{
        title: "AI insight",
        body: `${data.title} — ${data.body}`,
        action: data.action_label,
        actionHref: data.action_target ?? undefined,
      }}
    />
  );
}
