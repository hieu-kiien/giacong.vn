const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 375, height: 667 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  console.log('Navigating to homepage...');
  await page.goto('http://127.0.0.1:3000/');
  
  // Wait for hydration/wpcf7
  await page.waitForFunction(() => typeof window.wpcf7 !== 'undefined');
  console.log('Page loaded and hydrated.');

  // Count #main-menu elements
  const mainMenuCount = await page.evaluate(() => {
    const menus = document.querySelectorAll('#main-menu');
    return Array.from(menus).map(el => ({
      tagName: el.tagName,
      className: el.className,
      parentId: el.parentElement ? el.parentElement.id : 'no-parent',
      parentClass: el.parentElement ? el.parentElement.className : 'no-parent',
      outerHTML: el.outerHTML.substring(0, 200) + '...'
    }));
  });
  console.log('--- #main-menu elements found ---');
  console.log(JSON.stringify(mainMenuCount, null, 2));
  console.log('---------------------------------');

  const body = page.locator('body');
  const drawer = page.locator('#main-menu');
  const toggleBtn = page.locator('a[aria-label="Menu"]');

  console.log('Before opening drawer:');
  console.log('  Body classes:', await body.getAttribute('class'));
  console.log('  Drawer classes:', await drawer.getAttribute('class'));

  console.log('Clicking hamburger Menu...');
  await toggleBtn.click();
  await page.waitForTimeout(1000);

  console.log('After opening drawer:');
  console.log('  Body classes:', await body.getAttribute('class'));
  console.log('  Drawer classes:', await drawer.getAttribute('class'));

  const subMenuParent = page.locator('#menu-item-5466');
  console.log('Submenu parent classes before click:', await subMenuParent.getAttribute('class'));

  console.log('Clicking submenu toggle link (a tag) with retry...');
  const toggleLinkA = subMenuParent.locator('a').first();
  
  for (let i = 0; i < 15; i++) {
    const isDrawerActive = (await drawer.getAttribute('class'))?.includes('active');
    if (!isDrawerActive) {
      console.log('Drawer was closed! Reopening...');
      await toggleBtn.click({ force: true });
      await page.waitForTimeout(500);
    }

    const classes = await subMenuParent.getAttribute('class');
    console.log(`\n--- Attempt ${i + 1} ---`);
    console.log('Body classes:', await body.getAttribute('class'));
    console.log('Drawer classes:', await drawer.getAttribute('class'));
    console.log('Submenu parent classes:', classes);
    if (classes && classes.includes('active')) {
      break;
    }
    console.log('Clicking toggleLinkA...');
    try {
      await toggleLinkA.click({ force: true });
    } catch (e) {
      console.log('Click failed:', e.message);
    }
    await page.waitForTimeout(1000);
  }
  
  console.log('Submenu parent classes after clicks:', await subMenuParent.getAttribute('class'));

  await browser.close();
})();
