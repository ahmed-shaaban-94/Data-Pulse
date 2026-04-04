/**
 * Lightweight Sentry initialization for the frontend.
 *
 * Call `initSentry()` once from the root layout or a client provider.
 * Uses the NEXT_PUBLIC_SENTRY_DSN env var — if empty, Sentry is disabled.
 *
 * NOTE: If @sentry/nextjs is installed, prefer its built-in instrumentation
 * (sentry.client.config.ts) over this file. This file exists as a fallback
 * that works without the full @sentry/nextjs package.
 */

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";
const ENV = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development";

let initialized = false;

export function initSentry(): void {
  if (initialized || !DSN || typeof window === "undefined") return;
  initialized = true;

  try {
    // Use @sentry/nextjs if installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs");
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      tracesSampleRate: ENV === "production" ? 0.1 : 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: ENV === "production" ? 1.0 : 0,
    });
    console.info("[sentry] initialized", ENV);
  } catch {
    // @sentry/nextjs not installed — use global error handler as fallback
    window.addEventListener("error", (event) => {
      reportToSentry(event.error);
    });
    window.addEventListener("unhandledrejection", (event) => {
      reportToSentry(event.reason);
    });
    console.info("[sentry] fallback error handler registered");
  }
}

/**
 * Report an error to Sentry via the envelope API (no SDK needed).
 */
function reportToSentry(error: unknown): void {
  if (!DSN || !error) return;

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Parse DSN: https://<key>@<host>/<project_id>
  const match = DSN.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!match) return;

  const [, publicKey, host, projectId] = match;
  const envelope = JSON.stringify({
    event_id: crypto.randomUUID().replace(/-/g, ""),
    sent_at: new Date().toISOString(),
    dsn: DSN,
  }) + "\n" +
    JSON.stringify({ type: "event" }) + "\n" +
    JSON.stringify({
      platform: "javascript",
      environment: ENV,
      exception: {
        values: [{
          type: error instanceof Error ? error.constructor.name : "Error",
          value: message,
          stacktrace: stack ? { frames: [{ filename: stack }] } : undefined,
        }],
      },
      tags: { runtime: "browser" },
    });

  fetch(`https://${host}/api/${projectId}/envelope/`, {
    method: "POST",
    headers: { "X-Sentry-Auth": `Sentry sentry_key=${publicKey}` },
    body: envelope,
  }).catch(() => { /* best effort */ });
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs");
    Sentry.captureException(error, { extra: context });
  } catch {
    reportToSentry(error);
  }
}
