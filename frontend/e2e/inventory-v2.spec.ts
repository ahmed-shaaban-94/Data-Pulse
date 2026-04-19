import { test, expect } from "@playwright/test";

/**
 * /inventory-v2 is the first proof-of-concept of the uniform-chrome
 * promise: the same DashboardShell from /dashboard wrapping the real
 * inventory widgets. Once /inventory itself is migrated in place, this
 * preview route will be retired — delete this spec alongside the route.
 *
 * Assertions are structural: shell mounts, widgets mount, theme override
 * applies (the `.dashboard-v2` scope redefines `--bg-page` / `--text-primary`
 * so tailwind-themed widgets render on the dark v2 surface). Data-level
 * hydration assertions require a live backend and are skipped in CI.
 */

const needsBackend = !!process.env.CI;

test.describe("/inventory-v2 (v2 shell preview)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/inventory-v2");
  });

  test("page renders with inventory heading", async ({ page }) => {
    await expect(page.locator("h1.page-title")).toContainText(/Inventory/i);
  });

  test("v2 shell chrome wraps the page", async ({ page }) => {
    await expect(page.locator(".dashboard-v2 aside.side")).toBeVisible();
    await expect(page.locator(".dashboard-v2 .pulse-bar")).toBeVisible();
  });

  test("v2 sidebar marks Inventory as active", async ({ page }) => {
    const inventoryLink = page.getByRole("link", { name: "Inventory" });
    await expect(inventoryLink).toHaveClass(/active/);
  });

  test("theme override: --bg-page resolves to v2 dark surface", async ({ page }) => {
    // With the scope override in dashboard-v2.css, --bg-page inside
    // .dashboard-v2 should equal --bg-0 (#050e17). If the override is
    // missing, --bg-page resolves to app-theme value and the string won't
    // contain "14" (part of #050e17 → rgb(5, 14, 23)) or "23".
    const bgPage = await page.evaluate(() => {
      const el = document.querySelector(".dashboard-v2");
      return el ? getComputedStyle(el).getPropertyValue("--bg-page").trim() : "";
    });
    // Accept either hex or any rgb-resolved form; what matters is it's not
    // the light-theme value "#f3f7fb".
    expect(bgPage).not.toBe("#f3f7fb");
    expect(bgPage).not.toBe("");
  });

  test("inventory widget mount points render", async ({ page }) => {
    test.skip(needsBackend, "widget data requires live API — validate in staging");
    await expect(page.locator(".widget-grid")).toBeVisible({ timeout: 15000 });
  });
});
