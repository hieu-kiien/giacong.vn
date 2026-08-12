const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('https://giacong.vn', { waitUntil: 'networkidle' });
  
  const initialClasses = await page.evaluate(() => {
    const hdr = document.querySelector('#header');
    return hdr ? hdr.className : null;
  });
  
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(1000);
  
  const scrolledClasses = await page.evaluate(() => {
    const hdr = document.querySelector('#header');
    const wrapper = document.querySelector('.header-wrapper');
    return {
      header: hdr ? hdr.className : null,
      wrapper: wrapper ? wrapper.className : null
    };
  });
  
  console.log("Initial Header Classes:", initialClasses);
  console.log("Scrolled Header Classes:", scrolledClasses);
  
  await browser.close();
})();
