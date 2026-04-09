import { test, expect } from "@playwright/test";

const needsBackend = !!process.env.CI;

test.describe("Dashboard - Executive Overview", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("page loads with title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Executive Overview");
  });

  test("KPI cards are visible", async ({ page }) => {
    test.skip(needsBackend, "requires live API backend — run against staging");
    const kpiCards = page.locator("[data-testid='kpi-card']");
    const kpiSection = kpiCards.or(page.locator("text=Net Sales").first());
    await expect(kpiSection).toBeVisible({ timeout: 15000 });
  });

  test("trend charts render", async ({ page }) => {
    test.skip(needsBackend, "requires live API backend — run against staging");
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("filter bar is present", async ({ page }) => {
    test.skip(needsBackend, "requires live API backend — run against staging");
    await expect(page.getByText("7D").or(page.getByText("30D")).first()).toBeVisible();
  });

  test("Print Report link exists", async ({ page }) => {
    const printLink = page.getByRole("link", { name: "Print Report" });
    await expect(printLink).toBeVisible({ timeout: 10000 });
    await expect(printLink).toHaveAttribute("href", "/dashboard/report");
  });
});
