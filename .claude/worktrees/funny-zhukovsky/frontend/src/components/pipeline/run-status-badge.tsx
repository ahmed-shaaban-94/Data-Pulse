"use client";

interface RunStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending:          { bg: "bg-yellow-500/15",  text: "text-yellow-400",  label: "Pending" },
  running:          { bg: "bg-blue-500/15",    text: "text-blue-400",    label: "Running" },
  bronze_complete:  { bg: "bg-amber-500/15",   text: "text-amber-400",   label: "Bronze Done" },
  silver_complete:  { bg: "bg-slate-500/15",   text: "text-slate-400",   label: "Silver Done" },
  gold_complete:    { bg: "bg-yellow-500/15",  text: "text-yellow-300",  label: "Gold Done" },
  success:          { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Success" },
  failed:           { bg: "bg-red-500/15",     text: "text-red-400",     label: "Failed" },
};

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const config = statusConfig[status] ?? {
    bg: "bg-gray-500/15",
    text: "text-gray-400",
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
