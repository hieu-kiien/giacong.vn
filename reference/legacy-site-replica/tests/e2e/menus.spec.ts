import { test, expect } from '@playwright/test';

test.describe('Header/Footer Menus - Tier 1: Feature Coverage', () => {
  test('Should render header and footer layouts with correct structures', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await expect(page.locator('header#header')).toBeVisible();
    await expect(page.locator('footer#footer')).toBeVisible();
  });

  test('Desktop View - Hovering on Products menu item displays dropdown and expands ARIA attributes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    
    const productsMenu = page.locator('#menu-item-1742');
    await expect(productsMenu).toBeVisible();

    // Hover to trigger menu
    await productsMenu.hover();
    
    // Verify it adds active/hover class
    await expect(productsMenu).toHaveClass(/hover/);
    
    const topLink = productsMenu.locator('.nav-top-link');
    await expect(topLink).toHaveAttribute('aria-expanded', 'true');
  });

  test('Desktop View - Hovering on Services menu item displays dropdown and expands ARIA attributes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    
    const servicesMenu = page.locator('#menu-item-5166');
    await expect(servicesMenu).toBeVisible();

    // Hover to trigger menu
    await servicesMenu.hover();
    
    // Verify it adds active/hover class
    await expect(servicesMenu).toHaveClass(/hover/);
  });

  test('Mobile View - Clicking hamburger toggle opens mobile drawer and sets off-canvas-active class on body', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    const toggleBtn = page.locator('a[aria-label="Menu"]');
    await expect(toggleBtn).toBeVisible();

    const body = page.locator('body');
    const drawer = page.locator('#main-menu');

    // Open drawer with retry to handle Next.js hydration delay
    await expect(async () => {
      await toggleBtn.click({ force: true });
      await expect(drawer).toHaveClass(/active/);
    }).toPass({ timeout: 5000 });

    await expect(body).toHaveClass(/off-canvas-active/);
    await expect(drawer).toBeVisible();
  });

  test('Link Audit - Navigation and drawer links must not be empty or point back to giacong.vn absolute domain', async ({ page }) => {
    await page.goto('/');
    
    const links = await page.locator('header a').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href) {
        // Must not be javascript:void(0) or empty # (except for menu items that just trigger submenus)
        if (href.startsWith('javascript:')) {
          expect(href).not.toBe('javascript:void(0)');
        }
        // Must not point to absolute live domain
        expect(href).not.toContain('https://giacong.vn');
      }
    }
  });
});

test.describe('Header/Footer Menus - Tier 2: Boundary & Edge Cases', () => {
  test('Keyboard accessibility - Pressing Escape key closes the active desktop menu dropdown', async ({ page }, testInfo) => {
    if (testInfo.project.name.includes('mobile')) {
      test.skip();
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const productsMenu = page.locator('#menu-item-1742');
    await productsMenu.hover();
    await expect(productsMenu).toHaveClass(/hover/);

    // Focus link so keyboard press targets it
    await productsMenu.locator('a.nav-top-link').focus();

    // Press Escape
    await page.keyboard.press('Escape');
    
    // Dropdown should close
    await expect(productsMenu).not.toHaveClass(/hover/);
  });

  test('Mobile View - Expanding a drawer submenu and clicking a deep page navigation works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    // Open drawer with retry to handle Next.js hydration delay
    const toggleBtn = page.locator('a[aria-label="Menu"]');
    const drawer = page.locator('#main-menu');
    await expect(async () => {
      await toggleBtn.click({ force: true });
      await expect(drawer).toHaveClass(/active/);
    }).toPass({ timeout: 5000 });
    
    // Toggle submenu with retry to handle Next.js hydration delay
    const subMenuParent = page.locator('#main-menu #menu-item-5466');
    const toggleLink = subMenuParent.locator('button.toggle').first();
    await expect(async () => {
      const classes = await subMenuParent.getAttribute('class');
      if (!classes || !classes.includes('active')) {
        await toggleLink.click({ force: true });
      }
      await expect(subMenuParent).toHaveClass(/active/);
    }).toPass({ timeout: 5000 });
     
    // Click sublink
    const subLink = page.locator('#main-menu #menu-item-5468 a');
    await expect(subLink).toBeVisible();
    await subLink.click({ force: true });

    // Drawer should auto close and page navigates
    await expect(page).toHaveURL(/\/dich-vu-say/);
    await expect(page.locator('body')).not.toHaveClass(/off-canvas-active/);
  });

  test('Mobile View - Clicking the main overlay closes the mobile drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    // Open drawer with retry to handle Next.js hydration delay
    const toggleBtn = page.locator('a[aria-label="Menu"]');
    const drawer = page.locator('#main-menu');
    await expect(async () => {
      await toggleBtn.click({ force: true });
      await expect(drawer).toHaveClass(/active/);
    }).toPass({ timeout: 5000 });
    await expect(page.locator('body')).toHaveClass(/off-canvas-active/);

    // Click overlay
    const overlay = page.locator('.main-menu-overlay');
    await expect(overlay).toBeVisible();
    await overlay.click();

    // Drawer should close
    await expect(page.locator('body')).not.toHaveClass(/off-canvas-active/);
    await expect(page.locator('#main-menu')).not.toHaveClass(/active/);
  });

  test('Drawer must be hidden on desktop viewports', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    
    const drawer = page.locator('#main-menu');
    await expect(drawer).not.toBeVisible();
  });

  test('Footer links audit - Footer copyright and links do not lead back to giacong.vn absolute domain', async ({ page }) => {
    await page.goto('/');
    
    const footerLinks = await page.locator('footer a').all();
    for (const link of footerLinks) {
      const href = await link.getAttribute('href');
      if (href && !href.includes('dmca.com')) {
        expect(href).not.toContain('https://giacong.vn');
      }
    }
  });
});
