import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const manifest = JSON.parse(await readFile("src/data/pages/manifest.json", "utf8"));
assert.ok(
  Object.keys(manifest).length >= 230,
  `Expected at least 230 mirrored routes, found ${Object.keys(manifest).length}`,
);

const home = JSON.parse(await readFile(`src/data/pages/${manifest["/"]}`, "utf8"));
const products = JSON.parse(await readFile(`src/data/pages/${manifest["/san-pham/"]}`, "utf8"));
assert.match(home.bodyClasses, /\bhome\b/);
assert.match(home.description, /gia công/i);
assert.match(products.bodyClasses, /\barchive\b/);
assert.match(products.bodyClasses, /\bwoocommerce\b/);

const routeQueue = Object.keys(manifest);
const routeFailures = [];
async function verifyRouteResponses() {
  while (routeQueue.length > 0) {
    const route = routeQueue.shift();
    const response = await fetch(`http://localhost:3100${route}`);
    if (!response.ok) routeFailures.push(`${route}: ${response.status}`);
  }
}
await Promise.all(Array.from({ length: 12 }, () => verifyRouteResponses()));
assert.deepEqual(routeFailures, [], "One or more mirrored routes failed");

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto("http://localhost:3100/", { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.scrollWidth, dimensions.clientWidth, `Horizontal overflow at ${width}px`);
    assert.deepEqual(errors, [], `Console errors at ${width}px`);
    await page.close();
  }

  for (const route of ["/san-pham/", "/gia-cong-do-uong/", "/lien-he/", "/sua-bot-cho-nguoi-gia/"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const response = await page.goto(`http://localhost:3100${route}`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${route} did not render`);
    await page.close();
  }

  const archive = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await archive.goto("http://localhost:3100/gia-cong-do-uong/", { waitUntil: "networkidle" });
  const collapsedHeight = await archive.locator(".taxonomy-description").evaluate((element) => (
    element.getBoundingClientRect().height
  ));
  assert.ok(collapsedHeight <= 301, `Taxonomy introduction was not collapsed: ${collapsedHeight}px`);
  await archive.getByRole("link", { name: "Xem thêm" }).click();
  const expandedHeight = await archive.locator(".taxonomy-description").evaluate((element) => (
    element.getBoundingClientRect().height
  ));
  assert.ok(expandedHeight > 1000, `Taxonomy introduction did not expand: ${expandedHeight}px`);
  await archive.close();

  const desktopMenu = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktopMenu.goto("http://localhost:3100/", { waitUntil: "networkidle" });
  await desktopMenu.getByRole("link", { name: /Sản Phẩm/ }).first().hover();
  assert.equal(
    await desktopMenu.locator("#header .nav-dropdown").first().isVisible(),
    true,
    "Desktop product dropdown did not open",
  );
  const productMenuLayout = await desktopMenu.locator("#menu-item-1742").evaluate((item) => {
    const panel = item.querySelector(":scope > .nav-dropdown");
    const columns = panel?.querySelectorAll(".menu-san-pham > .col") ?? [];
    return {
      panelWidth: panel?.getBoundingClientRect().width ?? 0,
      panelLeft: panel?.getBoundingClientRect().left ?? 0,
      viewportWidth: document.documentElement.clientWidth,
      columnWidths: Array.from(columns, (column) => column.getBoundingClientRect().width),
    };
  });
  assert.ok(
    productMenuLayout.panelWidth >= 1000,
    `Desktop product mega menu is too narrow: ${productMenuLayout.panelWidth}px`,
  );
  assert.ok(
    Math.abs(
      productMenuLayout.panelLeft
      - (productMenuLayout.viewportWidth - productMenuLayout.panelWidth) / 2
    ) <= 2,
    `Desktop product mega menu is not centered: left ${productMenuLayout.panelLeft}px`,
  );
  assert.equal(productMenuLayout.columnWidths.length, 4, "Product mega menu must have four columns");
  assert.ok(
    productMenuLayout.columnWidths.every((width) => width >= 200),
    `Product mega-menu columns are too narrow: ${productMenuLayout.columnWidths.join(", ")}px`,
  );
  await desktopMenu.locator("#menu-item-5166 > a").hover();
  const serviceMenuWidth = await desktopMenu.locator(
    "#menu-item-5166 > .nav-dropdown",
  ).evaluate((panel) => panel.getBoundingClientRect().width);
  assert.ok(serviceMenuWidth >= 1000, `Desktop service mega menu is too narrow: ${serviceMenuWidth}px`);
  assert.equal(
    await desktopMenu.locator(".echbay-sms-messenger").isVisible(),
    true,
    "Quick-contact buttons are missing",
  );
  await desktopMenu.close();

  const mobileMenu = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await mobileMenu.goto("http://localhost:3100/", { waitUntil: "networkidle" });
  await mobileMenu.locator("[data-open='#main-menu']").click();
  assert.equal(await mobileMenu.locator("#main-menu").isVisible(), true, "Mobile menu did not open");
  await mobileMenu.locator("#main-menu .clone-toggle").first().click();
  assert.equal(
    await mobileMenu.locator("#main-menu li.clone-submenu-open > .sub-menu").first().isVisible(),
    true,
    "Mobile submenu did not expand",
  );
  await mobileMenu.close();
} finally {
  await browser.close();
}

console.log(`Verified ${Object.keys(manifest).length} mirrored routes and responsive breakpoints.`);
