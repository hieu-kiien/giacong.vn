import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Real-World Workloads - Tier 4', () => {
  test('Scenario 1: New Visitor Discovery Flow', async ({ page, isMobile }) => {
    // 1. Visit Home page
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await expect(page.locator('header#header')).toBeVisible();

    // 2. Click on "Về Giacong.vn"
    if (isMobile) {
      const toggleBtn = page.locator('a[aria-label="Menu"]');
      const drawer = page.locator('#main-menu');
      await expect(async () => {
        await toggleBtn.click({ force: true });
        await expect(drawer).toHaveClass(/active/);
      }).toPass({ timeout: 5000 });
      await page.locator('#main-menu a[href="/gioi-thieu-ve-gia-cong"]').click({ force: true });
      await expect(drawer).not.toHaveClass(/active/);
    } else {
      await page.locator('#menu-item-5498 a').click();
    }
    await expect(page).toHaveURL(/\/gioi-thieu-ve-gia-cong/);
    await page.waitForTimeout(1500);

    // 3. Search for "sữa bột"
    if (isMobile) {
      const toggleBtn = page.locator('a[aria-label="Menu"]');
      const drawer = page.locator('#main-menu');
      await expect(async () => {
        await toggleBtn.click({ force: true });
        await expect(drawer).toHaveClass(/active/);
      }).toPass({ timeout: 5000 });
    } else {
      await page.locator('.header-search').first().hover();
      await page.waitForTimeout(200);
    }

    const searchForm = page.locator('.search-field:visible').first();
    await searchForm.fill('sữa bột');
    await searchForm.press('Enter');
    await expect(page).toHaveURL(/\/search/);
    expect(decodeURIComponent(page.url())).toContain('s=sữa bột');

    // 4. Verify search results page metadata
    const pageTitle = await page.title();
    expect(pageTitle).toContain('sữa bột');
  });

  test('Scenario 2: Customer Lead Capture & Verification Flow', async ({ page }) => {
    const initialCountStr = execSync('php artisan tinker --execute="echo App\\Models\\Submission::count();"', { cwd: './backend' }).toString().trim();
    const initialCount = parseInt(initialCountStr, 10);

    // Read log path
    const logPath = path.resolve('backend/storage/logs/laravel.log');
    let initialLogContent = '';
    if (fs.existsSync(logPath)) {
      initialLogContent = fs.readFileSync(logPath, 'utf8');
    }

    // 1. Visit /lien-he
    await page.goto('/lien-he');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');

    // Setup success dialog listener
    let dialogTriggered = false;
    page.on('dialog', async dialog => {
      const msg = dialog.message().toLowerCase();
      expect(msg.includes('thành công') || msg.includes('successfully')).toBe(true);
      dialogTriggered = true;
      await dialog.accept();
    });

    // 2. Fill form
    await page.locator('input[name="text-508"]').fill('Lead Scenario Test');
    await page.locator('input[name="tel-991"]').fill('0912345678');
    await page.locator('input[name="email-81"]').fill('lead@example.com');
    await page.locator('textarea[name="textarea-859"]').fill('Please send quotation for spice processing.');
    await page.locator('.wpcf7-submit').click();

    // 3. Verify dialog trigger
    await expect.poll(() => dialogTriggered).toBe(true);

    // 4. Verify SQLite Database persistence
    const finalCountStr = execSync('php artisan tinker --execute="echo App\\Models\\Submission::count();"', { cwd: './backend' }).toString().trim();
    const finalCount = parseInt(finalCountStr, 10);
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 1);

    const lastRowStr = execSync('php artisan tinker --execute="echo ((array)current(DB::select(\'select form_data from submissions where form_data like \\\'%Lead Scenario Test%\\\' order by id desc limit 1\')))[\'form_data\'];"', { cwd: './backend' }).toString().trim();
    const formData = JSON.parse(lastRowStr);
    expect(formData['text-508']).toBe('Lead Scenario Test');

    // 5. Verify mail trigger output in logs
    await expect.poll(() => {
      const finalLogContent = fs.readFileSync(logPath, 'utf8');
      return finalLogContent.substring(initialLogContent.length);
    }).toContain('Lead Scenario Test');
  });

  test('Scenario 3: Mobile Self-Service Audit Flow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // 1. Visit Homepage
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
 
    // 2. Click Mobile Hamburger Drawer with retry to handle Next.js hydration delay
    const toggleBtn = page.locator('a[aria-label="Menu"]');
    const drawer = page.locator('#main-menu');
    await expect(async () => {
      await toggleBtn.click({ force: true });
      await expect(drawer).toHaveClass(/active/);
    }).toPass({ timeout: 5000 });
 
    // 3. Toggle Submenu with retry to handle Next.js hydration delay
    const subMenuParent = page.locator('#main-menu #menu-item-5466');
    const toggleLink = subMenuParent.locator('button.toggle').first();
    await expect(async () => {
      const classes = await subMenuParent.getAttribute('class');
      if (!classes || !classes.includes('active')) {
        await toggleLink.click({ force: true });
      }
      await expect(subMenuParent).toHaveClass(/active/);
    }).toPass({ timeout: 5000 });
 
    // 4. Navigate to /lien-he
    await page.locator('#main-menu a[href="/lien-he"]').scrollIntoViewIfNeeded();
    await page.locator('#main-menu a[href="/lien-he"]').click();
    await expect(page).toHaveURL(/\/lien-he/);

    // 5. Submit form with missing name to test client-side alert validation
    let dialogMessage = '';
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.locator('input[name="tel-991"]').fill('0987654321');
    await page.locator('.wpcf7-submit').click();

    expect(dialogMessage).toBe('Vui lòng nhập họ và tên của bạn.');
  });

  test('Scenario 4: Referral-tracked Contact Flow', async ({ page }) => {
    // 1. Go to page containing a contact form (about page)
    await page.goto('/gioi-thieu-ve-gia-cong');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    // Intercept POST submit to /api/contact
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('/api/contact') && req.method() === 'POST'),
      (async () => {
        // Accept success dialog
        page.on('dialog', async dialog => {
          await dialog.accept();
        });
        
        // Fill contact form
        await page.locator('input[name="text-508"]:visible').fill('Referral Customer');
        await page.locator('input[name="tel-991"]:visible').fill('0912345678');
        await page.locator('textarea[name="textarea-859"]:visible').fill('Checking referrer tracking path.');
        await page.locator('.wpcf7-submit:visible').click();
      })()
    ]);

    // 2. Verify payload referrer path
    const postData = JSON.parse(request.postData() || '{}');
    expect(postData.path).toBe('/gioi-thieu-ve-gia-cong');
  });

  test('Scenario 5: Cross-Search and In-Page Conversion Flow', async ({ page, isMobile }) => {
    // 1. Search for "sữa bột"
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    // Hover on search icon to reveal input
    if (isMobile) {
      const toggleBtn = page.locator('a[aria-label="Menu"]');
      const drawer = page.locator('#main-menu');
      await expect(async () => {
        await toggleBtn.click({ force: true });
        await expect(drawer).toHaveClass(/active/);
      }).toPass({ timeout: 5000 });
    } else {
      await page.locator('.header-search').first().hover();
      await page.waitForTimeout(200);
    }

    const searchForm = page.locator('.searchform input[name="s"]:visible').first();
    await searchForm.fill('sữa bột');
    await searchForm.press('Enter');
    await expect(page).toHaveURL(/\/search/);
    expect(decodeURIComponent(page.url())).toContain('s=sữa bột');

    // 2. Click on the first result
    const firstResult = page.locator('.product-title a').first();
    await firstResult.click();

    // 3. Check that the product details page renders
    await expect(page.locator('header#header')).toBeVisible();
    await page.waitForTimeout(1500);

    // 4. Click Contact menu link and submit the quote form
    if (isMobile) {
      const toggleBtn = page.locator('a[aria-label="Menu"]');
      const drawer = page.locator('#main-menu');
      await expect(async () => {
        await toggleBtn.click({ force: true });
        await expect(drawer).toHaveClass(/active/);
      }).toPass({ timeout: 5000 });
      await page.locator('#main-menu a[href="/lien-he"]').click({ force: true });
    } else {
      await page.locator('header a[href="/lien-he"]').first().click({ force: true });
    }
    await expect(page).toHaveURL(/\/lien-he/);

    let dialogTriggered = false;
    page.on('dialog', async dialog => {
      dialogTriggered = true;
      await dialog.accept();
    });

    await page.locator('input[name="text-508"]').fill('Search Convert User');
    await page.locator('input[name="tel-991"]').fill('0999888777');
    await page.locator('textarea[name="textarea-859"]').fill('Checking query to contact lead conversion.');
    await page.locator('.wpcf7-submit').click();

    await expect.poll(() => dialogTriggered).toBe(true);
  });
});
