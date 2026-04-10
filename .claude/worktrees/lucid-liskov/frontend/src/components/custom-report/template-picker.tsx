"use client";

import { cn } from "@/lib/utils";
import { REPORT_TEMPLATES, type ReportTemplate } from "./report-config";

interface TemplatePickerProps {
  selectedId: string | null;
  onSelect: (template: ReportTemplate) => void;
}

export function TemplatePicker({ selectedId, onSelect }: TemplatePickerProps) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Start with a template
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {REPORT_TEMPLATES.map((t) => {
          const Icon = t.icon;
          const isSelected = selectedId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={cn(
                "flex min-w-[130px] flex-shrink-0 flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-border-hover hover:bg-divider",
              )}
            >
              <Icon
                className={cn(
                  "h-7 w-7",
                  isSelected ? "text-accent" : "text-text-secondary",
                )}
              />
              <span
                className={cn(
                  "text-xs font-semibold",
                  isSelected ? "text-accent" : "text-text-primary",
                )}
              >
                {t.name}
              </span>
              <span className="text-[10px] text-text-secondary">
                {t.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
