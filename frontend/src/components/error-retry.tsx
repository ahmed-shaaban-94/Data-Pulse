"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorRetryProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorRetry({
  title = "Something went wrong",
  description = "Failed to load data. Please try again.",
  onRetry,
  className,
}: ErrorRetryProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-growth-red/20 bg-card p-12", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-growth-red/10">
        <AlertCircle className="h-7 w-7 text-growth-red" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-1.5 max-w-sm text-center text-sm text-text-secondary">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-page transition-all hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
