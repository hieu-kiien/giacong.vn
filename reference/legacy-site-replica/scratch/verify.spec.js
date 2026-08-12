const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Milestone 2 Verification', () => {

  // 1. Custom 404 page
  test('1. Custom 404 page renders correctly on invalid-route', async ({ page }) => {
    console.log('Navigating to /invalid-route...');
    const response = await page.goto('http://localhost:3002/invalid-route');
    
    // Check status is 404
    expect(response.status()).toBe(404);
    console.log('✅ Pass: Received 404 status');

    // Check custom content text
    const bodyText = await page.textContent('body');
    const has404Text = bodyText.includes('404') || bodyText.includes('Không tìm thấy trang') || bodyText.includes('Trang bạn đang tìm kiếm không tồn tại');
    expect(has404Text).toBe(true);
    console.log('✅ Pass: Custom 404 page text renders correctly');
  });

  // 2. SEO assets
  test('2. SEO assets are generated and valid', async () => {
    const robotsPath = path.join(__dirname, '..', 'frontend', 'public', 'robots.txt');
    const sitemapPath = path.join(__dirname, '..', 'frontend', 'public', 'sitemap.xml');
    
    expect(fs.existsSync(robotsPath)).toBe(true);
    expect(fs.existsSync(sitemapPath)).toBe(true);
    console.log('✅ Pass: SEO assets files exist on disk');

    const robotsText = fs.readFileSync(robotsPath, 'utf8');
    expect(robotsText.includes('Allow: /')).toBe(true);
    expect(robotsText.includes('Sitemap: https://giacong.vn/sitemap.xml')).toBe(true);
    console.log('✅ Pass: robots.txt is valid');

    const sitemapText = fs.readFileSync(sitemapPath, 'utf8');
    expect(sitemapText.includes('<loc>https://giacong.vn/</loc>')).toBe(true);
    expect(sitemapText.includes('<urlset')).toBe(true);
    console.log('✅ Pass: sitemap.xml is valid');
  });

  // 3. Form Submit state
  test('3. Form Submit state disabled and shows "Đang gửi..."', async ({ page }) => {
    // Intercept contact API and delay response to capture button state
    await page.route('**/api/contact', async (route) => {
      console.log('[Intercept] Intercepted /api/contact request. Delaying response...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Mocked submit success' }),
      });
      console.log('[Intercept] Fulfilled /api/contact request.');
    });

    console.log('Navigating to /lien-he...');
    await page.goto('http://localhost:3002/lien-he');
    
    // Wait for the form to render
    const formSelector = 'form.wpcf7-form';
    await page.waitForSelector(formSelector);
    
    // Fill form inputs
    await page.fill('input[name="text-508"]', 'Kiểm thử viên');
    await page.fill('input[name="tel-991"]', '0987654321');
    await page.fill('input[name="email-81"]', 'test@giacong.vn');
    await page.fill('textarea[name="textarea-859"]', 'Đây là nội dung gửi thử nghiệm tự động.');
    
    const submitButtonSelector = 'form.wpcf7-form input[type="submit"]';
    const submitButton = page.locator(submitButtonSelector);
    
    const originalValue = await submitButton.getAttribute('value');
    console.log(`Original button value: "${originalValue}"`);

    // Listen for alert so the test doesn't freeze on alert dialog
    page.once('dialog', async dialog => {
      console.log(`[Alert] Dialog message: "${dialog.message()}"`);
      await dialog.dismiss();
    });

    console.log('Submitting the form...');
    // We trigger the click but do not await completion immediately
    const submitPromise = submitButton.click();
    
    // Check submit state immediately (while request is delayed)
    await page.waitForTimeout(500);
    
    const isDisabled = await submitButton.isDisabled();
    const loadingValue = await submitButton.getAttribute('value');
    
    console.log(`Button isDisabled: ${isDisabled}`);
    console.log(`Button current value: "${loadingValue}"`);
    
    expect(isDisabled).toBe(true);
    expect(loadingValue).toBe('Đang gửi...');
    console.log('✅ Pass: Button gets disabled and displays "Đang gửi..." during submission');
    
    // Wait for form submission to complete
    await submitPromise;
    console.log('Form submission completed.');
    
    // Check if button reverted back to original text and is enabled
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    const finalValue = await submitButton.getAttribute('value');
    expect(finalValue).toBe(originalValue);
    console.log('✅ Pass: Button is re-enabled and text reverted to original');
  });

  // 4. Posts pagination
  test('4. Posts pagination displays list and links correctly', async ({ page }) => {
    console.log('Navigating to /tin-tuc...');
    await page.goto('http://localhost:3002/tin-tuc');
    
    // Check if posts are loaded
    await page.waitForSelector('.post-item');
    const postsCount = await page.locator('.post-item').count();
    console.log(`Loaded ${postsCount} posts on the page.`);
    expect(postsCount).toBeGreaterThan(0);
    console.log('✅ Pass: /tin-tuc displays the posts list');
    
    // Check pagination controls
    const paginationSelector = '.woocommerce-pagination';
    expect(await page.locator(paginationSelector).isVisible()).toBe(true);
    console.log('✅ Pass: Pagination controls are visible');
    
    const nextLinkSelector = '.woocommerce-pagination a.next';
    const hasNextLink = await page.locator(nextLinkSelector).isVisible();
    console.log(`Next page link visible: ${hasNextLink}`);
    
    if (hasNextLink) {
      const nextHref = await page.locator(nextLinkSelector).getAttribute('href');
      console.log(`Next page link href: "${nextHref}"`);
      expect(nextHref).toContain('/tin-tuc?page=2');
      console.log('✅ Pass: Pagination controls link correctly to next page');
      
      console.log('Clicking the "Sau »" pagination link...');
      await page.click(nextLinkSelector);
      
      // Wait for load and check new page number
      await page.waitForSelector('.post-item');
      const newUrl = page.url();
      console.log(`Navigated to URL: ${newUrl}`);
      expect(newUrl).toContain('page=2');
      
      const currentPageText = await page.textContent('.woocommerce-pagination .current');
      console.log(`Current page text: "${currentPageText.trim()}"`);
      expect(currentPageText).toContain('Trang 2');
      console.log('✅ Pass: Successfully navigated to page 2 and updated content');
    } else {
      console.log('ℹ️ Info: No Next page link found (possibly last page or single page of posts).');
    }
  });

});
