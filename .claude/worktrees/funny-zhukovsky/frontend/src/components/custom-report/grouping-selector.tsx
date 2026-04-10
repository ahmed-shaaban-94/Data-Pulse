"use client";

import { cn } from "@/lib/utils";
import {
  DIMENSION_GROUPS,
  friendlyDimensionLabel,
  isUngroupedDimension,
  type FieldGroup,
} from "./report-config";
import type { ExploreDimension } from "@/types/api";

interface GroupingSelectorProps {
  availableDimensions: ExploreDimension[];
  selected: string[];
  onToggle: (name: string) => void;
}

export function GroupingSelector({
  availableDimensions,
  selected,
  onToggle,
}: GroupingSelectorProps) {
  const availableNames = new Set(availableDimensions.map((d) => d.name));

  // Collect ungrouped dimensions (exist in API but not in any predefined group)
  const ungrouped = availableDimensions
    .filter((d) => isUngroupedDimension(d.name))
    .map((d) => d.name);

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-text-primary">
        Break down by{" "}
        <span className="font-normal text-text-secondary text-xs">
          (pick one or more)
        </span>
      </h4>
      <div className="space-y-3">
        {DIMENSION_GROUPS.map((group: FieldGroup) => {
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
                          ? "bg-blue-600 text-white"
                          : "bg-card border border-border text-text-secondary hover:border-border-hover hover:text-text-primary",
                      )}
                    >
                      {friendlyDimensionLabel(name)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Other — catch any API dimensions not in predefined groups */}
        {ungrouped.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-secondary/60">
              Other
            </p>
            <div className="flex flex-wrap gap-2">
              {ungrouped.map((name) => {
                const isActive = selected.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => onToggle(name)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-card border border-border text-text-secondary hover:border-border-hover hover:text-text-primary",
                    )}
                  >
                    {friendlyDimensionLabel(name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
