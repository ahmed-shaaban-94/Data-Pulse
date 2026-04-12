"use client";

import { useState } from "react";
import { Trophy, Award, Flame, Swords, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { XPLeaderboard } from "./xp-leaderboard";
import { ActivityFeed } from "./activity-feed";
import { CompetitionCard } from "./competition-card";
import { BadgeGrid } from "./badge-grid";
import { useCompetitions, useBadges, useStaffBadges } from "@/hooks/use-gamification";
import { LoadingCard } from "@/components/loading-card";

type Tab = "leaderboard" | "badges" | "competitions" | "feed";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "badges", label: "Badges", icon: Award },
  { key: "competitions", label: "Competitions", icon: Swords },
  { key: "feed", label: "Activity", icon: Activity },
];

export function GamificationDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("leaderboard");

  return (
    <div className="space-y-6">
      <div className="viz-panel-soft flex gap-1 rounded-[1.5rem] p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-[1.1rem] px-3 py-2.5 text-sm font-medium transition-all",
                activeTab === tab.key
                  ? "bg-accent text-page shadow-[0_12px_24px_rgba(0,199,242,0.22)]"
                  : "text-text-secondary hover:bg-background/60 hover:text-text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "leaderboard" && <XPLeaderboard />}
      {activeTab === "badges" && <BadgesTab />}
      {activeTab === "competitions" && <CompetitionsTab />}
      {activeTab === "feed" && <ActivityFeed />}
    </div>
  );
}

function BadgesTab() {
  const { data: allBadges, isLoading: loadingBadges } = useBadges();
  const { data: earnedBadges } = useStaffBadges(0);

  if (loadingBadges) return <LoadingCard lines={6} />;
  if (!allBadges?.length) {
    return (
      <div className="viz-panel rounded-[1.75rem] p-8 text-center text-sm text-text-secondary">
        No badges defined yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">All Available Badges</h3>
        <span className="text-xs text-text-secondary">{allBadges.length} total</span>
      </div>
      <BadgeGrid allBadges={allBadges} earnedBadges={earnedBadges || []} />
    </div>
  );
}

function CompetitionsTab() {
  const { data: competitions, isLoading } = useCompetitions();

  if (isLoading) return <LoadingCard lines={4} />;
  if (!competitions?.length) {
    return (
      <div className="viz-panel rounded-[1.75rem] p-8 text-center text-sm text-text-secondary">
        No competitions yet. Create one to get started!
      </div>
    );
  }

  const active = competitions.filter((c) => c.status === "active");
  const upcoming = competitions.filter((c) => c.status === "upcoming");
  const completed = competitions.filter((c) => c.status === "completed");

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
            <Flame className="h-4 w-4 text-green-400" /> Active
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((c) => <CompetitionCard key={c.competition_id} competition={c} />)}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">Upcoming</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((c) => <CompetitionCard key={c.competition_id} competition={c} />)}
          </div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">Completed</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {completed.map((c) => <CompetitionCard key={c.competition_id} competition={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}
