import { expect, test } from "@playwright/test";

test.describe("Framework error transitions", () => {
  test("renders a catch boundary during a soft transition", async ({ page }) => {
    await page.goto("/framework-test");
    await page.click("#catch-link");

    await expect(page).toHaveURL(/\/framework-test\/catch$/);
    await expect(page.getByRole("heading", { name: "Caught boundary" })).toBeVisible();
    await expect(page.locator("#caught-status")).toHaveText("418");
  });

  test("renders an uncaught error boundary during a soft transition", async ({ page }) => {
    await page.goto("/framework-test");
    await page.click("#error-link");

    await expect(page).toHaveURL(/\/framework-test\/error$/);
    await expect(page.getByRole("heading", { name: "Error boundary" })).toBeVisible();
    await expect(page.locator("#error-message")).toContainText("framework-test-boom");
  });

  test("renders a route-level not found boundary during a soft transition", async ({ page }) => {
    await page.goto("/framework-test");
    await page.click("#not-found-link");

    await expect(page).toHaveURL(/\/framework-test\/not-found$/);
    await expect(page.getByRole("heading", { name: "Route-level not found" })).toBeVisible();
    await expect(page.locator("#route-not-found")).toContainText("Missing framework-test route data.");
  });

  test("lands on the redirect target when a transition loader redirects", async ({ page }) => {
    await page.goto("/framework-test");
    await page.click("#redirect-link");
    await expect(page).toHaveURL(/\/framework-test\/redirect-target$/);
    await expect(page.getByRole("heading", { name: "Redirect target" })).toBeVisible();
    await expect(page.locator("#redirect-target")).toHaveText("redirect-complete");
  });

  test("announces catch, error, and not-found route changes", async ({ page }) => {
    await page.goto("/framework-test");
    const announcer = page.locator("#__rbssr-route-announcer");

    await page.click("#catch-link");
    await expect(page).toHaveURL(/\/framework-test\/catch$/);
    await expect.poll(async () => (await announcer.textContent()) ?? "").toContain("Caught boundary");

    await page.goto("/framework-test");
    await page.click("#error-link");
    await expect(page).toHaveURL(/\/framework-test\/error$/);
    await expect.poll(async () => (await announcer.textContent()) ?? "").toContain("Error boundary");

    await page.goto("/framework-test");
    await page.click("#not-found-link");
    await expect(page).toHaveURL(/\/framework-test\/not-found$/);
    await expect.poll(async () => (await announcer.textContent()) ?? "").toContain("Route-level not found");
  });
});
