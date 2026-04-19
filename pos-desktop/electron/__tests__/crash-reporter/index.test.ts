/**
 * Tests for the Sentry crash-reporter wrapper (#481 / epic #479).
 *
 * Avoids loading `@sentry/electron/main` directly — init is injected via
 * the deps parameter so we never actually hit the real SDK (which would
 * try to patch unhandled exception handlers and crash Jest).
 */

import Database from "better-sqlite3";
import * as path from "path";
import { applySchema } from "../../db/migrate";
import { setSetting } from "../../db/settings";
import {
  initCrashReporter,
  isCrashReportingEnabled,
  setCrashReportingEnabled,
  scrubEvent,
  SENTRY_ENABLED_KEY,
} from "../../crash-reporter/index";
import type { ErrorEvent } from "@sentry/core";

const SCHEMA_PATH = path.join(__dirname, "../../db/schema.sql");

function openTestDb(): Database.Database {
  const db = new Database(":memory:");
  applySchema(db, SCHEMA_PATH);
  return db;
}

describe("isCrashReportingEnabled / setCrashReportingEnabled", () => {
  test("defaults to enabled when no setting row exists", () => {
    const db = openTestDb();
    expect(isCrashReportingEnabled(db)).toBe(true);
  });

  test("returns false only when explicitly set to 'false'", () => {
    const db = openTestDb();
    setSetting(db, SENTRY_ENABLED_KEY, "false");
    expect(isCrashReportingEnabled(db)).toBe(false);
  });

  test("any other value is treated as enabled (forward compatibility)", () => {
    const db = openTestDb();
    setSetting(db, SENTRY_ENABLED_KEY, "true");
    expect(isCrashReportingEnabled(db)).toBe(true);
    setSetting(db, SENTRY_ENABLED_KEY, "1");
    expect(isCrashReportingEnabled(db)).toBe(true);
  });

  test("setCrashReportingEnabled writes 'true' / 'false' strings", () => {
    const db = openTestDb();
    setCrashReportingEnabled(db, false);
    expect(isCrashReportingEnabled(db)).toBe(false);
    setCrashReportingEnabled(db, true);
    expect(isCrashReportingEnabled(db)).toBe(true);
  });
});

describe("initCrashReporter", () => {
  test("skips init when setting is disabled", () => {
    const db = openTestDb();
    setCrashReportingEnabled(db, false);
    const spy = jest.fn();
    const log = jest.fn();
    const ran = initCrashReporter(db, {
      sentryInit: spy,
      dsn: "https://public@example.ingest.sentry.io/1",
      log,
    });
    expect(ran).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/disabled/i));
  });

  test("skips init when DSN is not provided", () => {
    const db = openTestDb();
    const spy = jest.fn();
    const log = jest.fn();
    const prev = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    try {
      const ran = initCrashReporter(db, { sentryInit: spy, log });
      expect(ran).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/SENTRY_DSN not set/));
    } finally {
      if (prev !== undefined) process.env.SENTRY_DSN = prev;
    }
  });

  test("calls sentryInit with DSN, release, environment, sample rate, and beforeSend", () => {
    const db = openTestDb();
    const spy = jest.fn();
    const ran = initCrashReporter(db, {
      sentryInit: spy,
      dsn: "https://public@example.ingest.sentry.io/1",
      release: "1.2.3",
      environment: "staging",
      log: () => void 0,
    });
    expect(ran).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const opts = spy.mock.calls[0][0];
    expect(opts.dsn).toBe("https://public@example.ingest.sentry.io/1");
    expect(opts.release).toBe("1.2.3");
    expect(opts.environment).toBe("staging");
    expect(opts.tracesSampleRate).toBe(0.05);
    expect(typeof opts.beforeSend).toBe("function");
  });

  test("beforeSend passed to sentryInit is the scrubber", () => {
    const db = openTestDb();
    const spy = jest.fn();
    initCrashReporter(db, {
      sentryInit: spy,
      dsn: "https://public@example.ingest.sentry.io/1",
      release: "1.0.0",
      log: () => void 0,
    });
    const beforeSend = spy.mock.calls[0][0].beforeSend as (ev: ErrorEvent) => ErrorEvent | null;
    const event: ErrorEvent = { type: undefined,
      request: { data: { customer_id: "CUST-1", national_id: "123" } },
    };
    const out = beforeSend(event);
    expect(out?.request?.data).toBeUndefined();
  });

  test("reads DSN from SENTRY_DSN env when not overridden", () => {
    const db = openTestDb();
    const spy = jest.fn();
    const prev = process.env.SENTRY_DSN;
    process.env.SENTRY_DSN = "https://env-dsn@example.ingest.sentry.io/2";
    try {
      initCrashReporter(db, { sentryInit: spy, release: "1.0.0", log: () => void 0 });
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].dsn).toBe("https://env-dsn@example.ingest.sentry.io/2");
    } finally {
      if (prev === undefined) delete process.env.SENTRY_DSN;
      else process.env.SENTRY_DSN = prev;
    }
  });
});

describe("scrubEvent", () => {
  test("drops request.data in its entirety", () => {
    const ev: ErrorEvent = { type: undefined,
      request: { data: { anything: "here", national_id: "X" } },
    };
    const out = scrubEvent(ev);
    expect(out?.request?.data).toBeUndefined();
  });

  test("drops request.cookies", () => {
    const ev: ErrorEvent = { type: undefined, request: { cookies: { session: "abc" } } };
    const out = scrubEvent(ev);
    expect(out?.request?.cookies).toBeUndefined();
  });

  test("drops authorization + cookie headers (case-insensitive)", () => {
    const ev: ErrorEvent = { type: undefined,
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

  test("strips sensitive tags (customer_id, national_id, phone, voucher_code)", () => {
    const ev: ErrorEvent = { type: undefined,
      tags: {
        customer_id: "CUST-1",
        national_id: "29001010101010",
        phone: "01012345678",
        voucher_code: "SUMMER2026",
        branch: "cairo-main",
      },
    };
    const out = scrubEvent(ev);
    const tags = out?.tags as Record<string, string>;
    expect(tags.customer_id).toBeUndefined();
    expect(tags.national_id).toBeUndefined();
    expect(tags.phone).toBeUndefined();
    expect(tags.voucher_code).toBeUndefined();
    expect(tags.branch).toBe("cairo-main");
  });

  test("strips sensitive extras (password, token, refresh_token, device_private_key)", () => {
    const ev: ErrorEvent = { type: undefined,
      extra: {
        password: "hunter2",
        token: "jwt-abc",
        refresh_token: "rt-xyz",
        device_private_key: "ed25519-base64",
        unrelated_flag: true,
      },
    };
    const out = scrubEvent(ev);
    const extra = out?.extra as Record<string, unknown>;
    expect(extra.password).toBeUndefined();
    expect(extra.token).toBeUndefined();
    expect(extra.refresh_token).toBeUndefined();
    expect(extra.device_private_key).toBeUndefined();
    expect(extra.unrelated_flag).toBe(true);
  });

  test("scrubs user identifiers (email, ip_address, username) but keeps id", () => {
    const ev: ErrorEvent = { type: undefined,
      user: {
        id: "terminal-42",
        email: "pharmacist@example.com",
        ip_address: "10.0.0.1",
        username: "pharma_01",
      },
    };
    const out = scrubEvent(ev);
    expect(out?.user?.id).toBe("terminal-42");
    expect(out?.user?.email).toBeUndefined();
    expect(out?.user?.ip_address).toBeUndefined();
    expect(out?.user?.username).toBeUndefined();
  });

  test("leaves safe fields (message, exception frames) untouched", () => {
    const ev: ErrorEvent = { type: undefined,
      message: "boot complete",
      exception: {
        values: [{ type: "Error", value: "ECONNREFUSED" }],
      },
    };
    const out = scrubEvent(ev);
    expect(out?.message).toBe("boot complete");
    expect(out?.exception?.values?.[0]?.value).toBe("ECONNREFUSED");
  });
});
