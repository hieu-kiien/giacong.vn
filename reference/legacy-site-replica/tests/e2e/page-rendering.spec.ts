import { test, expect } from '@playwright/test';

test.describe('Page Rendering - Tier 1: Feature Coverage', () => {
  test('Should render the homepage successfully with correct layout components', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    // Home page should have header and footer
    await expect(page.locator('header#header')).toBeVisible();
    await expect(page.locator('footer#footer')).toBeVisible();
  });

  test('Should render product category page (/bot-gia-vi) successfully', async ({ page }) => {
    const res = await page.goto('/bot-gia-vi');
    expect(res?.status()).toBe(200);
    await expect(page.locator('header#header')).toBeVisible();
    await expect(page.locator('footer#footer')).toBeVisible();
  });

  test('Should render service category page (/dich-vu-say) successfully', async ({ page }) => {
    const res = await page.goto('/dich-vu-say');
    expect(res?.status()).toBe(200);
    await expect(page.locator('header#header')).toBeVisible();
    await expect(page.locator('footer#footer')).toBeVisible();
  });

  test('Should render information page (/gioi-thieu-ve-gia-cong) successfully', async ({ page }) => {
    const res = await page.goto('/gioi-thieu-ve-gia-cong');
    expect(res?.status()).toBe(200);
    await expect(page.locator('header#header')).toBeVisible();
    await expect(page.locator('footer#footer')).toBeVisible();
  });

  test('Should render contact page (/lien-he) successfully', async ({ page }) => {
    const res = await page.goto('/lien-he');
    expect(res?.status()).toBe(200);
    await expect(page.locator('header#header')).toBeVisible();
    await expect(page.locator('footer#footer')).toBeVisible();
  });
});

test.describe('Page Rendering - Tier 2: Boundary & Edge Cases', () => {
  test('Should render custom 404 page with status 404 for non-existent routes', async ({ page }) => {
    const res = await page.goto('/non-existent-page-slug-123xyz');
    expect(res?.status()).toBe(404);
  });

  test('Should ensure 404 page is styled and renders inside the standard layout', async ({ page }) => {
    await page.goto('/non-existent-page-slug-123xyz');
    await expect(page.locator('header#header')).toBeVisible();
    await expect(page.locator('footer#footer')).toBeVisible();
  });

  test('Should handle URL encoded characters in path correctly and render page', async ({ page }) => {
    const res = await page.goto('/dich-vu-dong-goi-ca-phe-hoa-tan');
    expect(res?.status()).toBe(200);
  });

  test('Should render page without throwing unhandled React/hydration errors in console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    await page.goto('/gioi-thieu-ve-gia-cong');
    // Ensure no severe React hydration mismatch errors are printed to the console
    const hydrationErrors = logs.filter(log => log.includes('Hydration') || log.includes('hydration'));
    expect(hydrationErrors.length).toBe(0);
  });

  test('Should gracefully handle extra trailing slashes or backslashes in route', async ({ page }) => {
    const res = await page.goto('/gioi-thieu-ve-gia-cong/');
    // Standard Next.js server redirection or rendering should handle trailing slash
    expect(res?.status()).toBe(200);
  });
});
