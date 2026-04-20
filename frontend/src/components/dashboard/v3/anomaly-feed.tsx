"use client";

import { TrendingDown, TrendingUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnomalyCards } from "@/hooks/use-anomaly-cards";
import type { AnomalyCard as AnomalyCardT } from "@/types/api";

/** Anomaly feed widget — live `/anomalies/cards` (issue #508). */
export function AnomalyFeed() {
  const { data, error, isLoading } = useAnomalyCards(5);

  return (
    <section
      aria-label="Anomalies feed"
      className="flex min-h-[240px] flex-col gap-3 rounded-card border border-border/40 bg-card p-5"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-text-primary">Anomalies</h3>
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-text-tertiary">
          Live
        </span>
      </header>

      {isLoading ? <SkeletonRows /> : null}
      {!isLoading && error ? (
        <p className="text-sm text-text-tertiary">Unable to load anomalies.</p>
      ) : null}
      {!isLoading && !error && (!data || data.length === 0) ? (
        <p className="text-sm text-text-tertiary">
          No active anomalies detected. Pipeline metrics are within the
          expected range.
        </p>
      ) : null}
      {!isLoading && !error && data && data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {data.map((card) => (
            <AnomalyRow key={card.id} card={card} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const KIND_STYLES: Record<
  AnomalyCardT["kind"],
  { bg: string; text: string; Icon: typeof TrendingUp }
> = {
  up: { bg: "bg-growth-green/15", text: "text-growth-green", Icon: TrendingUp },
  down: { bg: "bg-growth-red/15", text: "text-growth-red", Icon: TrendingDown },
  info: { bg: "bg-chart-blue/15", text: "text-chart-blue", Icon: Info },
};

const CONFIDENCE_TONE: Record<AnomalyCardT["confidence"], string> = {
  high: "border-growth-red/40 text-growth-red",
  medium: "border-chart-amber/40 text-chart-amber",
  low: "border-border/40 text-text-tertiary",
  info: "border-chart-blue/40 text-chart-blue",
};

function AnomalyRow({ card }: { card: AnomalyCardT }) {
  const { bg, text, Icon } = KIND_STYLES[card.kind];
  return (
    <li className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
          bg,
          text,
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary">{card.title}</p>
          <span
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
              CONFIDENCE_TONE[card.confidence],
            )}
          >
            {card.confidence}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-text-tertiary">
          {card.body}
        </p>
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-text-tertiary">
          {card.time_ago}
        </p>
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-card/70" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-card/70" />
            <div className="h-2 w-full animate-pulse rounded bg-card/50" />
          </div>
        </li>
      ))}
    </ul>
  );
}
