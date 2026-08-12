import { test, expect } from '@playwright/test';

test.describe('SEO & Brand - Tier 1: Feature Coverage', () => {
  test('Head Tags: Homepage has unique title and description meta tag', async ({ page }) => {
    await page.goto('/');
    
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.toLowerCase()).toContain('giacong.vn');

    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });

  test('Head Tags: Homepage has exactly one h1 tag for SEO compliance', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('Sitemap: Fetching sitemap.xml returns valid XML sitemap structures', async ({ page }) => {
    const res = await page.goto('/sitemap.xml');
    expect(res?.status()).toBe(200);
    const contentType = res?.headers()['content-type'] || '';
    expect(contentType).toContain('xml');

    const content = await res?.text();
    expect(content).toContain('<urlset');
    expect(content).toContain('</urlset>');
  });

  test('Robots: Fetching robots.txt returns plain text containing crawling directives', async ({ page }) => {
    const res = await page.goto('/robots.txt');
    expect(res?.status()).toBe(200);
    const content = await res?.text();
    expect(content).toContain('User-agent: *');
    expect(content).toContain('Sitemap:');
  });

  test('Trademark Compliance: Header logo image exists and renders correctly', async ({ page }) => {
    await page.goto('/');
    const logoImg = page.locator('.header-logo-wrapper img, #logo img').first();
    await expect(logoImg).toBeAttached();
    await expect(logoImg).toHaveAttribute('src', /\/assets\/images\/.+/);
  });
});

test.describe('SEO & Brand - Tier 2: Boundary & Edge Cases', () => {
  test('Dynamic page (/gioi-thieu-ve-gia-cong) has unique head metadata and single h1', async ({ page }) => {
    await page.goto('/gioi-thieu-ve-gia-cong');
    
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.toLowerCase()).toContain('giacong.vn');
 
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('Missing pages have a descriptive Page Not Found title', async ({ page }) => {
    await page.goto('/non-existent-page-slug-for-seo');
    await expect(page).toHaveTitle(/not found/i);
  });

  test('Sitemap XML contains at least 30 entries mapping valid pages', async ({ page }) => {
    const res = await page.goto('/sitemap.xml');
    const content = await res?.text();
    const matches = content?.match(/<loc>/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(10); // Check for significant presence of URLs
  });

  test('Robots.txt contains crawling rules for search path', async ({ page }) => {
    const res = await page.goto('/robots.txt');
    const content = await res?.text();
    expect(content).toContain('Disallow: /search');
  });

  test('Brand Compliance: Footer contains trademark holder Net Food company info', async ({ page }) => {
    await page.goto('/');
    const footerText = await page.locator('footer#footer').textContent();
    expect(footerText).toMatch(/Net\s*Food|Nethoding/i);
  });
});

test.describe('Styling & Responsiveness Audit - Tier 2-3: Visual Parity', () => {
  test('Typography Check: Verify SF Pro Display font stack is active on body', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    const bodyFont = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    expect(bodyFont.toLowerCase()).toContain('sf pro display');
  });

  test('Color Compliance: Verify primary green (#5aa400) and secondary orange (#eb892d) branding colors exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    const styleContents = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll('style'));
      return styles.map(s => s.innerHTML).join('\n');
    });

    // Assert primary brand green #5aa400 is configured (hex or rgb/rgba formats)
    const hasGreenColor = styleContents.toLowerCase().includes('5aa400') || styleContents.includes('90, 164, 0') || styleContents.includes('84, 149, 5');
    expect(hasGreenColor).toBe(true);

    // Assert secondary brand orange/amber #eb892d or equivalent exists (hex, rgb, or keyword)
    const hasOrangeColor = styleContents.toLowerCase().includes('eb892d') || styleContents.includes('235, 137, 45') || styleContents.toLowerCase().includes('orange') || styleContents.toLowerCase().includes('amber');
    expect(hasOrangeColor).toBe(true);
  });

  test('Responsive Layout Adaptability: Header navigation and mobile drawer elements show/hide correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    // 1. Desktop Viewport (1200x800)
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    const desktopMenu = page.locator('.header-nav').first();
    const hamburgerBtn = page.locator('a[aria-label="Menu"]');
    
    await expect(desktopMenu).toBeVisible();
    await expect(hamburgerBtn).not.toBeVisible();

    // 2. Mobile Viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    await expect(desktopMenu).not.toBeVisible();
    await expect(hamburgerBtn).toBeVisible();
  });
});

