const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  console.log('Navigating to homepage...');
  await page.goto('http://127.0.0.1:3000/');
  
  await page.waitForFunction(() => typeof window.wpcf7 !== 'undefined');
  console.log('Page loaded.');

  const inputs = await page.evaluate(() => {
    const list = document.querySelectorAll('input');
    return Array.from(list).map(el => ({
      name: el.getAttribute('name'),
      type: el.getAttribute('type'),
      class: el.className,
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('All inputs found on page:', inputs);

  const text34Elements = await page.evaluate(() => {
    const list = document.querySelectorAll('[name="text-34"]');
    return Array.from(list).map(el => ({
      tagName: el.tagName,
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
      outerHTML: el.outerHTML,
    }));
  });

  console.log('text-34 elements:', text34Elements);

  await browser.close();
})();
