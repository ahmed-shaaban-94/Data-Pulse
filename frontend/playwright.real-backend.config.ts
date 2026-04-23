/**
 * Playwright config for real-backend API smoke tests (issue #656).
 *
 * Key differences from the standard ``playwright.config.ts``:
 * - No ``webServer`` — tests call the FastAPI directly; no Next.js needed.
 * - No ``globalSetup`` — ``api-smoke.spec.ts`` uses X-API-Key, not session cookies.
 * - No ``storageState`` — not applicable for non-browser tests.
 * - Single project: chromium (used as a context provider; no actual navigation).
 * - ``baseURL`` points at FastAPI (:8000) for convenience, but each test
 *   constructs full URLs from ``E2E_API_URL`` env var.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "api-smoke.spec.ts",
  fullyParallel: false, // keep sequential — tests share one DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["line"]],

  use: {
    baseURL:
      process.env.E2E_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000",
    extraHTTPHeaders: {
      "X-API-Key":
        process.env.E2E_API_KEY ?? "ci-e2e-test-key-for-ci-only",
    },
    // Longer timeout: load-sample inserts 5 000 rows — allow up to 60 s.
    actionTimeout: 60_000,
    navigationTimeout: 60_000,
  },

  timeout: 120_000, // per-test limit

  projects: [
    {
      name: "api",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
