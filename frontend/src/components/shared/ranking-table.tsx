import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { RankingItem } from "@/types/api";
import { Trophy, Medal, Award } from "lucide-react";

interface RankingTableProps {
  items: RankingItem[];
  entityLabel: string;
  className?: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-chart-amber/20">
        <Trophy className="h-3.5 w-3.5 text-chart-amber" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-text-secondary/15">
        <Medal className="h-3.5 w-3.5 text-text-secondary" />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-chart-amber/10">
        <Award className="h-3.5 w-3.5 text-chart-amber/70" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-text-secondary">
      {rank}
    </span>
  );
}

export function RankingTable({ items, entityLabel, className }: RankingTableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[500px] text-left text-sm" aria-label="Rankings data">
        <thead>
          <tr className="border-b border-border text-text-secondary">
            <th className="pb-3 pr-4 font-medium">#</th>
            <th className="pb-3 pr-4 font-medium">{entityLabel}</th>
            <th className="pb-3 pr-4 text-right font-medium">Revenue</th>
            <th className="pb-3 text-right font-medium">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.key}
              className={cn(
                "border-b border-divider transition-all duration-200",
                "hover:bg-accent/5",
                index < 3 && "bg-accent/[0.02]",
              )}
            >
              <td className="py-3 pr-4">
                <RankBadge rank={item.rank} />
              </td>
              <td className="py-3 pr-4 max-w-[200px]">
                <span className={cn(
                  "block font-medium text-text-primary truncate",
                  index === 0 && "text-accent",
                )} title={item.name}>
                  {item.name}
                </span>
              </td>
              <td className="py-3 pr-4 text-right font-semibold text-text-primary whitespace-nowrap">
                {formatCurrency(item.value)}
              </td>
              <td className="py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-divider">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent/60 transition-all duration-500"
                      style={{ width: `${Math.min(item.pct_of_total, 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-medium text-text-secondary">
                    {item.pct_of_total.toFixed(1)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
