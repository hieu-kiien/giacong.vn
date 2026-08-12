const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const targetUrl = 'https://giacong.vn';
const outputDir = path.join(__dirname, '../screenshots/live');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const viewports = [
  { width: 1440, height: 1200, isMobile: false },
  { width: 1366, height: 768, isMobile: false },
  { width: 1280, height: 800, isMobile: false },
  { width: 768, height: 1024, isMobile: true },
  { width: 390, height: 844, isMobile: true },
  { width: 375, height: 812, isMobile: true },
  { width: 360, height: 800, isMobile: true }
];

async function measureElement(page, selector) {
  try {
    const handle = await page.$(selector);
    if (!handle) return null;
    const box = await handle.boundingBox();
    const styles = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const comp = window.getComputedStyle(el);
      return {
        display: comp.display,
        backgroundColor: comp.backgroundColor,
        color: comp.color,
        fontSize: comp.fontSize,
        fontFamily: comp.fontFamily,
        position: comp.position,
        zIndex: comp.zIndex,
        boxShadow: comp.boxShadow
      };
    }, selector);
    return { selector, box, styles };
  } catch (e) {
    console.error(`Error measuring ${selector}:`, e);
    return null;
  }
}

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const vp of viewports) {
    const vpStr = `${vp.width}x${vp.height}`;
    console.log(`Processing viewport: ${vpStr}`);
    results[vpStr] = {};

    // 1. Closed state
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.isMobile 
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.log(`Initial goto timeout or issue, retrying once...`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    // Dismiss any cookie overlays if any
    try {
      await page.evaluate(() => {
        // Find and remove typical popups/overlays to get clean screenshots
        const popups = document.querySelectorAll('.fancybox-overlay, .mfp-bg, .mfp-wrap');
        popups.forEach(p => p.remove());
      });
    } catch (e) {}

    // Screenshot closed state
    await page.screenshot({ path: path.join(outputDir, `header_${vpStr}_closed.png`) });
    results[vpStr]['closed'] = {
      header: await measureElement(page, '#header'),
      logo: await measureElement(page, '#logo'),
      productMenuLink: await measureElement(page, '#menu-item-1742'),
      serviceMenuLink: await measureElement(page, '#menu-item-5166')
    };

    if (!vp.isMobile) {
      // DESKTOP INTERACTIONS
      
      // 2. Product Menu Open (hover or click)
      try {
        await page.hover('#menu-item-1742');
        await page.waitForTimeout(500); // Wait for transition
        await page.screenshot({ path: path.join(outputDir, `header_${vpStr}_product_open.png`) });
        results[vpStr]['product_open'] = {
          dropdown: await measureElement(page, '#menu-item-1742 .nav-dropdown')
        };
      } catch (e) {
        console.error(`Failed product hover for ${vpStr}`, e);
      }

      // Hover back to logo to reset dropdown
      try {
        await page.hover('#logo');
        await page.waitForTimeout(300);
      } catch (e) {}

      // 3. Service Menu Open
      try {
        await page.hover('#menu-item-5166');
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(outputDir, `header_${vpStr}_service_open.png`) });
        results[vpStr]['service_open'] = {
          dropdown: await measureElement(page, '#menu-item-5166 .nav-dropdown')
        };
      } catch (e) {
        console.error(`Failed service hover for ${vpStr}`, e);
      }

      // Hover back to logo to reset
      try {
        await page.hover('#logo');
        await page.waitForTimeout(300);
      } catch (e) {}

      // 4. Sticky/Scrolled Desktop
      try {
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(800); // Wait for sticky class trigger & animation
        await page.screenshot({ path: path.join(outputDir, `header_${vpStr}_sticky.png`) });
        results[vpStr]['sticky'] = {
          header: await measureElement(page, '#header'),
          isStickyActive: await page.evaluate(() => document.querySelector('#header').classList.contains('sticky-active') || document.querySelector('.has-sticky').classList.contains('sticky-active'))
        };
      } catch (e) {
        console.error(`Failed sticky state for ${vpStr}`, e);
      }
    } else {
      // MOBILE INTERACTIONS
      
      // 2. Mobile Open (click hamburger)
      try {
        const hamburger = await page.$('a[data-open="#main-menu"]');
        if (hamburger) {
          await hamburger.click();
          await page.waitForTimeout(800); // Wait for drawer open slide-in
          await page.screenshot({ path: path.join(outputDir, `header_${vpStr}_mobile_open.png`) });
          results[vpStr]['mobile_open'] = {
            drawer: await measureElement(page, '#main-menu'),
            htmlClasses: await page.evaluate(() => document.documentElement.className),
            bodyClasses: await page.evaluate(() => document.body.className)
          };
        } else {
          console.log(`Hamburger not found for ${vpStr}`);
        }
      } catch (e) {
        console.error(`Failed mobile open for ${vpStr}`, e);
      }

      // 3. Mobile Submenu Open (click a toggle inside drawer)
      try {
        // Let's toggle the submenu inside mobile drawer. Let's find toggle buttons in #main-menu
        const toggleBtn = await page.$('#main-menu li.menu-item-has-children button.toggle, #main-menu li.has-child button.toggle');
        if (toggleBtn) {
          await toggleBtn.click();
          await page.waitForTimeout(500); // wait for submenu open
          await page.screenshot({ path: path.join(outputDir, `header_${vpStr}_mobile_submenu_open.png`) });
          results[vpStr]['mobile_submenu_open'] = {
            submenu: await measureElement(page, '#main-menu li.menu-item-has-children ul.sub-menu')
          };
        } else {
          // Fallback check: click on the item directly if no button.toggle
          const menuText = await page.$('#main-menu a:has-text("Dịch Vụ"), #main-menu a:has-text("Sản Phẩm")');
          if (menuText) {
            await menuText.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(outputDir, `header_${vpStr}_mobile_submenu_open.png`) });
          }
        }
      } catch (e) {
        console.error(`Failed mobile submenu open for ${vpStr}`, e);
      }
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(__dirname, '../screenshots/live_measurements.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log("Live header captures completed.");
}

capture();
