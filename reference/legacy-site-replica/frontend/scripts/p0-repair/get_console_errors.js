const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
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
      consoleErrors.push(msg.text());
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
    console.log('Page loaded. Waiting for network idle...');
    await page.waitForTimeout(3000);

    const mainMenuExists = await page.evaluate(() => !!document.getElementById('main-menu'));
    console.log(`[Home] #main-menu exists: ${mainMenuExists}`);
  } catch (err) {
    console.error('Failed to load home page:', err);
  }

  console.log('--- FAILED REQUESTS ---');
  console.log(JSON.stringify(failedRequests, null, 2));

  console.log('--- PAGE ERRORS ---');
  console.log(JSON.stringify(pageErrors, null, 2));

  await browser.close();
})();
