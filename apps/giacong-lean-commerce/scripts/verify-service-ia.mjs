import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

import { nextBinPath } from "./next-bin.mjs";

/**
 * The thirteen hub slugs `/thue-gia-cong` now indexes, in the order the real site's
 * header lists them. Only the drying family carries its offering routes here: those
 * six are the set this harness has always verified end to end, and keeping one family
 * fully spelled out means the file still states an independent expectation rather than
 * re-reading `service-families.ts` and agreeing with itself. Every href in the other
 * twelve is checked against the captured manifest by
 * `scripts/service-contract.test.mts`, and proven to resolve by `EXPECTED_GROUP_COUNT`
 * plus the per-card link probe below.
 */
const EXPECTED_FAMILY_SLUGS = [
  "gia-cong-sot-cham",
  "gia-cong-do-uong",
  "gia-cong-bot-pha-che",
  "gia-cong-duoc-lieu",
  "gia-cong-thuc-pham",
  "gia-cong-my-pham",
  "gia-cong-tra",
  "gia-cong-ca-phe",
  "gia-cong-dong-goi",
  "gia-cong-bot",
  "gia-cong-ruou",
  "gia-cong-sua",
  "say-thuc-pham-say",
];
const FEATURED_FAMILY_SLUGS = EXPECTED_FAMILY_SLUGS.slice(0, 3);
const FEATURED_FAMILY_LABELS = [
  "Gia công sốt chấm",
  "Gia công đồ uống",
  "Gia công bột pha chế",
];

const families = [
  ["say-thuc-pham-say", "Sấy & thực phẩm sấy", ["/dich-vu-say/", "/say-thang-hoa/", "/say-nong/", "/say-lanh/", "/say-chan-khong/", "/say-hong-ngoai/"]],
];

/**
 * The service route moved into the `(commerce)` group, so it is now served under
 * `CommerceHeader` rather than the captured storefront header. That header splits
 * its desktop links either side of the wordmark — `Trang chủ`/`Giới thiệu` left,
 * `Thuê gia công`/`Tin tức`/`Liên hệ` right — and turns purchasing into the mega-menu
 * trigger instead of a `Mua hàng` link. Both sets are kept as one list here because
 * the contract this file guards is unchanged: every one is a direct link, and no
 * service group hides behind a disclosure. The label set itself is asserted in
 * `scripts/commerce-header.test.mts`, which stays the single source for it.
 */
const expectedHeaderLinks = [
  ["Trang chủ", "/"],
  ["Giới thiệu", "/gioi-thieu-ve-gia-cong/"],
  ["Thuê gia công", "/thue-gia-cong/"],
  ["Tin tức", "/tin-tuc/"],
  ["Liên hệ", "/lien-he/"],
];

/** Both desktop navs of the commerce header, and the mobile drawer's single one. */
const DESKTOP_NAV_SELECTOR =
  "header[data-storefront-header] nav[aria-label='Điều hướng chính trái'], header[data-storefront-header] nav[aria-label='Điều hướng chính phải']";

const expectedOfferingPaths = families.flatMap(([, , routes]) => routes.map((route) => route.replace(/\/$/, "")));
const expectedStaticFamilyPaths = EXPECTED_FAMILY_SLUGS.map((slug) => `/thue-gia-cong/${slug}`).sort();
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

// The commerce header replaced the captured Flatsome one, so these scope to it
// instead of `#header .header-nav-main` / `#main-menu`. The contract itself is
// unchanged: the same direct text links, no service mega-menu.
async function assertDirectHeaderLinks(page, mobile = false) {
  const scope = mobile
    ? page.getByRole("dialog", { name: "Điều hướng" })
    : page.locator(DESKTOP_NAV_SELECTOR);
  for (const [name, href] of expectedHeaderLinks) {
    const link = scope.getByRole("link", { name, exact: true });
    assert.equal(await link.count(), 1, `${mobile ? "Mobile" : "Desktop"} header must expose one direct ${name} link`);
    // `next/link` normalises the authored trailing slash away (`trailingSlash`
    // is false), so compare against the canonical form of the same target.
    assert.equal(
      await link.getAttribute("href"),
      href === "/" ? "/" : href.replace(/\/$/, ""),
      `${name} must link directly to ${href}`,
    );
  }
  // On desktop, purchasing is the mega-menu trigger rather than a text link. The
  // drawer does render it as a link — there is no hover surface at 390px, and the
  // category accordion sits below it — so this is desktop-only.
  if (!mobile) {
    assert.equal(
      await scope.getByRole("link", { name: "Mua hàng", exact: true }).count(),
      0,
      "Purchasing must stay the mega-menu trigger on desktop rather than a direct link",
    );
  }
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

  const desktopServiceLink = desktop
    .locator(DESKTOP_NAV_SELECTOR)
    .getByRole("link", { name: "Thuê gia công", exact: true });
  assert.equal(await desktopServiceLink.getAttribute("aria-expanded"), null, "Desktop service navigation must be a plain link");
  assert.equal(await desktop.locator("#header .clone-desktop-service-toggle, #clone-service-menu-desktop, #header .clone-service-mega-grid").count(), 0, "Desktop service mega-menu must be removed");
  // The only header disclosure is the product category menu; services stay a
  // direct link, and no service group may appear inside that menu.
  // `Sản phẩm` is the trigger; `Danh mục sản phẩm` labels the panel it controls.
  const categoryTrigger = desktop.getByRole("button", { name: "Sản phẩm", exact: true });
  await categoryTrigger.click();
  assert.doesNotMatch(
    await desktop.locator(`#${await categoryTrigger.getAttribute("aria-controls")}`).innerText(),
    /gia công/i,
    "The product category menu must not list gia công services",
  );
  await desktop.keyboard.press("Escape");
  await desktopServiceLink.focus();
  assert.equal(await desktopServiceLink.evaluate((link) => document.activeElement === link), true, "Desktop direct service link must accept keyboard focus");

  const directory = desktop.locator("#service-directory");
  await directory.waitFor();
  const search = desktop.getByRole("searchbox", { name: "Bạn cần gia công gì?" });
  await search.waitFor();
  assert.equal(await directory.locator("[data-family-chip]").count(), 0, "Directory must not expose unapproved family filters");
  for (const label of FEATURED_FAMILY_LABELS) {
    assert.equal(await directory.getByRole("heading", { name: label, exact: true }).count(), 1, `Directory must group offerings under ${label}`);
  }

  // The approved visual opens with three featured groups. Search below still runs
  // across all thirteen service families.
  const groupCards = directory.locator("[data-service-group]");
  assert.equal(await groupCards.count(), FEATURED_FAMILY_SLUGS.length, "Directory must open with the three approved featured cards");
  const renderedFamilySlugs = await groupCards.locator("a[href^='/thue-gia-cong/']").evaluateAll(
    (links) => links.map((link) => new URL(link.href).pathname.replace("/thue-gia-cong/", "")),
  );
  assert.deepEqual(renderedFamilySlugs, FEATURED_FAMILY_SLUGS, "Featured cards must stay in the approved header order");

  const resultCount = directory.getByText(`${EXPECTED_FAMILY_SLUGS.length} nhóm dịch vụ phù hợp`, { exact: true });
  assert.equal(await resultCount.getAttribute("aria-live"), "polite", "Result count must announce client-side changes");

  const pathBeforeFilter = new URL(desktop.url()).pathname;
  await search.fill("sấy lạnh");
  await directory.getByText("1 nhóm dịch vụ phù hợp", { exact: true }).waitFor();
  assert.equal(new URL(desktop.url()).pathname, pathBeforeFilter, "Search must filter without reloading or changing route");
  assert.equal(await directory.locator("[data-service-offering]:visible").count(), 1, "Search must narrow the directory");

  // `sữa` deliberately matches two hubs: the mỹ phẩm archive files a sữa dưỡng thể
  // page, which is the real site's own tagging. Matching on hub name as well as on
  // offering label is what surfaces both.
  await search.fill("sua");
  await directory.getByText("2 nhóm dịch vụ phù hợp", { exact: true }).waitFor();

  // Diacritic folding, and the one hub with no offerings at all: it has to stay
  // reachable by name rather than being filtered out for having an empty list.
  await search.fill("duoc lieu");
  await directory.getByText("1 nhóm dịch vụ phù hợp", { exact: true }).waitFor();
  const emptyHub = directory.locator("[data-service-group]");
  assert.equal(
    await emptyHub.getByRole("heading", { name: "Gia công dược liệu", exact: true }).count(),
    1,
    "Unaccented search must reach the accented hub name",
  );
  assert.equal(await emptyHub.locator("[data-service-offering]").count(), 0, "The empty hub renders no offering rows");
  await search.fill("");

  // The index spans every hub, so its consultation link must not claim one of them.
  const consultation = directory.getByRole("link", { name: "Chưa chắc? Liên hệ tư vấn", exact: true });
  const consultationUrl = new URL(await consultation.getAttribute("href"), origin);
  assert.equal(consultationUrl.pathname, "/lien-he");
  assert.equal(consultationUrl.searchParams.get("service"), null, "The index CTA must not claim a single service");

  assert.equal(await desktop.locator(".echbay-sms-messenger, .bottom-contact").count(), 0, "Service directory must not render floating contact bubbles");
  const directoryText = await directory.innerText();
  assert.doesNotMatch(directoryText, /(?:₫|giỏ hàng|thêm vào giỏ|SKU)/iu, "Service directory must not use commerce UI");
  const detailPrefetches = initialRequests.filter((url) => {
    const parsed = new URL(url);
    return parsed.searchParams.has("_rsc") && expectedOfferingPaths.includes(parsed.pathname.replace(/\/$/, ""));
  });
  assert.deepEqual(detailPrefetches, [], "Offering detail routes must not be eagerly prefetched");

  await search.fill("sấy lạnh");
  const sampleOffering = directory.getByRole("link", { name: "Sấy lạnh", exact: true });
  await Promise.all([
    desktop.waitForURL((url) => url.pathname === "/say-lanh"),
    sampleOffering.click(),
  ]);
  assert.equal(new URL(desktop.url()).pathname, "/say-lanh", "An offering must be reachable in one click from the directory");
  await desktop.goto(`${origin}/thue-gia-cong/`, { waitUntil: "networkidle" });
  await desktop.screenshot({ fullPage: true, path: path.join(screenshots, "service-landing-desktop.png") });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  observeRuntime(mobile, "mobile", runtimeIssues);
  await mobile.goto(`${origin}/thue-gia-cong/say-thuc-pham-say/`, { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: "Mở menu" }).click();
  await assertDirectHeaderLinks(mobile, true);
  const mobileDrawer = mobile.getByRole("dialog", { name: "Điều hướng" });
  const mobileServiceItem = mobileDrawer.getByRole("listitem").filter({ hasText: "Thuê gia công" });
  const mobileServiceLink = mobileServiceItem.getByRole("link", { name: "Thuê gia công", exact: true });
  assert.equal(await mobileServiceItem.locator(":scope > button, :scope > ul").count(), 0, "Mobile service entry must not contain a nested accordion");
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
    featuredFamilies: FEATURED_FAMILY_SLUGS.length,
    families: EXPECTED_FAMILY_SLUGS.length,
    landingRequestCount,
    landingDomNodes,
  }, null, 2));
} finally {
  await browser?.close();
  await stopChild(app);
}
