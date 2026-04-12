import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Monitors API health when errors are detected.
 *
 * Starts polling `/health/ready` every 10 seconds when signalled via
 * {@link reportError}.  Stops polling once the API responds with 200.
 * On recovery, calls {@link onRecover} so the caller can trigger a
 * global SWR revalidation.
 */
export function useApiHealth(onRecover?: () => void) {
  const [isApiDown, setIsApiDown] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const downSinceRef = useRef<Date | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/health/ready", { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        stopPolling();
        setIsRecovering(true);
        setIsApiDown(false);
        downSinceRef.current = null;
        onRecover?.();
        // Show recovery banner for 3 seconds then clear
        setTimeout(() => setIsRecovering(false), 3000);
      }
    } catch {
      // Still down — keep polling
    }
  }, [stopPolling, onRecover]);

  /**
   * Call this when any SWR hook encounters a network/5xx error.
   *
   * Verifies the API is actually down before showing the banner —
   * prevents false positives from single-endpoint failures or transient
   * timeouts while the API is otherwise healthy.
   */
  const reportError = useCallback(() => {
    if (intervalRef.current) return; // already verifying / polling

    // Immediately probe /health/ready — show banner ONLY if it also fails.
    // This avoids false positives from one endpoint blipping while the API is fine.
    fetch("/health/ready", { signal: AbortSignal.timeout(5000) })
      .then((res) => {
        if (res.ok) {
          // API is healthy — the SWR error was a false alarm, do nothing.
          return;
        }
        // Health check returned non-200 — API is genuinely degraded.
        downSinceRef.current = new Date();
        setIsApiDown(true);
        setIsRecovering(false);
        intervalRef.current = setInterval(poll, 10_000);
      })
      .catch(() => {
        // Couldn't reach health endpoint at all — API is genuinely down.
        downSinceRef.current = new Date();
        setIsApiDown(true);
        setIsRecovering(false);
        intervalRef.current = setInterval(poll, 10_000);
      });
  }, [poll]);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  return { isApiDown, isRecovering, reportError };
}
