import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

(async () => {
  const outputPath = process.argv[2];
  if (!outputPath) {
    console.error('Usage: node console-check.mjs <output-json-path>');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('pageerror', (err) => {
    pageErrors.push({
      message: err.message,
      stack: err.stack
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      failedRequests.push({
        url: response.url(),
        status: status
      });
    }
  });

  console.log('Navigating to http://localhost:3000...');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 15000 });
    console.log('Page loaded. Waiting for network/hydration to settle...');
    await page.waitForTimeout(3000);

    const markerResult = await page.evaluate(() => {
      // Hydration marker 1: Check aria-haspopup on Product menu link
      const productLink = document.querySelector('#menu-item-1742 a.nav-top-link');
      const attr = productLink ? productLink.getAttribute('aria-haspopup') : null;
      
      // Hydration marker 2: Check custom data-hydrated attribute if we add it
      const headerWrapper = document.querySelector('.header-wrapper');
      const dataHydrated = headerWrapper ? headerWrapper.getAttribute('data-hydrated') : null;

      // Hydration marker 3: Check if click event handler (or any other hydrated property) was attached.
      // We can check if flatsomeVars is hydrated or if standard client components mounted.
      // Since attr === 'menu' is set in useEffect, it's a robust hydration marker.
      return {
        productLinkAriaHasPopup: attr,
        dataHydratedAttr: dataHydrated,
        exists: (attr === 'menu') || (dataHydrated === 'true')
      };
    });

    const result = {
      timestamp: new Date().toISOString(),
      hydrationMarkerExists: markerResult.exists,
      hydrationMarkerDetails: markerResult,
      pageErrors,
      consoleErrors,
      failedRequests
    };

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Results written to ${outputPath}`);
    console.log(`Hydration marker exists: ${result.hydrationMarkerExists}`);
    console.log(`Page errors count: ${pageErrors.length}`);
    console.log(`Console errors count: ${consoleErrors.length}`);
    console.log(`Failed requests count: ${failedRequests.length}`);

  } catch (err) {
    console.error('Failed to run console check:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
