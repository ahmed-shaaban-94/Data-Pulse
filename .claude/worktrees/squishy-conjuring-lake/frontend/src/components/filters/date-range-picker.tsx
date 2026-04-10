"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onRangeChange: (start: string | undefined, end: string | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const selected: DateRange | undefined =
    startDate && endDate
      ? {
          from: new Date(startDate + "T00:00:00"),
          to: new Date(endDate + "T00:00:00"),
        }
      : undefined;

  // Track whether user already picked the "from" date (waiting for "to")
  const [pendingFrom, setPendingFrom] = useState<Date | null>(null);

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onRangeChange(undefined, undefined);
      setPendingFrom(null);
      return;
    }

    if (range.to) {
      // Full range selected
      onRangeChange(
        format(range.from, "yyyy-MM-dd"),
        format(range.to, "yyyy-MM-dd"),
      );
      setPendingFrom(null);
      setOpen(false);
    } else if (pendingFrom && range.from.getTime() === pendingFrom.getTime()) {
      // Same day clicked twice — select single day
      onRangeChange(
        format(range.from, "yyyy-MM-dd"),
        format(range.from, "yyyy-MM-dd"),
      );
      setPendingFrom(null);
      setOpen(false);
    } else {
      // First click — wait for second click
      setPendingFrom(range.from);
    }
  };

  const label =
    startDate && endDate
      ? `${format(new Date(startDate + "T00:00:00"), "MMM d, yyyy")} - ${format(new Date(endDate + "T00:00:00"), "MMM d, yyyy")}`
      : "Pick date range";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-md border border-border bg-page px-3 py-1.5 text-sm font-medium transition-colors",
            "text-text-secondary hover:bg-divider hover:text-text-primary",
            open && "border-accent text-accent",
            className,
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">Date Range</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 rounded-lg border border-border bg-card p-3 shadow-xl"
          sideOffset={8}
          align="start"
        >
          <DayPicker
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={2}
            showOutsideDays
            classNames={{
              root: "rdp-datapulse",
              month_caption: "text-sm font-medium text-text-primary mb-2",
              day_button:
                "h-8 w-8 rounded-md text-sm text-text-primary hover:bg-accent/10",
              selected: "bg-accent text-page font-medium",
              range_middle: "bg-accent/15 text-text-primary",
              today: "font-bold text-accent",
              chevron: "text-text-secondary",
            }}
          />
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
