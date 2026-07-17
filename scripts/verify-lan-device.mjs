import assert from "node:assert/strict";
import { chromium, devices } from "playwright";

const origin = process.env.LAN_ORIGIN;
assert.ok(origin, "Set LAN_ORIGIN to the dev server address visible to physical devices");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ ...devices["iPhone 12"] });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, `${origin} did not render`);
  await page.locator("[data-open='#main-menu']").tap();
  assert.match(await page.locator("body").getAttribute("class") ?? "", /\bhome\b/);
  assert.equal(await page.locator("#main-menu").isVisible(), true, "LAN mobile menu did not open");
  assert.deepEqual(errors, [], `Console errors through LAN origin ${origin}`);
  await context.close();
} finally {
  await browser.close();
}

console.log(`Verified iPhone hydration and touch interactions through ${origin}.`);
