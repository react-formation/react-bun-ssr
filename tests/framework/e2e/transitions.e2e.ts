import { expect, test } from "@playwright/test";

test.describe("Framework transitions", () => {
  test("restores route content on back/forward navigation", async ({ page }) => {
    await page.goto("/framework-test");

    await page.click("#link-head-a");
    await expect(page).toHaveURL(/\/framework-test\/head-a$/);
    await expect(page.getByRole("heading", { name: "Head A" })).toBeVisible();

    await page.click("#go-head-b");
    await expect(page).toHaveURL(/\/framework-test\/head-b$/);
    await expect(page.getByRole("heading", { name: "Head B" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/framework-test\/head-a$/);
    await expect(page.getByRole("heading", { name: "Head A" })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/framework-test\/head-b$/);
    await expect(page.getByRole("heading", { name: "Head B" })).toBeVisible();
  });

  test("hard-navigates when the transition response is malformed", async ({ page }) => {
    await page.goto("/framework-test");
    await page.evaluate(() => {
      (window as typeof window & { __rbssrProbe?: string }).__rbssrProbe = "alive";
    });

    await page.route("**/__rbssr/transition?*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.searchParams.get("to") === "/framework-test/head-a") {
        await route.fulfill({
          status: 200,
          contentType: "application/x-ndjson",
          body: "not-valid-ndjson",
        });
        return;
      }

      await route.continue();
    });

    await page.click("#link-head-a");
    await expect(page).toHaveURL(/\/framework-test\/head-a$/);
    await expect(page.getByRole("heading", { name: "Head A" })).toBeVisible();
    await expect(page.evaluate(() => (window as typeof window & { __rbssrProbe?: string }).__rbssrProbe ?? null)).resolves.toBeNull();
  });

  test("reuses the prefetched transition payload on click", async ({ page }) => {
    const transitionRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/__rbssr/transition")) {
        transitionRequests.push(request.url());
      }
    });

    await page.goto("/framework-test");
    await page.locator("#prefetch-head-b").hover();

    await expect
      .poll(() => transitionRequests.filter((url) => url.includes("to=%2Fframework-test%2Fhead-b")).length)
      .toBe(1);

    await page.click("#prefetch-head-b");
    await expect(page).toHaveURL(/\/framework-test\/head-b$/);
    await expect(page.getByRole("heading", { name: "Head B" })).toBeVisible();

    await expect
      .poll(() => transitionRequests.filter((url) => url.includes("to=%2Fframework-test%2Fhead-b")).length)
      .toBe(1);
  });

  test("hard-navigates for cross-origin links", async ({ page }) => {
    await page.goto("/framework-test");
    await page.evaluate(() => {
      (window as typeof window & { __rbssrProbe?: string }).__rbssrProbe = "alive";
    });

    await page.click("#cross-origin-link");
    await expect(page).toHaveURL(/http:\/\/localhost:\d+\/framework-test\/head-a$/);
    await expect(page.getByRole("heading", { name: "Head A" })).toBeVisible();
    await expect(page.evaluate(() => (window as typeof window & { __rbssrProbe?: string }).__rbssrProbe ?? null)).resolves.toBeNull();
  });
});
