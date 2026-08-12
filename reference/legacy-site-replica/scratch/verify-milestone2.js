const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('=== STARTING EMPIRICAL VERIFICATION ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  let passed = true;

  // 1. Custom 404 Page Check
  try {
    console.log('\n--- 1. Custom 404 page verification ---');
    const response = await page.goto('http://localhost:3002/invalid-route');
    const status = response.status();
    console.log(`Visited /invalid-route. Response status code: ${status}`);
    if (status !== 404) {
      console.error('❌ Fail: Expected status 404 for bad URL');
      passed = false;
    } else {
      console.log('✅ Pass: Received 404 status');
    }

    const title = await page.title();
    console.log(`Page title: "${title}"`);
    const pageText = await page.textContent('body');
    const has404Text = pageText.includes('404') || pageText.includes('Không tìm thấy trang') || pageText.includes('Trang bạn đang tìm kiếm không tồn tại');
    
    if (has404Text) {
      console.log('✅ Pass: Custom 404 page content renders correctly');
    } else {
      console.error('❌ Fail: Custom 404 text not found in response');
      passed = false;
    }
  } catch (err) {
    console.error('❌ Error during 404 test:', err);
    passed = false;
  }

  // 2. SEO Assets Check
  try {
    console.log('\n--- 2. SEO assets verification ---');
    const robotsPath = path.join(__dirname, '..', 'frontend', 'public', 'robots.txt');
    const sitemapPath = path.join(__dirname, '..', 'frontend', 'public', 'sitemap.xml');
    
    const robotsExists = fs.existsSync(robotsPath);
    const sitemapExists = fs.existsSync(sitemapPath);
    
    console.log(`robots.txt exists on disk: ${robotsExists}`);
    console.log(`sitemap.xml exists on disk: ${sitemapExists}`);
    
    if (robotsExists && sitemapExists) {
      console.log('✅ Pass: robots.txt and sitemap.xml exist');
      
      const robotsText = fs.readFileSync(robotsPath, 'utf8');
      if (robotsText.includes('Allow: /') && robotsText.includes('Sitemap: https://giacong.vn/sitemap.xml')) {
        console.log('✅ Pass: robots.txt contents are valid');
      } else {
        console.error('❌ Fail: robots.txt contents invalid');
        passed = false;
      }
      
      const sitemapText = fs.readFileSync(sitemapPath, 'utf8');
      if (sitemapText.includes('<loc>https://giacong.vn/</loc>') && sitemapText.includes('<urlset')) {
        console.log('✅ Pass: sitemap.xml contents are valid');
      } else {
        console.error('❌ Fail: sitemap.xml contents invalid');
        passed = false;
      }
    } else {
      console.error('❌ Fail: SEO assets missing on disk');
      passed = false;
    }
  } catch (err) {
    console.error('❌ Error during SEO assets test:', err);
    passed = false;
  }

  // 3. Form Submit State Check
  try {
    console.log('\n--- 3. Form Submit state verification ---');
    
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
    console.log('Contact form is visible.');

    // Fill form inputs
    await page.fill('input[name="text-508"]', 'Kiểm thử viên');
    await page.fill('input[name="tel-991"]', '0987654321');
    await page.fill('input[name="email-81"]', 'test@giacong.vn');
    await page.fill('textarea[name="textarea-859"]', 'Đây là nội dung gửi thử nghiệm tự động.');
    
    const submitButtonSelector = 'form.wpcf7-form input[type="submit"]';
    const submitButton = await page.locator(submitButtonSelector);
    
    const originalValue = await submitButton.getAttribute('value');
    console.log(`Original button value: "${originalValue}"`);

    // Listen for alert so the test doesn't freeze on alert dialog
    page.once('dialog', async dialog => {
      console.log(`[Alert] Dialog message: "${dialog.message()}"`);
      await dialog.dismiss();
    });

    console.log('Submitting the form...');
    // We trigger the click but do not await navigation/completion immediately
    const submitPromise = submitButton.click();
    
    // Check submit state immediately (while request is delayed)
    await page.waitForTimeout(500);
    
    const isDisabled = await submitButton.isDisabled();
    const loadingValue = await submitButton.getAttribute('value');
    
    console.log(`Button isDisabled: ${isDisabled}`);
    console.log(`Button current value: "${loadingValue}"`);
    
    if (isDisabled && loadingValue === 'Đang gửi...') {
      console.log('✅ Pass: Button gets disabled and displays "Đang gửi..." during submission');
    } else {
      console.error(`❌ Fail: Form submit state mismatch (disabled=${isDisabled}, value="${loadingValue}")`);
      passed = false;
    }
    
    // Wait for click promise to resolve (form submission completes)
    await submitPromise;
    console.log('Form submission completed.');
    
    // Check if button reverted back to original text and is enabled
    const finalDisabled = await submitButton.isDisabled();
    const finalValue = await submitButton.getAttribute('value');
    console.log(`Final button isDisabled: ${finalDisabled}`);
    console.log(`Final button value: "${finalValue}"`);
    
    if (!finalDisabled && finalValue === originalValue) {
      console.log('✅ Pass: Button is re-enabled and text reverted to original');
    } else {
      console.error(`❌ Fail: Button did not reset properly (disabled=${finalDisabled}, value="${finalValue}")`);
      passed = false;
    }
  } catch (err) {
    console.error('❌ Error during Form Submit state test:', err);
    passed = false;
  }

  // 4. Posts Pagination Check
  try {
    console.log('\n--- 4. Posts pagination verification ---');
    console.log('Navigating to /tin-tuc...');
    await page.goto('http://localhost:3002/tin-tuc');
    
    // Check if posts are loaded
    await page.waitForSelector('.post-item');
    const postsCount = await page.locator('.post-item').count();
    console.log(`Loaded ${postsCount} posts on the page.`);
    
    if (postsCount > 0) {
      console.log('✅ Pass: /tin-tuc displays the posts list');
    } else {
      console.error('❌ Fail: No posts found on /tin-tuc page');
      passed = false;
    }
    
    // Check pagination controls
    const paginationSelector = '.woocommerce-pagination';
    const hasPagination = await page.locator(paginationSelector).isVisible();
    console.log(`Pagination controls visible: ${hasPagination}`);
    
    if (hasPagination) {
      console.log('✅ Pass: Pagination controls are visible');
      
      const nextLinkSelector = '.woocommerce-pagination a.next';
      const hasNextLink = await page.locator(nextLinkSelector).isVisible();
      console.log(`Next page link visible: ${hasNextLink}`);
      
      if (hasNextLink) {
        const nextHref = await page.locator(nextLinkSelector).getAttribute('href');
        console.log(`Next page link href: "${nextHref}"`);
        
        if (nextHref && nextHref.includes('/tin-tuc?page=2')) {
          console.log('✅ Pass: Pagination controls link correctly to next page');
          
          console.log('Clicking the "Sau »" pagination link...');
          await page.click(nextLinkSelector);
          
          // Wait for load and check new page number
          await page.waitForSelector('.post-item');
          const newUrl = page.url();
          console.log(`Navigated to URL: ${newUrl}`);
          
          const currentPageText = await page.textContent('.woocommerce-pagination .current');
          console.log(`Current page text: "${currentPageText.trim()}"`);
          
          if (newUrl.includes('page=2') && currentPageText.includes('Trang 2')) {
            console.log('✅ Pass: Successfully navigated to page 2 and updated content');
          } else {
            console.error('❌ Fail: Navigation to page 2 failed or pagination state did not update');
            passed = false;
          }
        } else {
          console.error(`❌ Fail: Next link href does not match expected pattern (got "${nextHref}")`);
          passed = false;
        }
      } else {
        console.log('ℹ️ Info: No Next page link found (possibly last page or single page of posts).');
      }
    } else {
      console.error('❌ Fail: Pagination controls not found on /tin-tuc page');
      passed = false;
    }
  } catch (err) {
    console.error('❌ Error during posts pagination test:', err);
    passed = false;
  }

  await browser.close();
  
  console.log('\n==================================================');
  if (passed) {
    console.log('VERDICT: ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('VERDICT: SOME TESTS FAILED');
    process.exit(1);
  }
}

run();
