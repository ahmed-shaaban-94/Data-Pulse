"use client";

import useSWR from "swr";
import { fetchAPI } from "@/lib/api-client";
import type { QualityCheckList } from "@/types/api";

interface QualityDetailsProps {
  runId: string;
}

const severityConfig: Record<string, { bg: string; text: string }> = {
  error: { bg: "bg-red-500/15",    text: "text-red-400" },
  warn:  { bg: "bg-yellow-500/15", text: "text-yellow-400" },
};

export function QualityDetails({ runId }: QualityDetailsProps) {
  const key = `/api/v1/pipeline/runs/${runId}/quality`;
  const { data, error, isLoading } = useSWR(key, () =>
    fetchAPI<QualityCheckList>(key),
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-lg bg-divider"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-text-secondary">Quality data not available.</p>
    );
  }

  const checks = data?.items ?? [];

  if (checks.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No quality checks recorded for this run.</p>
    );
  }

  return (
    <div className="space-y-2">
      {checks.map((check) => {
        const sev = severityConfig[check.severity] ?? { bg: "bg-slate-500/15", text: "text-slate-400" };
        return (
          <div
            key={check.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            {/* Pass/Fail indicator */}
            <span
              className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                check.passed
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {check.passed ? "PASS" : "FAIL"}
            </span>

            {/* Check name + message */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">{check.check_name}</p>
              {check.message && (
                <p className="mt-0.5 text-xs text-text-secondary">{check.message}</p>
              )}
            </div>

            {/* Severity badge */}
            <span
              className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.text}`}
            >
              {check.severity}
            </span>
          </div>
        );
      })}
    </div>
  );
}
