import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright";

async function findOpenPort() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string", "Could not reserve a test port");
  const { port } = address;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function formatLogs(logs) {
  const output = logs.join("").trim();
  return output ? `\n--- Next.js logs ---\n${output.slice(-8_000)}` : "\n--- Next.js logs ---\n(no output)";
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + 30_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before QA started: ${lastError}${formatLogs(logs)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next.js did not become ready within 30 seconds: ${lastError}${formatLogs(logs)}`);
}

async function waitForPortToClose(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const server = createNetServer();
    try {
      server.listen(port, "127.0.0.1");
      await once(server, "listening");
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      return;
    } catch {
      server.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Port ${port} remained open after Next.js cleanup.`);
}

async function startFakeBagisto() {
  const sockets = new Set();
  const redirectTargetPath = "/redirect-target";
  let origin = "";
  let redirectTargetHits = 0;
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === redirectTargetPath) {
      redirectTargetHits += 1;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, data: { reference: "BFF-REDIRECT-TARGET" } }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/api/b2b/briefs") {
      response.writeHead(404).end();
      return;
    }

    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (body.includes("__upstream_4xx__")) {
        response.writeHead(422, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: false, message: "upstream validation detail" }));
        return;
      }
      if (body.includes("__unavailable__")) {
        request.socket.destroy();
        return;
      }
      if (body.includes("__redirect__")) {
        response.writeHead(302, { Location: `${origin}${redirectTargetPath}` }).end();
        return;
      }
      if (body.includes("__upstream_5xx__")) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: false, message: "secret upstream failure", url: "https://upstream.example/private" }));
        return;
      }
      if (body.includes("__timeout__")) {
        setTimeout(() => {
          if (!response.destroyed) {
            response.writeHead(201, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ ok: true, data: { reference: "BFF-LATE" } }));
          }
        }, 500);
        return;
      }
      if (body.includes("__headers_then_hang__")) {
        response.writeHead(201, { "Content-Type": "application/json" });
        response.write('{"ok":true,"data":{"reference":"BFF-HANG');
        return;
      }
      if (body.includes("__malformed_json__")) {
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end("{");
        return;
      }
      response.writeHead(201, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body.includes("__missing_reference__")
        ? { ok: true, data: {} }
        : body.includes("__blank_reference__")
          ? { ok: true, data: { reference: "   " } }
        : { ok: true, data: { reference: "BFF-REF-001" } }));
    });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string", "Fake Bagisto did not bind a port");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    redirectTargetHits: () => redirectTargetHits,
    stop: async () => {
      sockets.forEach((socket) => socket.destroy());
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

async function stopChild(child, port, logs) {
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) {
    if (port !== undefined) await waitForPortToClose(port);
    return;
  }
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  child.kill("SIGTERM");
  const exitedGracefully = await Promise.race([
    once(child, "exit").then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exitedGracefully) {
    if (process.platform === "win32") {
      const result = spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
      if (result.status !== 0 && child.exitCode === null) {
        throw new Error(`Could not force-stop Next.js process tree: ${result.stderr?.toString() ?? "unknown taskkill error"}${formatLogs(logs)}`);
      }
    } else {
      child.kill("SIGKILL");
    }
    await Promise.race([
      once(child, "exit"),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Next.js did not exit after forced cleanup.${formatLogs(logs)}`)), 5_000)),
    ]);
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(
    exited || child.exitCode !== null || child.signalCode !== null,
    `Next.js child was still running after cleanup.${formatLogs(logs)}`,
  );
  await waitForPortToClose(port);
}

async function assertTimeoutFallback(fakeBagisto, configuredTimeout, label) {
  const port = await findOpenPort();
  const logs = [];
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
    env: {
      ...process.env,
      BAGISTO_API_TIMEOUT_MS: configuredTimeout,
      BAGISTO_API_URL: fakeBagisto.origin,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  try {
    const appUrl = `http://localhost:${port}`;
    await waitForServer(`${appUrl}/`, child, logs);
    const formData = new FormData();
    formData.set("name", "Kiểm thử timeout");
    formData.set("phone", "0900000000");
    formData.set("message", "__timeout__");
    const response = await fetch(`${appUrl}/api/contact`, { method: "POST", body: formData });
    assert.equal(response.status, 202, `Invalid ${label} timeout must fall back to the default`);
  } finally {
    await stopChild(child, port, logs);
  }
}

let fakeBagisto;
let nextServer;
let nextPort;
let nextLogs = [];

try {
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

  fakeBagisto = await startFakeBagisto();
  for (const [configuredTimeout, label] of [
    ["99", "lower bound"],
    ["30001", "upper bound"],
    ["1.5", "float"],
    ["NaN", "NaN"],
  ]) {
    await assertTimeoutFallback(fakeBagisto, configuredTimeout, label);
  }

  const missingConfigPort = await findOpenPort();
  const missingConfigLogs = [];
  const missingConfigServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(missingConfigPort)], {
    env: { ...process.env, BAGISTO_API_URL: "" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  missingConfigServer.stdout.on("data", (chunk) => missingConfigLogs.push(chunk.toString()));
  missingConfigServer.stderr.on("data", (chunk) => missingConfigLogs.push(chunk.toString()));
  try {
    const missingConfigUrl = `http://localhost:${missingConfigPort}`;
    await waitForServer(`${missingConfigUrl}/`, missingConfigServer, missingConfigLogs);
    const formData = new FormData();
    formData.set("name", "Kiểm thử cấu hình");
    formData.set("phone", "0900000000");
    const response = await fetch(`${missingConfigUrl}/api/contact`, { method: "POST", body: formData });
    assert.equal(response.status, 503, "BFF did not report its missing Bagisto configuration");
  } finally {
    await stopChild(missingConfigServer, missingConfigPort, missingConfigLogs);
  }

  const appPort = await findOpenPort();
  nextPort = appPort;
  const appUrl = `http://localhost:${appPort}`;
  nextLogs = [];
  nextServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(appPort)], {
    env: {
      ...process.env,
      BAGISTO_API_TIMEOUT_MS: "100",
      BAGISTO_API_URL: fakeBagisto.origin,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  nextServer.stdout.on("data", (chunk) => nextLogs.push(chunk.toString()));
  nextServer.stderr.on("data", (chunk) => nextLogs.push(chunk.toString()));
  await waitForServer(`${appUrl}/`, nextServer, nextLogs);

const routeQueue = Object.keys(manifest).filter((route) => route !== "/san-pham/");
const routeFailures = [];
async function verifyRouteResponses() {
  while (routeQueue.length > 0) {
    const route = routeQueue.shift();
    const response = await fetch(`${appUrl}${route}`);
    if (!response.ok) routeFailures.push(`${route}: ${response.status}`);
  }
}
await Promise.all(Array.from({ length: 12 }, () => verifyRouteResponses()));
assert.deepEqual(routeFailures, [], "One or more mirrored routes failed");

const validContactData = new FormData();
validContactData.set("name", "Kiểm thử liên hệ");
validContactData.set("phone", "0900000000");
validContactData.set("source", "/");
const validContactResponse = await fetch(`${appUrl}/api/contact`, {
  method: "POST",
  body: validContactData,
});
assert.equal(validContactResponse.status, 202, "BFF contact API did not accept valid data");
const validContactResult = await validContactResponse.json();
assert.equal(validContactResult.ok, true);
assert.match(
  validContactResult.reference,
  /^BFF-/,
  "BFF contact API did not return the upstream reference",
);

const invalidContactResponse = await fetch(`${appUrl}/api/contact`, {
  method: "POST",
  body: new FormData(),
});
assert.equal(
  invalidContactResponse.status,
  400,
  "BFF contact API accepted an empty submission",
);

for (const [message, expectedStatus, label] of [
  ["__missing_reference__", 502, "upstream success without a reference"],
  ["__blank_reference__", 502, "upstream success with a blank reference"],
  ["__malformed_json__", 502, "malformed upstream JSON"],
  ["__upstream_4xx__", 422, "upstream client validation failure"],
  ["__upstream_5xx__", 502, "upstream server failure"],
  ["__redirect__", 502, "upstream redirect"],
  ["__unavailable__", 502, "unavailable upstream"],
  ["__timeout__", 504, "timed out upstream"],
  ["__headers_then_hang__", 504, "upstream body hanging after headers"],
]) {
  const formData = new FormData();
  formData.set("name", "Kiểm thử BFF");
  formData.set("phone", "0900000000");
  formData.set("message", message);
  const response = await fetch(`${appUrl}/api/contact`, { method: "POST", body: formData });
  assert.equal(response.status, expectedStatus, `BFF did not handle ${label}`);
  const result = await response.json();
  assert.equal(result.ok, false, `BFF exposed a false success for ${label}`);
  assert.doesNotMatch(
    JSON.stringify(result),
    /upstream validation detail|secret upstream failure|upstream\.example|127\.0\.0\.1/i,
    `BFF leaked upstream details for ${label}`,
  );
}
assert.equal(
  fakeBagisto.redirectTargetHits(),
  0,
  "BFF followed an upstream redirect instead of rejecting it",
);

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto(`${appUrl}/`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.scrollWidth, dimensions.clientWidth, `Horizontal overflow at ${width}px`);
    assert.deepEqual(errors, [], `Console errors at ${width}px`);
    await page.close();
  }

  const contactFlow = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await contactFlow.goto(`${appUrl}/`, { waitUntil: "networkidle" });
  assert.equal(
    await contactFlow.getByRole("link", { name: "Liên hệ ngay" }).getAttribute("href"),
    "/lien-he/",
    "Primary contact CTA does not point to the local contact page",
  );
  assert.equal(
    await contactFlow.getByRole("link", { name: "Về chúng tôi" }).getAttribute("href"),
    "/gioi-thieu-ve-gia-cong/",
    "About CTA does not point to the local introduction page",
  );
  const contactForm = contactFlow.locator(".wpcf7-form").first();
  await contactForm.locator("input[type='text']").fill("Kiểm thử liên hệ");
  await contactForm.locator("input[type='tel']").fill("0900000000");
  const contactRequest = contactFlow.waitForResponse((response) => (
    response.url() === `${appUrl}/api/contact`
    && response.request().method() === "POST"
  ));
  await contactForm.locator("input[type='submit']").click();
  assert.equal(
    (await contactRequest).status(),
    202,
    "Contact form did not reach the BFF",
  );
  assert.equal(await contactForm.getAttribute("data-status"), "sent");
  assert.match(
    await contactForm.locator(".wpcf7-response-output").textContent(),
    /đã được tiếp nhận/i,
    "Contact form did not show the server acknowledgement",
  );
  await contactFlow.close();

  const contactPageFlow = await browser.newPage({
    viewport: { width: 390, height: 900 },
    hasTouch: true,
  });
  await contactPageFlow.goto(`${appUrl}/lien-he/`, {
    waitUntil: "networkidle",
  });
  const detailedContactForm = contactPageFlow.locator(".wpcf7-form").first();
  const invalidContactRequest = contactPageFlow.waitForResponse((response) => (
    response.url() === `${appUrl}/api/contact`
    && response.request().method() === "POST"
  ));
  await detailedContactForm.locator("input[type='submit']").tap();
  assert.equal(
    (await invalidContactRequest).status(),
    400,
    "Detailed contact form did not surface server validation",
  );
  assert.equal(await detailedContactForm.getAttribute("data-status"), "invalid");
  assert.match(
    await detailedContactForm.locator(".wpcf7-response-output").textContent(),
    /kiểm tra lại/i,
  );
  await detailedContactForm.locator("input[type='text']").fill("Khách hàng mobile");
  await detailedContactForm.locator("input[type='tel']").fill("0912345678");
  await detailedContactForm.locator("input[type='email']").fill("mobile@example.com");
  await detailedContactForm.locator("textarea").fill("__upstream_4xx__");
  const upstreamValidationRequest = contactPageFlow.waitForResponse((response) => (
    response.url() === `${appUrl}/api/contact`
    && response.request().method() === "POST"
  ));
  await detailedContactForm.locator("input[type='submit']").tap();
  assert.equal(
    (await upstreamValidationRequest).status(),
    422,
    "Detailed contact form did not surface upstream validation",
  );
  assert.equal(await detailedContactForm.getAttribute("data-status"), "invalid");
  assert.equal(await detailedContactForm.locator("input[type='text']").inputValue(), "Khách hàng mobile");
  assert.equal(await detailedContactForm.locator("input[type='tel']").inputValue(), "0912345678");
  assert.equal(await detailedContactForm.locator("input[type='email']").inputValue(), "mobile@example.com");
  assert.equal(await detailedContactForm.locator("textarea").inputValue(), "__upstream_4xx__");
  await detailedContactForm.locator("textarea").fill("Cần tư vấn dịch vụ gia công.");
  const acceptedDetailedRequest = contactPageFlow.waitForResponse((response) => (
    response.url() === `${appUrl}/api/contact`
    && response.request().method() === "POST"
  ));
  await detailedContactForm.locator("input[type='submit']").tap();
  assert.equal(
    (await acceptedDetailedRequest).status(),
    202,
    "Detailed mobile contact form did not reach the BFF",
  );
  assert.equal(await detailedContactForm.getAttribute("data-status"), "sent");
  assert.match(
    await detailedContactForm.locator(".wpcf7-response-output").textContent(),
    /Mã:\s*BFF-/i,
    "Detailed mobile contact form did not show the BFF reference",
  );
  await contactPageFlow.close();

  for (const route of ["/gia-cong-do-uong/", "/lien-he/", "/sua-bot-cho-nguoi-gia/"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto(`${appUrl}${route}`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${route} did not render`);
    assert.equal(
      await page.locator("#main-menu .clone-mobile-products").count(),
      1,
      `Mobile Product accordion is missing on ${route}`,
    );
    assert.deepEqual(errors, [], `Console errors on mobile route ${route}`);
    await page.close();
  }

  const archive = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await archive.goto(`${appUrl}/gia-cong-do-uong/`, { waitUntil: "networkidle" });
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
  await desktopMenu.goto(`${appUrl}/`, { waitUntil: "networkidle" });
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
  assert.equal(await desktopMenu.locator("#menu-item-1742 > .nav-dropdown").count(), 0, "Product must be a direct link");
  assert.equal(await desktopMenu.locator("#menu-item-1742 > a").getAttribute("href"), "/san-pham/");
  await desktopMenu.locator("#menu-item-5166 > a").hover();
  const serviceMenuWidth = await desktopMenu.locator(
    "#menu-item-5166 > .nav-dropdown",
  ).evaluate((panel) => panel.getBoundingClientRect().width);
  assert.ok(serviceMenuWidth >= 1000, `Desktop service mega menu is too narrow: ${serviceMenuWidth}px`);
  const serviceLink = desktopMenu.locator("#menu-item-5166 > a");
  const serviceDisclosure = desktopMenu.locator("#menu-item-5166 > .clone-desktop-service-toggle");
  assert.equal(await serviceLink.getAttribute("href"), "/thue-gia-cong/");
  assert.equal(await serviceLink.getAttribute("aria-expanded"), null, "Service navigation link must not act as disclosure");
  await serviceDisclosure.click();
  assert.equal(
    await desktopMenu.locator("#menu-item-5166 > .nav-dropdown").isVisible(),
    true,
    "Clicking the Service disclosure did not keep its mega menu open",
  );
  assert.equal(await serviceDisclosure.getAttribute("aria-expanded"), "true");
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

  const mobileMenu = await browser.newPage({
    viewport: { width: 390, height: 900 },
    hasTouch: true,
  });
  await mobileMenu.goto(`${appUrl}/`, { waitUntil: "networkidle" });
  const mobileHeaderSearch = mobileMenu.locator(
    ".mobile-nav.nav-right .header-search > a",
  );
  await mobileHeaderSearch.tap();
  assert.equal(
    await mobileMenu.locator("#main-menu").isVisible(),
    true,
    "Mobile header search did not open the search drawer",
  );
  assert.equal(
    await mobileMenu
      .locator("#main-menu input[type='search']")
      .evaluate((input) => document.activeElement === input),
    true,
    "Mobile header search did not focus the search field",
  );
  assert.equal(
    await mobileHeaderSearch.getAttribute("aria-expanded"),
    "true",
    "Mobile header search did not expose its expanded state",
  );
  await mobileMenu.locator(".clone-menu-close").tap();
  assert.equal(
    await mobileHeaderSearch.getAttribute("aria-expanded"),
    "false",
    "Closing the drawer did not reset the mobile search state",
  );
  await mobileMenu.locator("[data-open='#main-menu']").click();
  assert.equal(await mobileMenu.locator("#main-menu").isVisible(), true, "Mobile menu did not open");
  assert.equal(
    await mobileMenu
      .locator("#main-menu .nav-sidebar > li > a > svg.clone-mobile-menu-icon")
      .count(),
    6,
    "Mobile menu does not use a complete, consistent SVG icon set",
  );
  assert.equal(
    await mobileMenu
      .locator("#main-menu .nav-sidebar > li > a > img.ux-sidebar-menu-icon")
      .count(),
    0,
    "Legacy mixed-quality mobile menu icons remain visible",
  );
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
  const mobileProductItem = mobileMenu.locator("#main-menu .clone-mobile-products");
  assert.equal(await mobileProductItem.count(), 1, "Mobile Product link is missing");
  assert.equal(await mobileProductItem.locator(":scope > a").getAttribute("href"), "/san-pham/");
  assert.equal(await mobileProductItem.locator(":scope > .sub-menu, :scope > .clone-toggle").count(), 0, "Mobile Product must be a direct link");
  const mobileServiceItem = mobileMenu.locator("#menu-item-5466");
  assert.equal(await mobileServiceItem.locator(":scope > a").getAttribute("href"), "/thue-gia-cong/");
  assert.equal(await mobileServiceItem.locator(":scope > a").getAttribute("aria-expanded"), null);
  await mobileServiceItem.locator(":scope > .clone-toggle").tap();
  assert.equal(
    await mobileMenu.locator("#menu-item-5466.clone-submenu-open > .sub-menu").isVisible(),
    true,
    "Tapping the Service disclosure did not expand its choices",
  );
  const serviceAccordionHeader = await mobileMenu.locator("#menu-item-5466").evaluate((item) => {
    const link = item.querySelector(":scope > a")?.getBoundingClientRect();
    const toggle = item.querySelector(":scope > .clone-toggle")?.getBoundingClientRect();
    return {
      linkTop: link?.top ?? -1,
      toggleLeft: toggle?.left ?? -1,
      toggleTop: toggle?.top ?? -1,
    };
  });
  assert.ok(
    Math.abs(serviceAccordionHeader.linkTop - serviceAccordionHeader.toggleTop) <= 1
      && serviceAccordionHeader.toggleLeft >= 210,
    `Service chevron moved away from its header row: ${JSON.stringify(serviceAccordionHeader)}`,
  );
  assert.equal(await mobileServiceItem.locator(":scope > .sub-menu > li").count(), 6, "Service menu must contain six families");
  const firstServiceChoice = mobileMenu.locator("#menu-item-5466 > .sub-menu > li > a").first();
  assert.ok(
    (await firstServiceChoice.boundingBox())?.x >= 0,
    "Mobile Service choices remain positioned off-screen",
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

  const mobileSearchPage = await browser.newPage({
    viewport: { width: 390, height: 900 },
    hasTouch: true,
  });
  await mobileSearchPage.goto(`${appUrl}/`, { waitUntil: "networkidle" });
  await mobileSearchPage.locator(".mobile-nav.nav-right .header-search > a").tap();
  await mobileSearchPage
    .locator("#main-menu input[type='search']")
    .fill("sữa");
  await Promise.all([
    mobileSearchPage.waitForURL((url) => url.searchParams.get("s") === "sữa"),
    mobileSearchPage
      .locator("#main-menu .ux-search-submit")
      .click(),
  ]);
  assert.equal(
    new URL(mobileSearchPage.url()).origin,
    appUrl,
    "Mobile search escaped the local clone",
  );
  await mobileSearchPage.close();

  for (const accordionSelector of ["#menu-item-5466"]) {
    const choicePage = await browser.newPage({
      viewport: { width: 390, height: 900 },
      hasTouch: true,
    });
    await choicePage.goto(`${appUrl}/`, { waitUntil: "networkidle" });
    await choicePage.locator("[data-open='#main-menu']").tap();
    const accordion = choicePage.locator(`#main-menu ${accordionSelector}`);
    await accordion.locator(":scope > .clone-toggle").tap();
    const choiceHref = await accordion
      .locator(":scope > .sub-menu > li > a")
      .first()
      .getAttribute("href");
    assert.ok(choiceHref && choiceHref !== "#" && choiceHref !== "/");
    await Promise.all([
      choicePage.waitForURL((url) => url.pathname !== "/"),
      accordion.locator(":scope > .sub-menu > li > a").first().tap(),
    ]);
    assert.equal(
      new URL(choicePage.url()).origin,
      appUrl,
      `Mobile choice escaped the local clone from ${accordionSelector}`,
    );
    await choicePage.close();
  }

  for (const width of [320, 430, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: true });
    await page.goto(`${appUrl}/`, { waitUntil: "networkidle" });
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

console.log(`Verified ${Object.keys(manifest).length} mirrored routes, BFF cases, and responsive breakpoints.`);
} finally {
  await stopChild(nextServer, nextPort, nextLogs);
  await fakeBagisto?.stop();
}
