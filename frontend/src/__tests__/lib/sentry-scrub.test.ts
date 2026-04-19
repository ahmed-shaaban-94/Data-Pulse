/**
 * Tests for the shared Sentry beforeSend scrubber (#481).
 *
 * Mirrors the coverage in pos-desktop's crash-reporter tests — the list of
 * redacted fields must stay in sync across both sides.
 */

import { describe, test, expect } from "vitest";
import type { ErrorEvent } from "@sentry/core";
import { scrubEvent } from "@/lib/sentry-scrub";

describe("scrubEvent", () => {
  test("drops request.data in its entirety", () => {
    const ev: ErrorEvent = {
      type: undefined,
      request: { data: { anything: "here", national_id: "X" } },
    };
    const out = scrubEvent(ev);
    expect(out?.request?.data).toBeUndefined();
  });

  test("drops request.cookies", () => {
    const ev: ErrorEvent = {
      type: undefined,
      request: { cookies: { session: "abc" } },
    };
    const out = scrubEvent(ev);
    expect(out?.request?.cookies).toBeUndefined();
  });

  test("strips authorization + cookie headers (case-insensitive)", () => {
    const ev: ErrorEvent = {
      type: undefined,
      request: {
        headers: {
          authorization: "Bearer x",
          Cookie: "s=y",
          "content-type": "application/json",
        },
      },
    };
    const out = scrubEvent(ev);
    const headers = out?.request?.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
    expect(headers.Cookie).toBeUndefined();
    expect(headers["content-type"]).toBe("application/json");
  });

  test("strips sensitive tags and extras", () => {
    const ev: ErrorEvent = {
      type: undefined,
      tags: { customer_id: "CUST-1", branch: "cairo-main" },
      extra: { password: "x", voucher_code: "SUMMER", unrelated: 1 },
    };
    const out = scrubEvent(ev);
    const tags = out?.tags as Record<string, string>;
    const extra = out?.extra as Record<string, unknown>;
    expect(tags.customer_id).toBeUndefined();
    expect(tags.branch).toBe("cairo-main");
    expect(extra.password).toBeUndefined();
    expect(extra.voucher_code).toBeUndefined();
    expect(extra.unrelated).toBe(1);
  });

  test("scrubs user PII but keeps id", () => {
    const ev: ErrorEvent = {
      type: undefined,
      user: { id: "u-1", email: "x@y.z", ip_address: "10.0.0.1", username: "foo" },
    };
    const out = scrubEvent(ev);
    expect(out?.user?.id).toBe("u-1");
    expect(out?.user?.email).toBeUndefined();
    expect(out?.user?.ip_address).toBeUndefined();
    expect(out?.user?.username).toBeUndefined();
  });
});
