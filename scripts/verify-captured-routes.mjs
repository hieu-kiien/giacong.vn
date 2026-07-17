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
const fixedTocCss = await readFile("public/styles/fixed-toc.css", "utf8");
assert.match(home.bodyClasses, /\bhome\b/);
assert.match(home.description, /gia công/i);
assert.match(products.bodyClasses, /\barchive\b/);
assert.match(products.bodyClasses, /\bwoocommerce\b/);
assert.doesNotMatch(
  fixedTocCss,
  /https:\/\/giacong\.vn\/wp-content\/plugins\/fixed-toc\/frontend\/assets\/fonts\//,
  "Fixed TOC fonts must be served locally to avoid mobile CORS failures",
);

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

const browser = await chromium.launch({ channel: "chrome", headless: true });
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
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto(`http://localhost:3100${route}`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${route} did not render`);
    assert.deepEqual(errors, [], `Console errors on mobile route ${route}`);
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
  await desktopMenu.evaluate(() => window.scrollTo(0, 700));
  await desktopMenu.waitForFunction(() => (
    window.scrollY >= 700
    && document.querySelector(".header-wrapper")?.classList.contains("stuck")
    && Math.abs(
      document.querySelector(".header-wrapper")?.getBoundingClientRect().top ?? -999,
    ) <= 1
  ));
  const stickyHeader = await desktopMenu.locator(".header-wrapper").evaluate((wrapper) => {
    const rect = wrapper.getBoundingClientRect();
    const styles = getComputedStyle(wrapper);
    return {
      isStuck: wrapper.classList.contains("stuck"),
      position: styles.position,
      top: Math.abs(Math.round(rect.top)),
    };
  });
  assert.deepEqual(
    stickyHeader,
    { isStuck: true, position: "fixed", top: 0 },
    "Header must remain fixed and visible after scrolling",
  );
  await desktopMenu.evaluate(() => window.scrollTo(0, 0));
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
  const desktopUrlBeforeProductClick = desktopMenu.url();
  await desktopMenu.locator("#menu-item-1742 > a").click();
  assert.equal(
    desktopMenu.url(),
    desktopUrlBeforeProductClick,
    "Clicking Product must open its choices instead of navigating away",
  );
  assert.equal(
    await desktopMenu.locator("#menu-item-1742 > .nav-dropdown").isVisible(),
    true,
    "Clicking Product did not keep its mega menu open",
  );
  await desktopMenu.locator("#menu-item-5166 > a").hover();
  const serviceMenuWidth = await desktopMenu.locator(
    "#menu-item-5166 > .nav-dropdown",
  ).evaluate((panel) => panel.getBoundingClientRect().width);
  assert.ok(serviceMenuWidth >= 1000, `Desktop service mega menu is too narrow: ${serviceMenuWidth}px`);
  await desktopMenu.locator("#menu-item-5166 > a").click();
  await desktopMenu.waitForFunction(() => {
    const product = document.querySelector("#menu-item-1742 > .nav-dropdown");
    const service = document.querySelector("#menu-item-5166 > .nav-dropdown");
    if (!product || !service) return false;
    return getComputedStyle(product).visibility === "hidden"
      && getComputedStyle(service).visibility === "visible"
      && Number(getComputedStyle(service).opacity) > 0.99;
  });
  assert.equal(
    await desktopMenu.locator("#menu-item-5166 > .nav-dropdown").isVisible(),
    true,
    "Clicking Service did not keep its mega menu open",
  );
  assert.equal(
    await desktopMenu.locator("#menu-item-1742 > .nav-dropdown").isVisible(),
    false,
    "Opening Service must close the Product mega menu",
  );
  await desktopMenu.mouse.move(10, 500);
  await desktopMenu.keyboard.press("Escape");
  await desktopMenu.waitForFunction(() => (
    getComputedStyle(
      document.querySelector("#menu-item-5166 > .nav-dropdown"),
    ).visibility === "hidden"
  ));
  assert.equal(
    await desktopMenu.locator("#menu-item-5166 > .nav-dropdown").isVisible(),
    false,
    "Escape must close an expanded desktop mega menu",
  );
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
  const mobileMenuLayout = await mobileMenu.locator("#main-menu").evaluate((menu) => {
    const styles = getComputedStyle(menu);
    const rect = menu.getBoundingClientRect();
    const search = menu.querySelector(".header-search-form-wrapper");
    const searchRect = search?.getBoundingClientRect();
    const firstLink = menu.querySelector("#menu-item-5465 > a");
    const firstLinkStyles = firstLink ? getComputedStyle(firstLink) : null;
    const firstLinkRect = firstLink?.getBoundingClientRect();
    const toggle = menu.querySelector(".clone-toggle");
    const toggleRect = toggle?.getBoundingClientRect();
    return {
      backgroundColor: styles.backgroundColor,
      height: rect.height,
      viewportHeight: window.innerHeight,
      width: rect.width,
      search: searchRect ? {
        height: searchRect.height,
        left: searchRect.left - rect.left,
        top: searchRect.top - rect.top,
        width: searchRect.width,
      } : null,
      firstLink: firstLinkRect && firstLinkStyles ? {
        color: firstLinkStyles.color,
        fontSize: firstLinkStyles.fontSize,
        fontWeight: Number(firstLinkStyles.fontWeight),
        height: firstLinkRect.height,
        textTransform: firstLinkStyles.textTransform,
      } : null,
      toggle: toggleRect ? {
        left: toggleRect.left - rect.left,
        text: toggle?.textContent?.trim(),
      } : null,
    };
  });
  assert.notEqual(
    mobileMenuLayout.backgroundColor,
    "rgba(0, 0, 0, 0)",
    "Mobile menu must have an opaque background",
  );
  assert.ok(
    mobileMenuLayout.width >= 240 && mobileMenuLayout.width <= 300,
    `Unexpected mobile menu width: ${mobileMenuLayout.width}px`,
  );
  assert.ok(
    mobileMenuLayout.height >= mobileMenuLayout.viewportHeight,
    `Mobile menu does not cover the viewport: ${mobileMenuLayout.height}px`,
  );
  assert.deepEqual(
    mobileMenuLayout.search && {
      height: Math.round(mobileMenuLayout.search.height),
      left: Math.round(mobileMenuLayout.search.left),
      top: Math.round(mobileMenuLayout.search.top),
      width: Math.round(mobileMenuLayout.search.width),
    },
    { height: 42, left: 20, top: 50, width: 220 },
    "Mobile search spacing does not match the source site",
  );
  assert.equal(mobileMenuLayout.firstLink?.color, "rgb(255, 255, 255)");
  assert.equal(mobileMenuLayout.firstLink?.fontSize, "16px");
  assert.ok(
    (mobileMenuLayout.firstLink?.fontWeight ?? 0) >= 600,
    "Mobile menu labels must be bold",
  );
  assert.equal(mobileMenuLayout.firstLink?.textTransform, "none");
  assert.ok(
    Math.abs((mobileMenuLayout.firstLink?.height ?? 0) - 52) <= 1,
    `Unexpected mobile menu row height: ${mobileMenuLayout.firstLink?.height}px`,
  );
  assert.ok(
    (mobileMenuLayout.toggle?.left ?? 0) >= 210,
    "Mobile submenu chevron must be aligned to the right",
  );
  assert.notEqual(mobileMenuLayout.toggle?.text, "+", "Mobile submenu must not use a plus sign");
  assert.equal(
    await mobileMenu.locator(".clone-menu-backdrop").isVisible(),
    true,
    "Mobile menu backdrop is missing",
  );
  const closeButton = mobileMenu.locator(".clone-menu-close");
  assert.equal(await closeButton.isVisible(), true, "Mobile menu close button is missing");
  assert.equal(
    await closeButton.evaluate((button) => document.activeElement === button),
    true,
    "Opening the mobile menu must focus its close control",
  );
  await mobileMenu.keyboard.press("Tab");
  assert.equal(
    await mobileMenu.locator("#main-menu").evaluate(
      (menu) => menu.contains(document.activeElement),
    ),
    true,
    "Keyboard focus must remain inside the open mobile menu",
  );
  await mobileMenu.locator("#main-menu .clone-toggle").first().click();
  assert.equal(
    await mobileMenu.locator("#main-menu li.clone-submenu-open > .sub-menu").first().isVisible(),
    true,
    "Mobile submenu did not expand",
  );
  await closeButton.click();
  assert.equal(await mobileMenu.locator("#main-menu").isVisible(), false, "Close button did not close menu");
  assert.equal(
    await mobileMenu.locator("[data-open='#main-menu']").evaluate(
      (button) => document.activeElement === button,
    ),
    true,
    "Closing the mobile menu must restore focus to its trigger",
  );
  await mobileMenu.close();

  for (const width of [320, 430, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: true });
    await page.goto("http://localhost:3100/", { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForFunction(() => (
      document.querySelector(".header-wrapper")?.classList.contains("stuck")
      && Math.abs(
        document.querySelector(".header-wrapper")?.getBoundingClientRect().top ?? -999,
      ) <= 1
    ));
    assert.equal(
      await page.locator("[data-open='#main-menu']").isVisible(),
      true,
      `Sticky mobile header disappeared at ${width}px`,
    );
    await page.locator("[data-open='#main-menu']").tap();
    const drawer = page.locator("#main-menu");
    assert.equal(await drawer.isVisible(), true, `Mobile menu did not open at ${width}px`);
    assert.equal(
      await page.locator(".clone-menu-close").isVisible(),
      true,
      `Mobile close control is missing at ${width}px`,
    );
    await page.keyboard.press("Escape");
    assert.equal(await drawer.isVisible(), false, `Escape did not close menu at ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Verified ${Object.keys(manifest).length} mirrored routes and responsive breakpoints.`);
