/**
 * Shared Sentry `beforeSend` scrubber for the Next.js frontend (#481).
 *
 * Mirrors the redaction list in `pos-desktop/electron/logging/index.ts` and
 * `pos-desktop/electron/crash-reporter/index.ts` — anything hidden from
 * disk logs or main-process Sentry must also be hidden from renderer /
 * server Sentry payloads. Keep the three lists in sync.
 */

import type { ErrorEvent, EventHint } from "@sentry/core";

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

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
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

  const stripFrom = (bag: Record<string, unknown> | undefined): void => {
    if (!bag) return;
    for (const key of SENSITIVE_KEYS) delete bag[key];
  };
  stripFrom(event.tags as Record<string, unknown> | undefined);
  stripFrom(event.extra);

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  return event;
}
