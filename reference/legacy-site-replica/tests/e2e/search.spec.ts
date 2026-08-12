import { test, expect } from '@playwright/test';

test.describe('Search - Tier 1: Feature Coverage', () => {
  test('Submitting query from search bar redirects to search page', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    
    // Hover on search icon to reveal the dropdown input
    await page.locator('.header-search').first().hover();
    await page.waitForTimeout(200);

    const searchForm = page.locator('.search-field').first();
    await searchForm.fill('sua');
    await searchForm.press('Enter');

    // Should redirect to /search?s=sua
    await expect(page).toHaveURL(/\/search\?s=sua/);
  });

  test('Search results show matching products and services', async ({ page }) => {
    await page.goto('/search?s=sua');
    // Ensure result count is visible and results exist
    const resultCount = page.locator('.woocommerce-result-count');
    await expect(resultCount).toBeVisible();
    
    const results = page.locator('.product-small');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Search handles query with Vietnamese accents and tones', async ({ page }) => {
    await page.goto('/search?s=sữa%20bột');
    const results = page.locator('.product-small');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);

    // Verify title contains matching query
    const titleText = await page.locator('h1.shop-page-title').textContent();
    expect(titleText).toContain('sữa bột');
  });

  test('Search is case-insensitive', async ({ page }) => {
    await page.goto('/search?s=SữA%20BộT');
    const results = page.locator('.product-small');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Search with non-existent query displays fallback message', async ({ page }) => {
    await page.goto('/search?s=nonexistentkeyword12345');
    await expect(page.locator('text=Không tìm thấy sản phẩm hoặc dịch vụ nào phù hợp')).toBeVisible();
  });
});

test.describe('Search - Tier 2: Boundary & Edge Cases', () => {
  test('Empty search query defaults gracefully and shows fallback text or empty results', async ({ page }) => {
    await page.goto('/search?s=');
    const count = await page.locator('.product-small').count();
    expect(count).toBe(0);
    await expect(page.locator('text=Không tìm thấy sản phẩm hoặc dịch vụ nào phù hợp')).toBeVisible();
  });

  test('Wildcard query handling (percent sign %) behaves safely without breaking database', async ({ page }) => {
    const res = await page.goto('/search?s=%');
    expect(res?.status()).toBe(200);
    // SQLite query should escape % and not return all rows or crash
    const count = await page.locator('.product-small').count();
    // Since % is escaped, it should only match products containing '%' character (likely 0)
    expect(count).toBe(0);
  });

  test('Search query with extreme length handles gracefully and does not crash', async ({ page }) => {
    const extremeQuery = 'a'.repeat(300);
    const res = await page.goto(`/search?s=${extremeQuery}`);
    expect(res?.status()).toBe(200);
    const count = await page.locator('.product-small').count();
    expect(count).toBe(0);
  });

  test('Search matches accented products when searching with unaccented tones ( Vietnamese Tone folding )', async ({ page }) => {
    await page.goto('/search?s=sua%20bot');
    const count = await page.locator('.product-small').count();
    expect(count).toBeGreaterThan(0);
  });

  test('Verify search result item URLs are relative and do not link to external giacong.vn absolute domain', async ({ page }) => {
    await page.goto('/search?s=sua');
    const productLinks = await page.locator('.product-small a').all();
    for (const link of productLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        expect(href).not.toContain('https://giacong.vn');
      }
    }
  });
});
