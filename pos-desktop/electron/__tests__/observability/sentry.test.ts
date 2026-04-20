import * as path from "path";
import type Database from "better-sqlite3";
import type { Event as SentryEvent } from "@sentry/electron/main";

import { openDb, closeDb } from "../../db/connection";
import { applySchema } from "../../db/migrate";
import { setSetting } from "../../db/settings";
import {
  isCrashReportingEnabled,
  scrubPii,
  PII_TAG_KEYS,
} from "../../observability/sentry";

const SCHEMA = path.join(__dirname, "../../db/schema.sql");

function freshDb(): Database.Database {
  const db = openDb(":memory:");
  applySchema(db, SCHEMA);
  return db;
}

describe("isCrashReportingEnabled", () => {
  let db: Database.Database;
  const originalEnv = process.env.DATAPULSE_CRASH_REPORTING;

  beforeEach(() => {
    db = freshDb();
    delete process.env.DATAPULSE_CRASH_REPORTING;
  });

  afterEach(() => {
    closeDb();
    if (originalEnv === undefined) {
      delete process.env.DATAPULSE_CRASH_REPORTING;
    } else {
      process.env.DATAPULSE_CRASH_REPORTING = originalEnv;
    }
  });

  it("defaults to false with neither env nor db row", () => {
    expect(isCrashReportingEnabled(db)).toBe(false);
  });

  it("returns true when env is '1'", () => {
    process.env.DATAPULSE_CRASH_REPORTING = "1";
    expect(isCrashReportingEnabled(db)).toBe(true);
  });

  it("returns true when env is 'true' (case-insensitive)", () => {
    process.env.DATAPULSE_CRASH_REPORTING = "TrUe";
    expect(isCrashReportingEnabled(db)).toBe(true);
  });

  it("env '0' overrides a db opt-in", () => {
    setSetting(db, "crash_reporting_opt_in", "1");
    process.env.DATAPULSE_CRASH_REPORTING = "0";
    expect(isCrashReportingEnabled(db)).toBe(false);
  });

  it("env 'false' overrides a db opt-in", () => {
    setSetting(db, "crash_reporting_opt_in", "true");
    process.env.DATAPULSE_CRASH_REPORTING = "false";
    expect(isCrashReportingEnabled(db)).toBe(false);
  });

  it("falls through to db row when env is unset", () => {
    setSetting(db, "crash_reporting_opt_in", "1");
    expect(isCrashReportingEnabled(db)).toBe(true);
  });

  it("db row 'true' opts in", () => {
    setSetting(db, "crash_reporting_opt_in", "true");
    expect(isCrashReportingEnabled(db)).toBe(true);
  });

  it("db row '0' or 'false' keeps the default (false)", () => {
    setSetting(db, "crash_reporting_opt_in", "0");
    expect(isCrashReportingEnabled(db)).toBe(false);
    setSetting(db, "crash_reporting_opt_in", "false");
    expect(isCrashReportingEnabled(db)).toBe(false);
  });

  it("returns false when db is null and env unset", () => {
    expect(isCrashReportingEnabled(null)).toBe(false);
  });

  it("reads env even when db is null", () => {
    process.env.DATAPULSE_CRASH_REPORTING = "1";
    expect(isCrashReportingEnabled(null)).toBe(true);
  });
});

describe("scrubPii", () => {
  function baseEvent(overrides: Partial<SentryEvent> = {}): SentryEvent {
    return {
      event_id: "abc123",
      timestamp: 1_700_000_000,
      platform: "javascript",
      ...overrides,
    };
  }

  it("returns the (mutated) event reference, never null", () => {
    const event = baseEvent();
    expect(scrubPii(event)).toBe(event);
  });

  it("drops event.request.data when present", () => {
    const event = baseEvent({
      request: {
        url: "http://localhost/checkout",
        method: "POST",
        data: { national_id: "29901011234567", customer_name: "X" },
      },
    });
    scrubPii(event);
    expect(event.request).toBeDefined();
    expect(event.request).not.toHaveProperty("data");
    // URL + method are not PII per our policy — keep them.
    expect(event.request?.url).toBe("http://localhost/checkout");
    expect(event.request?.method).toBe("POST");
  });

  it("leaves event.request alone when there is no .data", () => {
    const event = baseEvent({
      request: { url: "http://localhost/x" },
    });
    scrubPii(event);
    expect(event.request?.url).toBe("http://localhost/x");
  });

  it.each([...PII_TAG_KEYS])("strips tag '%s'", (key) => {
    const event = baseEvent({
      tags: { [key]: "leak", safe_tag: "keep" } as Record<string, string>,
    });
    scrubPii(event);
    expect(event.tags).not.toHaveProperty(key);
    expect(event.tags?.safe_tag).toBe("keep");
  });

  it("strips customer identifiers nested under contexts.*.<key>", () => {
    const event = baseEvent({
      contexts: {
        business: {
          customer_id: "cust-42",
          site_code: "MAADI",
        },
        device: { model: "HP ProBook" },
      },
    });
    scrubPii(event);
    const business = event.contexts?.business as Record<string, unknown>;
    expect(business).not.toHaveProperty("customer_id");
    expect(business.site_code).toBe("MAADI");
    // Other top-level contexts untouched
    expect((event.contexts?.device as Record<string, unknown>).model).toBe(
      "HP ProBook",
    );
  });

  it("strips identifiers from event.extra.* maps", () => {
    const event = baseEvent({
      extra: {
        correlation: { request_id: "r-1", phone: "+20 100 555 7777" },
        timings: { total_ms: 123 },
      },
    });
    scrubPii(event);
    const correlation = event.extra?.correlation as Record<string, unknown>;
    expect(correlation).not.toHaveProperty("phone");
    expect(correlation.request_id).toBe("r-1");
  });

  it("nulls out PII fields on event.user", () => {
    const event = baseEvent({
      user: {
        id: "staff-uuid",
        email: "cashier@example.com",
        username: "nour",
        ip_address: "10.0.0.5",
      },
    });
    scrubPii(event);
    expect(event.user?.id).toBe("staff-uuid");
    expect(event.user).not.toHaveProperty("email");
    expect(event.user).not.toHaveProperty("username");
    expect(event.user).not.toHaveProperty("ip_address");
  });

  it("is safe on an empty event (no tags, no request, no user)", () => {
    const event = baseEvent();
    expect(() => scrubPii(event)).not.toThrow();
    // Event shape is unchanged.
    expect(event.event_id).toBe("abc123");
  });

  it("does not delete keys that merely look similar but aren't in the list", () => {
    const event = baseEvent({
      tags: {
        customer_segment: "vip",
        phone_model: "iPhone",
      } as Record<string, string>,
    });
    scrubPii(event);
    expect(event.tags?.customer_segment).toBe("vip");
    expect(event.tags?.phone_model).toBe("iPhone");
  });
});
