import { expect, test } from '@playwright/test';
import { toAbsoluteUrl } from '../app/lib/site.ts';

test.describe('Documentation app', () => {
  test('renders docs home and search UI', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/docs$/);
    await expect(
      page.getByRole('heading', { name: /Server-rendered React on Bun/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Search documentation/i }).click();
    await page.fill('#docs-search', 'loaders');
    await expect(page.locator('#docs-search')).toHaveValue('loaders');
    await expect(
      page.getByRole('link', { name: /Loaders/i }).first(),
    ).toBeVisible();

    const response = await page.request.get('/api/search');
    expect(response.status()).toBe(200);
  });

  test('supports docs deep link', async ({ page }) => {
    await page.goto('/docs/data/loaders');
    await expect(page.locator('.docs-hero h1')).toContainText('Loaders');
    await expect(
      page.getByRole('heading', { name: 'Return model' }),
    ).toBeVisible();
  });

  test('navigates internal docs links without a full page reload', async ({
    page,
  }) => {
    await page.goto('/docs/start/overview');
    const before = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    const historyBefore = await page.evaluate(() => window.history.length);

    await page
      .getByRole('link', { name: 'File-Based Routing' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/docs\/routing\/file-based-routing$/);
    await expect(page.locator('.docs-hero h1')).toContainText(
      'File-Based Routing',
    );

    const after = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    const historyAfter = await page.evaluate(() => window.history.length);
    expect(after).toBe(before);
    expect(historyAfter).toBe(historyBefore + 1);
  });

  test('supports programmatic soft navigation via useRouter', async ({
    page,
  }) => {
    await page.goto('/router-playground');
    await expect(
      page.getByRole('heading', { name: 'Router playground' }),
    ).toBeVisible();
    const before = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );

    await page.click('#router-push-loaders');
    await expect(page).toHaveURL(/\/docs\/data\/loaders$/);
    await expect(page.locator('.docs-hero h1')).toContainText('Loaders');

    const after = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    expect(after).toBe(before);
  });

  test('supports programmatic replace navigation without adding history entries', async ({
    page,
  }) => {
    await page.goto('/router-playground');
    await expect(
      page.getByRole('heading', { name: 'Router playground' }),
    ).toBeVisible();

    const beforeNavigationEntries = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    const beforeHistoryLength = await page.evaluate(
      () => window.history.length,
    );

    await page.click('#router-replace-actions');
    await expect(page).toHaveURL(/\/docs\/data\/actions$/);
    await expect(page.locator('.docs-hero h1')).toContainText('Actions');

    const afterNavigationEntries = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    const afterHistoryLength = await page.evaluate(() => window.history.length);
    expect(afterNavigationEntries).toBe(beforeNavigationEntries);
    expect(afterHistoryLength).toBe(beforeHistoryLength);
  });

  test('announces client transitions for assistive technology', async ({
    page,
  }) => {
    await page.goto('/docs/start/overview');

    const announcer = page.locator('#__rbssr-route-announcer');

    await page
      .getByRole('link', { name: 'File-Based Routing' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/docs\/routing\/file-based-routing$/);
    await expect
      .poll(async () => (await announcer.getAttribute('aria-live')) ?? '')
      .toBe('assertive');
    await expect
      .poll(async () => (await announcer.textContent()) ?? '')
      .toContain('File-Based Routing');
  });

  test('serves not found page', async ({ page }) => {
    const response = await page.goto('/missing-page');
    expect(response?.status()).toBe(404);
    await expect(page.locator('text=Page not found.')).toBeVisible();
  });

  test('renders the blog index and launch article', async ({ page }) => {
    await page.goto('/blog');
    await expect(
      page.getByRole('heading', { name: /Building a Bun-native React SSR /i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: /Why I Built a Bun-Native SSR Framework/i,
      }),
    ).toBeVisible();

    await page
      .getByRole('link', { name: /Why I Built a Bun-Native SSR Framework/i })
      .first()
      .click();
    await expect(page).toHaveURL(
      /\/blog\/why-i-built-a-bun-native-ssr-framework$/,
    );
    await expect(page.locator('.docs-hero h1')).toContainText(
      'Why I Built a Bun-Native SSR Framework as an Alternative to Next.js and Remix',
    );
    await expect(page.locator('text=gaudiauj')).toBeVisible();
    await expect(page.locator('text=March 1, 2026')).toBeVisible();
    await expect(page.locator('text=min read')).toBeVisible();

    const canonicalHref = await page
      .locator('link[rel=\"canonical\"]')
      .getAttribute('href');
    expect(canonicalHref).toBe(
      toAbsoluteUrl('/blog/why-i-built-a-bun-native-ssr-framework'),
    );
    await expect(page.locator('#docs-sidebar')).toHaveCount(0);
  });

  test('opens docs search from the blog and navigates to docs results', async ({
    page,
  }) => {
    await page.goto('/blog');

    await page.getByRole('button', { name: /Search documentation/i }).click();
    await expect(page.locator('#docs-search')).toBeVisible();
    await page.fill('#docs-search', 'middleware');
    await expect(page.getByRole('link', { name: /Middleware/i }).first()).toBeVisible();

    await page.getByRole('link', { name: /Middleware/i }).first().click();
    await expect(page).toHaveURL(/\/docs\/routing\/middleware$/);
    await expect(page.locator('.docs-hero h1')).toContainText('Middleware');
  });
});
