// Authenticated, read-only QA for the Cloudflare Access admin hostname.
// Prepare a Playwright storage state after the operator completes Access login,
// then run with QA_ADMIN_STORAGE_STATE=path/to/state.json, or provide a complete
// role map with QA_ADMIN_ROLE_STATES=path/to/role-states.json. This runner never
// clicks, fills, submits, or calls a mutation endpoint.
import process from "node:process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.QA_ADMIN_BASE_URL ?? "https://admin-staging.kienhieu.id.vn").replace(/\/$/, "");
const storageStatePath = process.env.QA_ADMIN_STORAGE_STATE?.trim();
const roleStatesPath = process.env.QA_ADMIN_ROLE_STATES?.trim();
const expectedRole = process.env.QA_ADMIN_EXPECTED_ROLE?.trim().toLowerCase();
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];
const supportedRoles = ["owner", "content_manager", "catalog_manager", "sales_manager", "viewer"];
const roleLabels = {
  owner: "Chủ sở hữu",
  content_manager: "Quản lý nội dung",
  catalog_manager: "Quản lý catalog",
  sales_manager: "Quản lý yêu cầu",
  viewer: "Người xem",
};
const roleNavigationRoutes = {
  owner: ["/admin/noi-dung", "/admin/thiet-ke", "/admin/san-pham", "/admin/dich-vu", "/admin/tin-tuc", "/admin/dieu-huong", "/admin/yeu-cau", "/admin", "/admin/thanh-vien", "/admin/audit"],
  content_manager: ["/admin/noi-dung", "/admin/thiet-ke", "/admin/san-pham", "/admin/dich-vu", "/admin/tin-tuc", "/admin/dieu-huong", "/admin"],
  catalog_manager: ["/admin/san-pham", "/admin"],
  sales_manager: ["/admin/yeu-cau", "/admin"],
  viewer: ["/admin/noi-dung", "/admin/thiet-ke", "/admin/san-pham", "/admin/dich-vu", "/admin/tin-tuc", "/admin/dieu-huong", "/admin/yeu-cau", "/admin"],
};
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

function blocked(message) {
  console.error(`ADMIN QA BLOCKED: ${message}`);
  process.exit(2);
}

async function assertStorageState(path, label) {
  const storageState = resolve(path);
  try {
    await access(storageState);
  } catch {
    blocked(`${label} storage state was not found at ${storageState}.`);
  }
  return storageState;
}

async function loadRoleStates() {
  if (storageStatePath && roleStatesPath) {
    blocked("set either QA_ADMIN_STORAGE_STATE or QA_ADMIN_ROLE_STATES, not both.");
  }

  if (roleStatesPath) {
    let parsed;
    const matrixPath = resolve(roleStatesPath);
    try {
      parsed = JSON.parse(await readFile(matrixPath, "utf8"));
    } catch {
      blocked(`role-state map was not valid JSON at ${matrixPath}.`);
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      blocked("QA_ADMIN_ROLE_STATES must point to a JSON object mapping every supported role to a storage-state path.");
    }

    const roles = Object.keys(parsed);
    const missingRoles = supportedRoles.filter((role) => !roles.includes(role));
    const unknownRoles = roles.filter((role) => !supportedRoles.includes(role));
    if (missingRoles.length || unknownRoles.length) {
      blocked(`role-state map must contain exactly owner, content_manager, catalog_manager, sales_manager and viewer (missing: ${missingRoles.join(", ") || "none"}; unknown: ${unknownRoles.join(", ") || "none"}).`);
    }

    return Promise.all(supportedRoles.map(async (role) => {
      const path = parsed[role];
      if (typeof path !== "string" || !path.trim()) {
        blocked(`${role} must map to a storage-state JSON path.`);
      }
      return { role, storageState: await assertStorageState(path, role) };
    }));
  }

  if (!storageStatePath) {
    blocked("set QA_ADMIN_STORAGE_STATE for one identity or QA_ADMIN_ROLE_STATES for the complete role matrix.");
  }

  return [{
    role: expectedRole || null,
    storageState: await assertStorageState(storageStatePath, "admin"),
  }];
}

const roleStates = await loadRoleStates();
const matrixMode = Boolean(roleStatesPath);

const browser = await chromium.launch();
try {
  for (const operator of roleStates) {
    const routes = operator.role && matrixMode
      ? adminRoutes.filter((route) => roleNavigationRoutes[operator.role]?.includes(route.path))
      : adminRoutes;
    for (const viewport of viewports) {
      const context = await browser.newContext({
        storageState: operator.storageState,
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

      for (const route of routes) {
        const response = await page.goto(`${baseUrl}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        check(`${operator.role ?? "admin"} ${viewport.name} ${route.path} status`, response?.status() === 200, `status=${response?.status()}`);
        const heading = page.locator("h1").first();
        const rendered = await heading.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
        check(`${operator.role ?? "admin"} ${viewport.name} ${route.path} main rendered`, rendered);
        if (!rendered) continue;

        const actualHeading = (await heading.innerText()).trim();
        check(
          `${operator.role ?? "admin"} ${viewport.name} ${route.path} heading`,
          actualHeading === route.heading,
          `"${actualHeading}"`,
        );
        const bodyText = await page.locator("body").innerText();
        check(
          `${operator.role ?? "admin"} ${viewport.name} ${route.path} has no rendered admin failure`,
          !/Cloudflare Access|Không thể tải dữ liệu|Đã xảy ra lỗi|Worker exceeded resource limits|\b1102\b|\b502\b|\b503\b/i.test(bodyText),
        );
        check(
          `${operator.role ?? "admin"} ${viewport.name} ${route.path} no horizontal overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        );
        if (operator.role) {
          const roleMarker = roleLabels[operator.role] ?? operator.role;
          const normalizedBody = bodyText.toLocaleLowerCase("vi");
          check(
            `${operator.role} ${viewport.name} ${route.path} expected role`,
            normalizedBody.includes(operator.role.toLocaleLowerCase("vi")) || normalizedBody.includes(roleMarker.toLocaleLowerCase("vi")),
            roleMarker,
          );
        }

        if (matrixMode && operator.role && route.path === "/admin") {
          const actualNavigationRoutes = await page.locator('nav[aria-label="Các khu vực quản trị"] a[href^="/admin"]').evaluateAll((links) => (
            links.map((link) => link.getAttribute("href")).filter(Boolean)
          ));
          check(
            `${operator.role} ${viewport.name} navigation route matrix`,
            JSON.stringify(actualNavigationRoutes) === JSON.stringify(roleNavigationRoutes[operator.role]),
            `expected=${roleNavigationRoutes[operator.role].join(",")} actual=${actualNavigationRoutes.join(",")}`,
          );
        }
      }

      check(`${operator.role ?? "admin"} ${viewport.name} admin console clean`, pageIssues.length === 0, pageIssues.join(" | "));
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(failures.length ? `\nADMIN STAGING QA FAILED: ${failures.length} check(s)` : "\nADMIN STAGING QA PASSED");
process.exit(failures.length ? 1 : 0);
