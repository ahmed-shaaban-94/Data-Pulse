/**
 * Sentry crash reporting for the Electron main process (#481 / epic #479).
 *
 * Wires `@sentry/electron/main` with:
 *   - A `beforeSend` scrubber that drops request bodies and sensitive tags
 *     before events leave the device. This mirrors the redaction list in
 *     `electron/logging/index.ts` — anything we hide from disk logs must
 *     also be hidden from Sentry payloads.
 *   - An opt-in toggle read from the `sentry_enabled` setting. Default is
 *     ENABLED (pilots expect crash reporting); users can flip the flag via
 *     the Settings UI and restart the app to take effect.
 *   - DSN read from `SENTRY_DSN` env (injected at build time by the release
 *     workflow — the public client DSN is safe to ship in the installer).
 *     Missing DSN means reporting is simply skipped — no crash.
 *
 * Source map upload happens in `.github/workflows/pos-desktop-release.yml`
 * via `sentry-cli` after the installer build step. See the `Upload source
 * maps` job there.
 *
 * The renderer side (`@sentry/electron/renderer`) is intentionally NOT
 * initialised here — that lives inside the Next.js POS layout because the
 * renderer process is the Next.js standalone server, not the Electron
 * binary. This module only handles the main-process half of the wiring.
 */

import type { ElectronMainOptions } from "@sentry/electron/main";
import type { ErrorEvent, EventHint } from "@sentry/core";

// `@sentry/electron/main` is imported lazily inside `initCrashReporter` so
// tests (which always inject their own `sentryInit` via deps) never load
// the real SDK. Loading it here would crash Jest because the SDK reads
// `process.versions.electron` at import time, which is undefined under
// plain Node.
type SentryInit = (opts: ElectronMainOptions) => void;
import type Database from "better-sqlite3";
import { app } from "electron";
import { getSetting, setSetting } from "../db/settings";
import { getLogger } from "../logging/index";

// Tags / extras that must never leave the device. Kept in sync with
// `REDACT_PATHS` in logging/index.ts — if a new PII field shows up there,
// add it here too.
const SENSITIVE_KEYS: readonly string[] = [
  "customer_id",
  "national_id",
  "phone",
  "voucher_code",
  "cash_tendered",
  "authorization",
  "password",
  "token",
  "refresh_token",
  "device_private_key",
];

export const SENTRY_ENABLED_KEY = "sentry_enabled" as const;

export interface CrashReporterDeps {
  /** Override sentry init (tests inject a spy). */
  sentryInit?: SentryInit;
  /** Override DSN (tests). Defaults to `SENTRY_DSN` env var. */
  dsn?: string;
  /** Override release (tests). Defaults to `app.getVersion()`. */
  release?: string;
  /** Override environment (tests). Defaults to `DATAPULSE_ENV` env or "production". */
  environment?: string;
  /** Custom logger. Defaults to the pino singleton tagged `module=crash-reporter`. */
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

/**
 * Reads the `sentry_enabled` setting. Absent rows default to true — the
 * toggle is only respected if the user has explicitly flipped it to "false".
 */
export function isCrashReportingEnabled(db: Database.Database): boolean {
  const value = getSetting(db, SENTRY_ENABLED_KEY);
  return value !== "false";
}

/** Persist the opt-in toggle. Called from the IPC surface. */
export function setCrashReportingEnabled(db: Database.Database, enabled: boolean): void {
  setSetting(db, SENTRY_ENABLED_KEY, enabled ? "true" : "false");
}

/**
 * beforeSend hook: scrub PII before the event hits the wire.
 *
 * Kept as a pure function (exported for tests) so we can assert the
 * scrubbing behaviour without spinning up Sentry.
 */
export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  // Drop request bodies outright — we don't know what fields they contain
  // and Sentry's default scrubber isn't aware of our POS schema.
  if (event.request?.data !== undefined) {
    delete event.request.data;
  }
  if (event.request?.cookies !== undefined) {
    delete event.request.cookies;
  }
  if (event.request?.headers) {
    for (const h of ["authorization", "cookie", "Authorization", "Cookie"]) {
      delete event.request.headers[h];
    }
  }

  // Strip sensitive tags / extras that may have been set via `setTag` /
  // `setExtra` before the event was captured.
  const stripFrom = (bag: Record<string, unknown> | undefined): void => {
    if (!bag) return;
    for (const key of SENSITIVE_KEYS) delete bag[key];
  };
  stripFrom(event.tags as Record<string, unknown> | undefined);
  stripFrom(event.extra);

  // User object: keep `id` (useful for grouping) but drop anything that
  // could identify a pharmacy customer.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  return event;
}

/**
 * Initialise Sentry for the main process. Returns true if initialisation
 * ran, false if it was skipped (disabled setting or missing DSN).
 *
 * Safe to call before `app.whenReady()` — the underlying SDK tolerates it.
 * Callers should invoke this BEFORE creating the first BrowserWindow so
 * renderer processes inherit the configured state via the preload hook.
 */
export function initCrashReporter(
  db: Database.Database,
  deps: CrashReporterDeps = {},
): boolean {
  const log =
    deps.log ??
    ((msg: string, extra?: Record<string, unknown>) =>
      getLogger().info({ module: "crash-reporter", ...(extra ?? {}) }, msg));

  if (!isCrashReportingEnabled(db)) {
    log("crash reporting disabled by user setting — skipping init");
    return false;
  }

  const dsn = deps.dsn ?? process.env.SENTRY_DSN ?? "";
  if (!dsn) {
    log("crash reporting skipped — SENTRY_DSN not set");
    return false;
  }

  const release = deps.release ?? safeVersion();
  const environment = deps.environment ?? process.env.DATAPULSE_ENV ?? "production";

  const initFn = deps.sentryInit ?? loadSentryInit();
  initFn({
    dsn,
    release,
    environment,
    // 5% trace sampling: enough to spot a perf cliff without flooding Sentry
    // quota from terminals that do hundreds of transactions per shift.
    tracesSampleRate: 0.05,
    beforeSend: scrubEvent,
  });

  log("crash reporter initialised", { release, environment });
  return true;
}

function loadSentryInit(): SentryInit {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@sentry/electron/main") as { init: SentryInit };
  return mod.init;
}

function safeVersion(): string {
  try {
    return app.getVersion();
  } catch {
    // `app` not ready yet — acceptable; Sentry accepts late release tags.
    return "unknown";
  }
}
