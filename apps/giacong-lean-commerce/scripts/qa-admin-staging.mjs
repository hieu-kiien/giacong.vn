// Authenticated, read-only QA for the Cloudflare Access admin hostname.
// Prepare a Playwright storage state after the operator completes Access login,
// then run with QA_ADMIN_STORAGE_STATE=path/to/state.json. This runner never
// clicks, fills, submits, or calls a mutation endpoint.
import process from "node:process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.QA_ADMIN_BASE_URL ?? "https://admin-staging.kienhieu.id.vn").replace(/\/$/, "");
const storageStatePath = process.env.QA_ADMIN_STORAGE_STATE?.trim();
const expectedRole = process.env.QA_ADMIN_EXPECTED_ROLE?.trim().toLowerCase();
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];
const adminRoutes = [
  { path: "/admin", heading: "Tổng quan vận hành" },
  { path: "/admin/noi-dung", heading: "Nội dung & thương hiệu" },
  { path: "/admin/thiet-ke", heading: "Thiết kế page" },
  { path: "/admin/san-pham", heading: "Quản lý sản phẩm" },
  { path: "/admin/dich-vu", heading: "Dịch vụ gia công" },
  { path: "/admin/tin-tuc", heading: "Viết và xuất bản tin tức" },
  { path: "/admin/dieu-huong", heading: "Điều hướng website" },
  { path: "/admin/yeu-cau", heading: "Yêu cầu báo giá" },
  { path: "/admin/thanh-vien", heading: "Tài khoản quản trị & quyền" },
  { path: "/admin/audit", heading: "Lịch sử thay đổi" },
];

const failures = [];
const check = (name, ok, detail = "") => {
  const label = `${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`;
  console.log(label);
  if (!ok) failures.push(label);
};

if (!storageStatePath) {
  console.error("ADMIN QA BLOCKED: set QA_ADMIN_STORAGE_STATE to a Playwright storage-state JSON file.");
  process.exit(2);
}

const storageState = resolve(storageStatePath);
try {
  await access(storageState);
} catch {
  console.error(`ADMIN QA BLOCKED: storage state was not found at ${storageState}.`);
  process.exit(2);
}

const browser = await chromium.launch();
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      storageState,
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const pageIssues = [];
    page.on("pageerror", (error) => pageIssues.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (!["error", "warning"].includes(message.type())) return;
      const url = message.location().url || "";
      if (url.startsWith(baseUrl)) pageIssues.push(`${message.type()}: ${message.text()}`);
    });

    for (const route of adminRoutes) {
      const response = await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      check(`${viewport.name} ${route.path} status`, response?.status() === 200, `status=${response?.status()}`);
      const heading = page.locator("h1").first();
      const rendered = await heading.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
      check(`${viewport.name} ${route.path} main rendered`, rendered);
      if (!rendered) continue;

      const actualHeading = (await heading.innerText()).trim();
      check(`${viewport.name} ${route.path} heading`, actualHeading === route.heading, `"${actualHeading}"`);
      const bodyText = await page.locator("body").innerText();
      check(
        `${viewport.name} ${route.path} has no rendered admin failure`,
        !/Cloudflare Access|Không thể tải dữ liệu|Đã xảy ra lỗi|Worker exceeded resource limits|\b1102\b|\b502\b|\b503\b/i.test(bodyText),
      );
      check(
        `${viewport.name} ${route.path} no horizontal overflow`,
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      );
      if (expectedRole) {
        check(`${viewport.name} ${route.path} expected role`, bodyText.toLowerCase().includes(expectedRole), expectedRole);
      }
    }

    check(`${viewport.name} admin console clean`, pageIssues.length === 0, pageIssues.join(" | "));
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(failures.length ? `\nADMIN STAGING QA FAILED: ${failures.length} check(s)` : "\nADMIN STAGING QA PASSED");
process.exit(failures.length ? 1 : 0);
