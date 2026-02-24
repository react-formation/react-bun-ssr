import { expect, test } from "@playwright/test";

test.describe("SSR framework smoke", () => {
  test("renders and hydrates the home route", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1").first()).toContainText("Bun SSR");
    await page.getByRole("button", { name: "Hydrated counter" }).click();
    await expect(page.locator(".row span")).toHaveText("1");

    const response = await page.request.get("/api/hello");
    expect(response.status()).toBe(200);
    await expect(page.locator("text=Try API route:")).toBeVisible();
  });

  test("supports dynamic routes", async ({ page }) => {
    await page.goto("/posts/first-post");
    await expect(page.locator("text=Dynamic param id = first-post")).toBeVisible();
  });

  test("serves not found page", async ({ page }) => {
    const response = await page.goto("/missing-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("text=404")).toBeVisible();
  });
});
