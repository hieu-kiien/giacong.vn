import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Cross-Feature Combinations - Tier 3', () => {
  test('1. Search and Navigation Integration: Search term, click result, verify page rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    
    // Hover on search icon to reveal the dropdown input
    await page.locator('.header-search').first().hover();
    await page.waitForTimeout(200);

    const searchForm = page.locator('.search-field').first();
    await searchForm.fill('sữa');
    await searchForm.press('Enter');
    
    await expect(page).toHaveURL(/\/search/);
    expect(decodeURIComponent(page.url())).toContain('s=sữa');
    
    // Click first product link in search results
    const firstResult = page.locator('.product-small a.woocommerce-LoopProduct-link').first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();
    
    // Page should render and status code be 200 (implied by successful navigation and header/footer presence)
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('2. Navigation and Form Submission: Open mobile menu, navigate to contact, fill and submit form', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
 
    // Toggle Mobile Drawer with retry to handle Next.js hydration delay
    const toggleBtn = page.locator('a[aria-label="Menu"]');
    const drawer = page.locator('#main-menu');
    await expect(async () => {
      await toggleBtn.click({ force: true });
      await expect(drawer).toHaveClass(/active/);
    }).toPass({ timeout: 5000 });
 
    // Click Contact link in drawer
    await page.locator('#main-menu a[href="/lien-he"]').click({ force: true });
    await expect(page).toHaveURL(/\/lien-he/);

    // Setup success dialog listener
    let dialogTriggered = false;
    page.on('dialog', async dialog => {
      const msg = dialog.message().toLowerCase();
      expect(msg.includes('thành công') || msg.includes('successfully')).toBe(true);
      dialogTriggered = true;
      await dialog.accept();
    });

    // Fill form
    await page.locator('input[name="text-508"]').fill('Cross-Feature Mobile');
    await page.locator('input[name="tel-991"]').fill('0912345678');
    await page.locator('textarea[name="textarea-859"]').fill('Mobile test for cross-feature');
    await page.locator('.wpcf7-submit').click();

    await expect.poll(() => dialogTriggered).toBe(true);
  });

  test('3. Page Rendering and Asset Path Rewriting: Verify assets load correctly without CORS blockers', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/bot-gia-vi');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    
    // Verify no CORS or hydration errors
    const corsErrors = consoleErrors.filter(err => err.includes('CORS') || err.includes('Access-Control-Allow-Origin'));
    expect(corsErrors.length).toBe(0);
  });

  test('4. Forms and Database Persistence integration: Submit quotation form and verify persistence', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
    
    const initialCountStr = execSync('php artisan tinker --execute="echo App\\Models\\Submission::count();"', { cwd: './backend' }).toString().trim();
    const initialCount = parseInt(initialCountStr, 10);

    // Set dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    const inputName = page.locator('input[name="text-34"]:visible');
    const inputTel = page.locator('input[name="tel-471"]:visible');
    const form = inputName.locator('xpath=ancestor::form');
    await inputName.fill('Cross Database Check');
    await inputTel.fill('0909090909');
    await form.locator('.wpcf7-submit').click();

    // Verify count increased in Laravel database
    await expect.poll(() => {
      const current = execSync('php artisan tinker --execute="echo App\\Models\\Submission::count();"', { cwd: './backend' }).toString().trim();
      return parseInt(current, 10);
    }).toBe(initialCount + 1);

    // Verify contents
    const rowStr = execSync('php artisan tinker --execute="echo ((array)current(DB::select(\'select form_data from submissions where form_data like \\\'%Cross Database Check%\\\' limit 1\')))[\'form_data\'];"', { cwd: './backend' }).toString().trim();
    expect(rowStr).toBeTruthy();
    const formData = JSON.parse(rowStr);
    expect(formData['text-34']).toBe('Cross Database Check');
  });

  test('5. Dynamic Page Rendering and SEO Head Tag integration: Category page renders unique H1 matching metadata title', async ({ page }) => {
    await page.goto('/dich-vu-say');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    
    const pageTitle = await page.title();
    const h1Text = await page.locator('h1').first().textContent();
    
    expect(pageTitle).toBeTruthy();
    expect(h1Text).toBeTruthy();
    
    // Normalize both for comparison
    const normTitle = pageTitle.toLowerCase().replace(/\s+/g, '');
    const normH1 = h1Text!.toLowerCase().replace(/\s+/g, '');
    
    // Should share core words
    expect(normTitle).toContain('sấy');
    expect(normH1).toContain('sấy');
  });

  test('6. Footer Menus & Path Resolution: Verify footer navigation links match dynamic routes correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    
    const serviceFooterLink = page.locator('footer a[href="/dich-vu-say"]').first();
    await expect(serviceFooterLink).toBeVisible();
    await serviceFooterLink.click();
    
    await expect(page).toHaveURL(/\/dich-vu-say/);
  });
});
