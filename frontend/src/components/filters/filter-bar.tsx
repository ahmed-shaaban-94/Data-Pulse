"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { useFilters } from "@/contexts/filter-context";
import { getDatePresets, formatDateParam } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";

export function FilterBar() {
  const { filters, setFilters, updateFilter, clearFilters } = useFilters();
  const presets = getDatePresets();

  const [expanded, setExpanded] = useState(false);

  const categoryRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);

  const activeFilterCount = Object.keys(filters).length;
  const hasFilters = activeFilterCount > 0;

  const handlePreset = (preset: { startDate: Date; endDate: Date }) => {
    setFilters({
      ...filters,
      start_date: formatDateParam(preset.startDate),
      end_date: formatDateParam(preset.endDate),
    });
  };

  const isActivePreset = (preset: { startDate: Date; endDate: Date }) => {
    return (
      filters.start_date === formatDateParam(preset.startDate) &&
      filters.end_date === formatDateParam(preset.endDate)
    );
  };

  const commitTextFilter = useCallback(
    (key: "category" | "brand", ref: React.RefObject<HTMLInputElement | null>) => {
      const value = ref.current?.value.trim();
      updateFilter(key, value || undefined);
    },
    [updateFilter],
  );

  const handleKeyDown = (
    key: "category" | "brand",
    ref: React.RefObject<HTMLInputElement | null>,
    e: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      commitTextFilter(key, ref);
    }
  };

  return (
    <div className="mb-6 space-y-2">
      {/* Row 1: Date presets + toggle + clear */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActivePreset(preset)
                ? "bg-accent text-page"
                : "bg-divider text-text-secondary hover:bg-border hover:text-text-primary",
            )}
          >
            {preset.label}
          </button>
        ))}

        {/* More Filters toggle */}
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            expanded
              ? "bg-accent/10 text-accent"
              : "bg-divider text-text-secondary hover:bg-border hover:text-text-primary",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">More Filters</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        {/* Clear button with badge */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-growth-red/10 hover:text-growth-red"
          >
            <X className="h-3.5 w-3.5" />
            Clear
            <span className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-growth-red/15 text-xs font-semibold text-growth-red">
              {activeFilterCount}
            </span>
          </button>
        )}
      </div>

      {/* Row 2: Collapsible custom filters */}
      {expanded && (
        <div className="flex flex-col gap-2 rounded-lg border border-divider bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
          {/* Custom date range */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className="text-xs font-medium text-text-secondary">From</label>
            <input
              type="date"
              value={filters.start_date ?? ""}
              onChange={(e) =>
                updateFilter("start_date", e.target.value || undefined)
              }
              className="h-8 rounded-md border border-divider bg-page px-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className="text-xs font-medium text-text-secondary">To</label>
            <input
              type="date"
              value={filters.end_date ?? ""}
              onChange={(e) =>
                updateFilter("end_date", e.target.value || undefined)
              }
              className="h-8 rounded-md border border-divider bg-page px-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Separator */}
          <div className="hidden h-6 w-px bg-divider sm:block" />

          {/* Category */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className="text-xs font-medium text-text-secondary">Category</label>
            <input
              ref={categoryRef}
              type="text"
              defaultValue={filters.category ?? ""}
              placeholder="Category..."
              onBlur={() => commitTextFilter("category", categoryRef)}
              onKeyDown={(e) => handleKeyDown("category", categoryRef, e)}
              className="h-8 w-full rounded-md border border-divider bg-page px-2 text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent sm:w-36"
            />
          </div>

          {/* Brand */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className="text-xs font-medium text-text-secondary">Brand</label>
            <input
              ref={brandRef}
              type="text"
              defaultValue={filters.brand ?? ""}
              placeholder="Brand..."
              onBlur={() => commitTextFilter("brand", brandRef)}
              onKeyDown={(e) => handleKeyDown("brand", brandRef, e)}
              className="h-8 w-full rounded-md border border-divider bg-page px-2 text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent sm:w-36"
            />
          </div>
        </div>
      )}
    </div>
  );
}
