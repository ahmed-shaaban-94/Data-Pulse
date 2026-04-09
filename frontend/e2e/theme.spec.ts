import { test, expect } from "@playwright/test";

// Theme toggle lives in the sidebar footer. Without a live backend the
// sidebar may not fully hydrate (loading skeletons or missing session
// data prevent the toggle from rendering). Run against staging.
const needsBackend = !!process.env.CI;

test.describe("Theme Toggle", () => {
  test.skip(needsBackend, "requires live API backend — run against staging");

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("theme toggle button exists in sidebar", async ({ page }) => {
    const themeButton = page
      .getByRole("button", { name: /Light Mode|Dark Mode/i });
    await expect(themeButton).toBeVisible({ timeout: 10000 });
  });

  test("clicking toggle switches theme class on html element", async ({ page }) => {
    await expect(page.locator("html")).toHaveClass(/dark/);

    const themeButton = page.getByRole("button", { name: /Light Mode/i });
    await expect(themeButton).toBeVisible({ timeout: 10000 });
    await themeButton.click();

    await expect(page.locator("html")).toHaveClass(/light/);

    await expect(
      page.getByRole("button", { name: /Dark Mode/i })
    ).toBeVisible();
  });

  test("theme persists when navigating to a different page", async ({ page }) => {
    const themeButton = page.getByRole("button", { name: /Light Mode/i });
    await expect(themeButton).toBeVisible({ timeout: 10000 });
    await themeButton.click();
    await expect(page.locator("html")).toHaveClass(/light/);

    await page.getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL(/\/products/);

    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(
      page.getByRole("button", { name: /Dark Mode/i })
    ).toBeVisible();
  });
});
