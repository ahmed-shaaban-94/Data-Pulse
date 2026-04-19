import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "./src/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development",
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production" ? 1.0 : 0,
    debug: false,
    // Strip POS PII (customer_id, national_id, phone, voucher_code, etc.)
    // before the event leaves the browser. Mirrors pos-desktop main-process
    // scrubbing so POS pilot terminals stay safe.
    beforeSend: scrubEvent,
    integrations: [
      // Captures Core Web Vitals (LCP, INP, CLS, FCP, TTFB) and sends them
      // as performance spans to Sentry — visible in the Performance dashboard.
      Sentry.browserTracingIntegration(),
    ],
  });
}
