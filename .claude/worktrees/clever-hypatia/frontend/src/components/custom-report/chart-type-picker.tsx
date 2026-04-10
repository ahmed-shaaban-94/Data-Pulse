"use client";

import { Table, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChartType } from "./report-config";

interface ChartTypePickerProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

const OPTIONS: { key: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "table", label: "Table", icon: Table },
  { key: "bar", label: "Bar", icon: BarChart3 },
  { key: "line", label: "Line", icon: LineChartIcon },
  { key: "pie", label: "Pie", icon: PieChartIcon },
];

export function ChartTypePicker({ value, onChange }: ChartTypePickerProps) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-text-primary">
        Display as
      </h4>
      <div className="inline-flex gap-1 rounded-lg bg-background p-1">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all",
                isActive
                  ? "bg-divider text-text-primary"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <opt.icon className="h-4 w-4" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
