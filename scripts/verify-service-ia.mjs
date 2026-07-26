import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

import { nextBinPath } from "./next-bin.mjs";

const families = [
  ["do-uong-sua", "Đồ uống & sữa", ["/gia-cong-do-uong/", "/gia-cong-sua/", "/gia-cong-sua-bot/", "/gia-cong-sua-tuoi/", "/gia-cong-sua-hat/", "/gia-cong-sua-thuc-vat/", "/gia-cong-sua-chua/", "/gia-cong-nuoc-ep-trai-cay/", "/gia-cong-nuoc-giai-khat-co-ga/", "/gia-cong-tra-dong-chai/", "/gia-cong-nuoc-uong-dong-chai/", "/gia-cong-ruou/"]],
  ["say-thuc-pham-say", "Sấy & thực phẩm sấy", ["/dich-vu-say/", "/say-thang-hoa/", "/say-nong/", "/say-lanh/", "/say-chan-khong/", "/say-hong-ngoai/"]],
  ["thuc-pham-bot-gia-vi", "Thực phẩm, bột & gia vị", ["/gia-cong-thuc-pham/", "/thuc-pham-chuc-nang/", "/bot-gia-vi/", "/gia-cong-bot/", "/gia-cong-bot-pha-che/", "/gia-cong-sot-cham/"]],
  ["tra-ca-phe-duoc-lieu", "Trà, cà phê & dược liệu", ["/gia-cong-tra/", "/gia-cong-ca-phe/", "/gia-cong-duoc-lieu/", "/rang-gia-cong-ca-phe/", "/gia-cong-ca-phe-hoa-tan/", "/gia-cong-ca-phe-qua-tang/", "/gia-cong-tra-tui-loc/"]],
  ["my-pham-cham-soc-ca-nhan", "Mỹ phẩm & chăm sóc cá nhân", ["/gia-cong-my-pham/"]],
  ["dong-goi-hoan-thien", "Đóng gói & hoàn thiện", ["/gia-cong-dong-goi/", "/dich-vu-dong-goi-bao-jumbo/", "/dich-vu-dong-goi-bot-hoa-tan/", "/dich-vu-dong-goi-dang-long-goi-nho/", "/dich-vu-dong-goi-dang-ong-stick/", "/dich-vu-dong-goi-vien-nen-vien-nang/"]],
];

const expectedHeaderLinks = [
  ["Home", "/"],
  ["Mua hàng", "/san-pham/"],
  ["Thuê gia công", "/thue-gia-cong/"],
  ["Tin tức", "/tin-tuc/"],
  ["Liên hệ", "/lien-he/"],
];

const expectedOfferingPaths = families.flatMap(([, , routes]) => routes.map((route) => route.replace(/\/$/, "")));
const expectedStaticFamilyPaths = families.map(([slug]) => `/thue-gia-cong/${slug}`).sort();
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const prerenderManifest = JSON.parse(await readFile(".next/prerender-manifest.json", "utf8"));
const prerenderedFamilies = Object.keys(prerenderManifest.routes)
  .filter((route) => route.startsWith("/thue-gia-cong/"))
  .sort();
assert.deepEqual(prerenderedFamilies, expectedStaticFamilyPaths, "Every generated service family must be prerendered.");

async function port() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForServer(origin, child, logs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    if (child.exitCode !== null) throw new Error(`Next exited before startup:\n${logs.join("").slice(-8_000)}`);
    await delay(100);
  }
  throw new Error(`Next did not start:\n${logs.join("").slice(-8_000)}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const stopped = await Promise.race([once(child, "exit").then(() => true), delay(5_000).then(() => false)]);
  if (!stopped && child.exitCode === null && process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
  }
}

function observeRuntime(page, label, issues) {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) issues.push(`${label} console ${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`${label} pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (!failure.includes("ERR_ABORTED")) issues.push(`${label} request failed: ${request.url()} (${failure})`);
  });
}

async function assertDirectHeaderLinks(page, mobile = false) {
  const scope = mobile ? page.locator("#main-menu") : page.locator("#header .header-nav-main");
  for (const [name, href] of expectedHeaderLinks) {
    const link = scope.getByRole("link", { name, exact: true });
    assert.equal(await link.count(), 1, `${mobile ? "Mobile" : "Desktop"} header must expose one direct ${name} link`);
    assert.equal(await link.getAttribute("href"), href, `${name} must link directly to ${href}`);
  }
  assert.equal(await scope.getByRole("link", { name: "Về Giacong.vn", exact: true }).count(), 0, "Header must contain exactly the requested five text links");
}

const appPort = await port();
const logs = [];
const screenshots = await mkdtemp(path.join(tmpdir(), "storefront-task-1-"));
const app = spawn(process.execPath, [nextBinPath, "start", "-p", String(appPort)], {
  env: { ...process.env, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
app.stdout.on("data", (chunk) => logs.push(chunk.toString()));
app.stderr.on("data", (chunk) => logs.push(chunk.toString()));

let browser;
try {
  const origin = `http://127.0.0.1:${appPort}`;
  await waitForServer(origin, app, logs);
  assert.equal((await fetch(`${origin}/thue-gia-cong/khong-ton-tai`)).status, 404, "Unknown service family must be 404");
  assert.equal((await fetch(`${origin}/thue-gia-cong/`)).status, 200, "Service directory must resolve");

  for (const [slug, , routes] of families) {
    const familyResponse = await fetch(`${origin}/thue-gia-cong/${slug}/`);
    assert.equal(familyResponse.status, 200, `${slug} must resolve`);
    const familyMarkup = await familyResponse.text();
    assert.match(familyMarkup, /href="\/thue-gia-cong"/, `${slug} must retain a directory backlink`);
    for (const route of routes) {
      assert.equal((await fetch(`${origin}${route}`)).status, 200, `${route} must resolve`);
      assert.ok(familyMarkup.includes(`href="${route.replace(/\/$/, "")}"`), `${slug} must retain its verified offering link ${route}`);
    }
  }

  browser = await chromium.launch({ headless: true });
  const runtimeIssues = [];
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  observeRuntime(desktop, "desktop", runtimeIssues);
  const initialRequests = [];
  desktop.on("request", (request) => initialRequests.push(request.url()));
  await desktop.goto(`${origin}/thue-gia-cong/`, { waitUntil: "networkidle" });
  await desktop.getByRole("heading", { level: 1, name: "Thuê gia công" }).waitFor();
  const landingRequestCount = initialRequests.length;
  const landingDomNodes = await desktop.locator("*").count();
  await assertDirectHeaderLinks(desktop);

  const desktopServiceLink = desktop.locator("#header .header-nav-main").getByRole("link", { name: "Thuê gia công", exact: true });
  assert.equal(await desktopServiceLink.getAttribute("aria-expanded"), null, "Desktop service navigation must be a plain link");
  assert.equal(await desktop.locator("#header .clone-desktop-service-toggle, #clone-service-menu-desktop, #header .clone-service-mega-grid").count(), 0, "Desktop service mega-menu must be removed");
  await desktopServiceLink.focus();
  assert.equal(await desktopServiceLink.evaluate((link) => document.activeElement === link), true, "Desktop direct service link must accept keyboard focus");

  const directory = desktop.locator("#service-directory");
  await directory.waitFor();
  const search = desktop.getByRole("searchbox", { name: "Bạn cần gia công gì?" });
  await search.waitFor();
  assert.equal(await directory.locator("[data-family-chip]").count(), 6, "Directory must expose six family chips");
  for (const [, label] of families) {
    assert.equal(await directory.getByRole("heading", { name: label, exact: true }).count(), 1, `Directory must group offerings under ${label}`);
  }

  const offeringLinks = directory.locator("[data-service-offering] a");
  assert.equal(await offeringLinks.count(), 38, "Directory must render all 38 offerings on one page");
  const renderedPaths = await offeringLinks.evaluateAll((links) => links.map((link) => new URL(link.href).pathname.replace(/\/$/, "")));
  assert.deepEqual([...new Set(renderedPaths)].sort(), [...expectedOfferingPaths].sort(), "Directory must expose exactly the verified offering routes");
  assert.equal(await directory.getByText("38 dịch vụ phù hợp", { exact: true }).getAttribute("aria-live"), "polite", "Result count must announce client-side changes");

  const pathBeforeFilter = new URL(desktop.url()).pathname;
  await search.fill("sữa hạt");
  await directory.getByText("1 dịch vụ phù hợp", { exact: true }).waitFor();
  assert.equal(new URL(desktop.url()).pathname, pathBeforeFilter, "Search must filter without reloading or changing route");
  assert.equal(await directory.locator("[data-service-offering]:visible").count(), 1, "Search must narrow the directory");
  await search.fill("");
  await directory.getByText("38 dịch vụ phù hợp", { exact: true }).waitFor();

  const familyChip = directory.locator("[data-family-chip='say-thuc-pham-say']");
  await familyChip.click();
  await directory.getByText("6 dịch vụ phù hợp", { exact: true }).waitFor();
  assert.equal(new URL(desktop.url()).pathname, pathBeforeFilter, "Family filter must not navigate");
  assert.equal(await directory.locator("[data-service-offering]:visible").count(), 6, "Family chip must reveal only its six offerings");

  await search.fill("sấy lạnh");
  const consultation = directory.getByRole("link", { name: "Chưa chắc? Liên hệ tư vấn", exact: true });
  const consultationUrl = new URL(await consultation.getAttribute("href"), origin);
  assert.equal(consultationUrl.pathname, "/lien-he");
  assert.equal(consultationUrl.searchParams.get("service_family"), "say-thuc-pham-say", "CTA must carry selected family context");
  assert.equal(consultationUrl.searchParams.get("service_query"), "sấy lạnh", "CTA must carry query context");

  assert.equal(await desktop.locator(".echbay-sms-messenger, .bottom-contact").count(), 0, "Service directory must not render floating contact bubbles");
  const directoryText = await directory.innerText();
  assert.doesNotMatch(directoryText, /(?:₫|giỏ hàng|thêm vào giỏ|SKU)/iu, "Service directory must not use commerce UI");
  const detailPrefetches = initialRequests.filter((url) => {
    const parsed = new URL(url);
    return parsed.searchParams.has("_rsc") && expectedOfferingPaths.includes(parsed.pathname.replace(/\/$/, ""));
  });
  assert.deepEqual(detailPrefetches, [], "Offering detail routes must not be eagerly prefetched");

  await search.fill("");
  await directory.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  const sampleOffering = directory.getByRole("link", { name: "Gia công sữa hạt", exact: true });
  await Promise.all([
    desktop.waitForURL((url) => url.pathname === "/gia-cong-sua-hat"),
    sampleOffering.click(),
  ]);
  assert.equal(new URL(desktop.url()).pathname, "/gia-cong-sua-hat", "An offering must be reachable in one click from the directory");
  await desktop.goto(`${origin}/thue-gia-cong/`, { waitUntil: "networkidle" });
  await desktop.screenshot({ fullPage: true, path: path.join(screenshots, "service-landing-desktop.png") });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  observeRuntime(mobile, "mobile", runtimeIssues);
  await mobile.goto(`${origin}/thue-gia-cong/do-uong-sua/`, { waitUntil: "networkidle" });
  await mobile.locator("[data-open='#main-menu']").click();
  await assertDirectHeaderLinks(mobile, true);
  const mobileServiceItem = mobile.locator("#main-menu #menu-item-5466");
  const mobileServiceLink = mobileServiceItem.getByRole("link", { name: "Thuê gia công", exact: true });
  assert.equal(await mobileServiceItem.locator(":scope > button, :scope > .sub-menu").count(), 0, "Mobile service entry must not contain a nested accordion");
  await mobileServiceLink.focus();
  assert.equal(await mobileServiceLink.evaluate((link) => document.activeElement === link), true, "Mobile service link must accept keyboard focus");
  await Promise.all([
    mobile.waitForURL((url) => url.pathname === "/thue-gia-cong"),
    mobileServiceLink.press("Enter"),
  ]);
  await mobile.getByRole("heading", { level: 1, name: "Thuê gia công" }).waitFor();
  await mobile.screenshot({ fullPage: true, path: path.join(screenshots, "service-landing-mobile.png") });

  assert.deepEqual(runtimeIssues, [], `Browser runtime must be clean:\n${runtimeIssues.join("\n")}`);
  console.log(JSON.stringify({
    screenshots,
    offerings: renderedPaths.length,
    families: families.length,
    landingRequestCount,
    landingDomNodes,
  }, null, 2));
} finally {
  await browser?.close();
  await stopChild(app);
}
