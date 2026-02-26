import { expect, test } from "@playwright/test";

test.describe("Documentation app", () => {
  test("renders docs home and search UI", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/docs\/getting-started\/introduction$/);
    await expect(page.locator("h1").first()).toContainText("Introduction");

    await page.fill("#docs-search", "loader");
    await expect(page.locator("#docs-search")).toHaveValue("loader");

    const response = await page.request.get("/api/search");
    expect(response.status()).toBe(200);
  });

  test("supports docs deep link", async ({ page }) => {
    await page.goto("/docs/core-concepts/loaders");
    await expect(page.locator(".docs-hero h1")).toContainText("Loaders and data flow");
    await expect(page.getByRole("heading", { name: "Return values" })).toBeVisible();
  });

  test("navigates internal docs links without a full page reload", async ({ page }) => {
    await page.goto("/docs/getting-started/introduction");
    const before = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    const historyBefore = await page.evaluate(() => window.history.length);

    await page.getByRole("link", { name: "Loaders and data flow" }).first().click();
    await expect(page).toHaveURL(/\/docs\/core-concepts\/loaders$/);
    await expect(page.locator(".docs-hero h1")).toContainText("Loaders and data flow");

    const after = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    const historyAfter = await page.evaluate(() => window.history.length);
    expect(after).toBe(before);
    expect(historyAfter).toBe(historyBefore + 1);
  });

  test("supports programmatic soft navigation via useRouter", async ({ page }) => {
    await page.goto("/router-playground");
    await expect(page.getByRole("heading", { name: "Router playground" })).toBeVisible();
    const before = await page.evaluate(() => performance.getEntriesByType("navigation").length);

    await page.click("#router-push-loaders");
    await expect(page).toHaveURL(/\/docs\/core-concepts\/loaders$/);
    await expect(page.locator(".docs-hero h1")).toContainText("Loaders and data flow");

    const after = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    expect(after).toBe(before);
  });

  test("supports programmatic replace navigation without adding history entries", async ({ page }) => {
    await page.goto("/router-playground");
    await expect(page.getByRole("heading", { name: "Router playground" })).toBeVisible();

    const beforeNavigationEntries = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    const beforeHistoryLength = await page.evaluate(() => window.history.length);

    await page.click("#router-replace-actions");
    await expect(page).toHaveURL(/\/docs\/core-concepts\/actions$/);
    await expect(page.locator(".docs-hero h1")).toContainText("Actions and mutation flow");

    const afterNavigationEntries = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    const afterHistoryLength = await page.evaluate(() => window.history.length);
    expect(afterNavigationEntries).toBe(beforeNavigationEntries);
    expect(afterHistoryLength).toBe(beforeHistoryLength);
  });

  test("announces client transitions for assistive technology", async ({ page }) => {
    await page.goto("/docs/getting-started/introduction");

    const announcer = page.locator("#__rbssr-route-announcer");

    await page.getByRole("link", { name: "Loaders and data flow" }).first().click();
    await expect(page).toHaveURL(/\/docs\/core-concepts\/loaders$/);
    await expect
      .poll(async () => (await announcer.getAttribute("aria-live")) ?? "")
      .toBe("assertive");
    await expect
      .poll(async () => (await announcer.textContent()) ?? "")
      .toContain("Loaders and data flow");
  });

  test("serves not found page", async ({ page }) => {
    const response = await page.goto("/missing-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("text=Documentation page not found.")).toBeVisible();
  });
});
