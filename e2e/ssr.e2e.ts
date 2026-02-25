import { expect, test } from "@playwright/test";

test.describe("Documentation app", () => {
  test("renders docs home and search UI", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/docs\/getting-started\/introduction$/);
    await expect(page.locator("h1").first()).toContainText("Introduction");

    await page.fill("#docs-search", "loader");
    await expect(page.locator(".search-result-item").first()).toContainText("Loaders and data flow");

    const response = await page.request.get("/api/search");
    expect(response.status()).toBe(200);
  });

  test("supports docs deep link", async ({ page }) => {
    await page.goto("/docs/core-concepts/loaders");
    await expect(page.locator("h1")).toContainText("Loaders and data flow");
    await expect(page.locator("text=Return values")).toBeVisible();
  });

  test("serves not found page", async ({ page }) => {
    const response = await page.goto("/missing-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("text=Documentation page not found.")).toBeVisible();
  });
});
