import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright";

const families = [
  ["do-uong-sua", "Đồ uống & sữa", ["/gia-cong-do-uong/", "/gia-cong-sua/", "/gia-cong-sua-bot/", "/gia-cong-sua-tuoi/", "/gia-cong-sua-hat/", "/gia-cong-sua-thuc-vat/", "/gia-cong-sua-chua/", "/gia-cong-nuoc-ep-trai-cay/", "/gia-cong-nuoc-giai-khat-co-ga/", "/gia-cong-tra-dong-chai/", "/gia-cong-nuoc-uong-dong-chai/", "/gia-cong-ruou/"]],
  ["say-thuc-pham-say", "Sấy & thực phẩm sấy", ["/dich-vu-say/", "/say-thang-hoa/", "/say-nong/", "/say-lanh/", "/say-chan-khong/", "/say-hong-ngoai/"]],
  ["thuc-pham-bot-gia-vi", "Thực phẩm, bột & gia vị", ["/gia-cong-thuc-pham/", "/thuc-pham-chuc-nang/", "/bot-gia-vi/", "/gia-cong-bot/", "/gia-cong-bot-pha-che/", "/gia-cong-sot-cham/"]],
  ["tra-ca-phe-duoc-lieu", "Trà, cà phê & dược liệu", ["/gia-cong-tra/", "/gia-cong-ca-phe/", "/gia-cong-duoc-lieu/", "/rang-gia-cong-ca-phe/", "/gia-cong-ca-phe-hoa-tan/", "/gia-cong-ca-phe-qua-tang/", "/gia-cong-tra-tui-loc/"]],
  ["my-pham-cham-soc-ca-nhan", "Mỹ phẩm & chăm sóc cá nhân", ["/gia-cong-my-pham/"]],
  ["dong-goi-hoan-thien", "Đóng gói & hoàn thiện", ["/gia-cong-dong-goi/", "/dich-vu-dong-goi-bao-jumbo/", "/dich-vu-dong-goi-bot-hoa-tan/", "/dich-vu-dong-goi-dang-long-goi-nho/", "/dich-vu-dong-goi-dang-ong-stick/", "/dich-vu-dong-goi-vien-nen-vien-nang/"]],
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

const appPort = await port();
const logs = [];
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)], {
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

  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const runtimeIssues = [];
  desktop.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeIssues.push(`desktop console ${message.type()}: ${message.text()}`);
  });
  desktop.on("pageerror", (error) => runtimeIssues.push(`desktop pageerror: ${error.message}`));
  await desktop.goto(`${origin}/thue-gia-cong/`, { waitUntil: "domcontentloaded" });
  await desktop.getByRole("heading", { level: 1, name: "Thuê gia công" }).waitFor();
  const desktopServiceLink = desktop.locator("#header").getByRole("link", { name: "Thuê gia công", exact: true });
  await desktopServiceLink.waitFor();
  assert.equal(await desktopServiceLink.getAttribute("href"), "/thue-gia-cong/");
  assert.equal(await desktopServiceLink.getAttribute("aria-expanded"), null, "Desktop navigation link must remain a plain link");
  const desktopToggle = desktop.locator("#header").getByRole("button", { name: "Mở menu Thuê gia công" });
  await desktopToggle.click();
  assert.equal(await desktopToggle.getAttribute("aria-expanded"), "true");
  await desktop.screenshot({ fullPage: true, path: "docs/design-references/service-landing-desktop.png" });
  await desktopToggle.press("Escape");
  assert.equal(await desktopToggle.getAttribute("aria-expanded"), "false", "Escape must collapse the desktop service menu");
  assert.equal(
    await desktopToggle.evaluate((toggle) => document.activeElement === toggle),
    true,
    "Escape must return focus to the desktop service disclosure",
  );
  for (const [slug, label] of families) {
    await desktop.locator("#header").getByRole("link", { name: label, exact: true }).waitFor();
    const familyUrl = `${origin}/thue-gia-cong/${slug}/`;
    const response = await fetch(familyUrl);
    assert.equal(response.status, 200, `${familyUrl} must resolve`);
    await desktop.goto(familyUrl, { waitUntil: "domcontentloaded" });
    await desktop.getByRole("heading", { level: 1, name: label }).waitFor();
    for (const leaf of families.find(([candidate]) => candidate === slug)[2]) {
      const renderedLeaf = leaf.replace(/\/$/, "");
      const leafLink = desktop.locator(`#catalog-main a[href='${renderedLeaf}']`);
      assert.equal(
        await leafLink.count(),
        1,
        `${slug} must render one verified route ${leaf}; hrefs=${JSON.stringify(await desktop.locator("#catalog-main a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))))}`,
      );
      const href = await leafLink.getAttribute("href");
      assert.equal(href, renderedLeaf, `${slug} must link verified route ${leaf}`);
      assert.equal((await fetch(`${origin}${leaf}`)).status, 200, `${leaf} must resolve`);
    }
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) runtimeIssues.push(`mobile console ${message.type()}: ${message.text()}`);
  });
  mobile.on("pageerror", (error) => runtimeIssues.push(`mobile pageerror: ${error.message}`));
  await mobile.goto(`${origin}/thue-gia-cong/`, { waitUntil: "domcontentloaded" });
  await mobile.locator("[data-open='#main-menu']").click();
  const mobileServiceItem = mobile.locator("#main-menu #menu-item-5466");
  const mobileLink = mobileServiceItem.getByRole("link", { name: "Thuê gia công", exact: true });
  const mobileToggle = mobileServiceItem.getByRole("button", { name: "Mở menu con" });
  assert.equal(await mobileLink.getAttribute("href"), "/thue-gia-cong/");
  const mobilePathBeforeDisclosure = new URL(mobile.url()).pathname;
  await mobileToggle.click();
  assert.equal(await mobileToggle.getAttribute("aria-expanded"), "true");
  assert.equal(new URL(mobile.url()).pathname, mobilePathBeforeDisclosure, "Mobile disclosure must not navigate");
  assert.equal(await mobileServiceItem.locator(":scope > .sub-menu > li").count(), 6, "Mobile menu must expose six families");
  await mobile.screenshot({ fullPage: true, path: "docs/design-references/service-landing-mobile.png" });
  assert.deepEqual(runtimeIssues, [], `Browser console must be clean:\n${runtimeIssues.join("\n")}`);
} finally {
  await browser?.close();
  await stopChild(app);
}
