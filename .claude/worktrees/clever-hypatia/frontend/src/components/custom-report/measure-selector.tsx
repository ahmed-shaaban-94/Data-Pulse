"use client";

import { cn } from "@/lib/utils";
import {
  METRIC_GROUPS,
  friendlyMetricLabel,
  type FieldGroup,
} from "./report-config";
import type { ExploreMetric } from "@/types/api";

interface MeasureSelectorProps {
  availableMetrics: ExploreMetric[];
  selected: string[];
  onToggle: (name: string) => void;
}

export function MeasureSelector({
  availableMetrics,
  selected,
  onToggle,
}: MeasureSelectorProps) {
  const availableNames = new Set(availableMetrics.map((m) => m.name));

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-text-primary">
        What to calculate{" "}
        <span className="font-normal text-text-secondary text-xs">
          (pick one or more)
        </span>
      </h4>
      <div className="space-y-3">
        {METRIC_GROUPS.map((group: FieldGroup) => {
          const fields = group.fields.filter((f) => availableNames.has(f));
          if (fields.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-secondary/60">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {fields.map((name) => {
                  const isActive = selected.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => onToggle(name)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                        isActive
                          ? "bg-accent text-white"
                          : "bg-card border border-border text-text-secondary hover:border-border-hover hover:text-text-primary",
                      )}
                    >
                      {friendlyMetricLabel(name)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
