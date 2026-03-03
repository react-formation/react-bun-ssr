import { expect, test } from "@playwright/test";

test.describe("Framework deferred routes", () => {
  test("renders the immediate shell before the deferred value settles", async ({ page }) => {
    await page.goto("/framework-test");
    const before = await page.evaluate(() => performance.getEntriesByType("navigation").length);

    await page.click("#deferred-link");
    await expect(page).toHaveURL(/\/framework-test\/deferred$/);
    await expect(page.getByRole("heading", { name: "Deferred route" })).toBeVisible();
    await expect(page.locator("#deferred-immediate")).toHaveText("shell-ready");
    await expect(page.locator("#deferred-fallback")).toBeVisible();

    const after = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    expect(after).toBe(before);
  });

  test("replaces the deferred fallback with the resolved value", async ({ page }) => {
    await page.goto("/framework-test/deferred");

    await expect(page.locator("#deferred-resolved")).toHaveText("slow-settled");
    await expect(page.locator("#deferred-fallback")).toHaveCount(0);
  });

  test("rejected deferred content produces the expected boundary behavior", async ({ page }) => {
    await page.goto("/framework-test");
    const before = await page.evaluate(() => performance.getEntriesByType("navigation").length);

    await page.click("#deferred-reject-link");
    await expect(page).toHaveURL(/\/framework-test\/deferred-reject$/);
    await expect(page.getByRole("heading", { name: "Deferred rejection route" })).toBeVisible();
    await expect(page.locator("#deferred-immediate")).toHaveText("shell-ready");
    await expect(page.locator("#deferred-fallback")).toBeVisible();
    await expect(page.locator("#deferred-rejected")).toHaveText("deferred-rejected");
    await expect(page.locator("#deferred-fallback")).toHaveCount(0);

    const after = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    expect(after).toBe(before);
  });
});
