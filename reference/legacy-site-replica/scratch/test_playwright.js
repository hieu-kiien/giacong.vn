const { chromium } = require('@playwright/test');
(async () => {
  try {
    const browser = await chromium.launch();
    console.log("Playwright launched successfully!");
    await browser.close();
  } catch (e) {
    console.error("Playwright launch failed:", e);
  }
})();
