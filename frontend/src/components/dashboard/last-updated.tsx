"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

export function LastUpdated() {
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTimestamp(
      now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );

    // Update every minute
    const interval = setInterval(() => {
      setTimestamp(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!timestamp) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
      <Clock className="h-3 w-3" />
      <span>Updated {timestamp}</span>
    </div>
  );
}
