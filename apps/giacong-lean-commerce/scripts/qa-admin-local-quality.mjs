// Regeneratable UI evidence. Local browser fixtures only; never calls a live admin API.
// Start `npm run dev -- --port 3100`, then `node scripts/qa-admin-local-quality.mjs`.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";

const origin = process.env.QA_LOCAL_ORIGIN ?? "http://localhost:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local fixture runner only");
const output = ".runtime/admin-quality";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const product = { id: 1, name: "Túi vải canvas in logo theo yêu cầu", slug: "tui-canvas", sku: "QA-001", categoryId: 1, categoryName: "Quà tặng", description: "Sản xuất theo thiết kế", shortDescription: "In thương hiệu theo yêu cầu", imageUrl: null, isActive: true, status: "published", leadTimeDays: 7, minimumOrderQuantity: 100, revision: 1, startingPrice: 25000, variantCount: 0, updatedAt: "2026-09-06T00:00:00Z" };
const navigationItems = [
  { id: "products", capturedMenuId: "menu-item-1742", draftParentId: null, draftHref: "/san-pham/", draftIsActive: true, draftLabel: "Mua hàng", draftSortOrder: 30, publishedParentId: null, publishedHref: "/san-pham/", publishedIsActive: true, publishedLabel: "Mua hàng", publishedSortOrder: 30, menuKey: "primary", version: 1, dirty: false, virtual: false },
  { id: "services", capturedMenuId: "menu-item-5166", draftParentId: null, draftHref: "/thue-gia-cong/", draftIsActive: true, draftLabel: "Thuê gia công", draftSortOrder: 40, publishedParentId: null, publishedHref: "/thue-gia-cong/", publishedIsActive: true, publishedLabel: "Thuê gia công", publishedSortOrder: 40, menuKey: "primary", version: 1, dirty: false, virtual: false },
  { id: "legacy-services-gia-cong-sua", capturedMenuId: "services-gia-cong-sua", draftParentId: "services", draftHref: "/gia-cong-sua/", draftIsActive: true, draftLabel: "Gia công sữa", draftSortOrder: 110, publishedParentId: "services", publishedHref: "/gia-cong-sua/", publishedIsActive: true, publishedLabel: "Gia công sữa", publishedSortOrder: 110, menuKey: "primary", version: 0, dirty: false, virtual: true },
  { id: "legacy-services-dich-vu-say", capturedMenuId: "services-dich-vu-say", draftParentId: "services", draftHref: "/dich-vu-say/", draftIsActive: true, draftLabel: "Dịch vụ sấy", draftSortOrder: 140, publishedParentId: "services", publishedHref: "/dich-vu-say/", publishedIsActive: true, publishedLabel: "Dịch vụ sấy", publishedSortOrder: 140, menuKey: "primary", version: 0, dirty: false, virtual: true },
];

async function run(name, check, role = "owner", width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  const warnings = [];
  const mutations = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/useInsertionEffect|Cannot update a component|Maximum update depth|hydration/i.test(message.text())) warnings.push(message.text());
  });
  await context.route("**/api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") mutations.push(path);
    const data = path.endsWith("/session") ? { authenticated: true, subject: "qa@example.test", role }
      : path.endsWith("/dashboard") ? { counts: { products: 28, activeProducts: 21, draftProducts: 7, services: 6, activeServices: 4, leads: 12, newLeads: 3, news: 8 }, dataReadiness: { adminMembersTable: true, auditLogsTable: true, leadsTable: true, productMetaTable: true, serviceMetaTable: true }, member: { displayName: "Người kiểm thử", role }, recentLeads: [] }
      : path.endsWith("/products") ? { products: Array.from({ length: 8 }, (_, i) => ({ ...product, id: i + 1 })), categories: [{ id: 1, name: "Quà tặng", slug: "qua-tang" }], total: 8 }
      : path.endsWith("/variants") ? { variants: [] }
      : path.endsWith("/news") ? { posts: [], total: 0 }
      : path.endsWith("/services") ? { services: [], total: 0 }
      : path.endsWith("/leads") ? { leads: [], total: 0 }
      : path.endsWith("/audit") ? { entries: [], total: 0, pagination: { currentPage: 1, lastPage: 1, pageSize: 20, total: 0 } }
      : path.endsWith("/members") ? { members: [], role }
      : path.endsWith("/navigation") ? { items: navigationItems, canEdit: true, canPublish: true }
      : path.endsWith("/site-settings") ? { canEdit: true, settings: [{ key: "brand.name", group: "brand", label: "Tên thương hiệu", description: "Tên website", type: "text", draftValue: "Giacong.vn", publishedValue: "Giacong.vn", effectiveValue: "Giacong.vn", isDefaultValue: false, version: 1, dirty: false }] }
      : path.endsWith("/pages") ? { canEdit: true, canPublish: true, pages: [{ pageKey: "home", title: "Trang chủ", routePath: "/", draftEnabled: false, publishedEnabled: false, draftBlocks: [], publishedBlocks: [], draftSeoTitle: "Trang chủ", publishedSeoTitle: "Trang chủ", draftSeoDescription: "", publishedSeoDescription: "", dirty: false, version: 1 }] }
      : { media: [], assets: [], total: 0 };
    await route.fulfill({ json: { ok: true, data } });
  });
  try {
    await check(page);
    assert.deepEqual(errors, [], "No uncaught browser errors");
    assert.deepEqual(warnings, [], "No React lifecycle warnings");
    assert.deepEqual(mutations, [], "No unexpected writes, even to fixtures");
    results.push({ name, pass: true });
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
  } finally {
    await context.close();
  }
}

async function open(page, path = "/admin") {
  await page.goto(`${origin}${path}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await expect(page.getByTestId("status-table-loading")).toHaveCount(0);
}

await run("Mobile navigation closes with Escape and restores focus", async (page) => {
  await open(page);
  const trigger = page.getByTestId("button-toggle-admin-nav");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
}, "owner", 390);

await run("Mobile navigation has reachable close, traps focus and dismisses outside", async (page) => {
  await open(page);
  await page.getByTestId("button-toggle-admin-nav").click();
  const close = page.getByTestId("button-close-admin-nav");
  await expect(close).toBeVisible();
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.locator("aside").evaluate((el) => el.contains(document.activeElement)), true);
  await page.getByTestId("admin-nav-backdrop").click({ position: { x: 380, y: 100 } });
  await expect(page.getByTestId("button-toggle-admin-nav")).toHaveAttribute("aria-expanded", "false");
}, "owner", 390);

await run("Products show records and edit action before optional CSV tools", async (page) => {
  await open(page, "/admin/san-pham");
  await expect(page.getByTestId("row-product-1")).toBeInViewport();
  await expect(page.getByTestId("button-product-edit-1")).toBeInViewport();
  await expect(page.getByTestId("button-product-import-sample")).not.toBeVisible();
  await page.getByText("Nhập sản phẩm từ CSV", { exact: true }).click();
  await expect(page.getByTestId("button-product-import-sample")).toBeVisible();
  await page.getByText("Nhập sản phẩm từ CSV", { exact: true }).click();
  await page.screenshot({ path: `${output}/products-desktop.png`, fullPage: true });
});

await run("Retired sales role receives no dashboard action links", async (page) => {
  await open(page);
  await expect(page.getByTestId("link-dashboard-products")).toHaveCount(0);
  await expect(page.getByTestId("link-dashboard-leads")).toHaveCount(0);
}, "sales_manager");

await run("Retired viewer role receives no dashboard action links", async (page) => {
  await open(page);
  await expect(page.getByTestId("link-dashboard-services")).toHaveCount(0);
  await expect(page.getByTestId("link-dashboard-leads")).toHaveCount(0);
}, "viewer");

await run("Failed product request announces error and retry recovers", async (page) => {
  let fail = true;
  await page.route("**/api/admin/products?**", async (route) => {
    if (fail) await route.fulfill({ status: 503, json: { ok: false, code: "UNAVAILABLE", message: "Kết nối tạm gián đoạn" } });
    else await route.fallback();
  });
  await open(page, "/admin/san-pham");
  await expect(page.getByTestId("status-admin-error")).toHaveAttribute("role", "alert");
  await expect(page.getByTestId("status-admin-error")).toContainText("Kết nối tạm gián đoạn");
  fail = false;
  await page.getByTestId("button-retry-data").click();
  await expect(page.getByTestId("row-product-1")).toBeVisible();
});

await run("Owner dashboard desktop evidence", async (page) => {
  await open(page);
  await page.screenshot({ path: `${output}/dashboard-desktop.png`, fullPage: true });
});

await run("News draft survives sidebar navigation and cancelled discard", async (page) => {
  await open(page, "/admin/tin-tuc");
  await page.getByTestId("button-news-create").click();
  await page.getByTestId("input-news-title").fill("Bản nháp cần giữ lại");
  await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Ở lại", exact: true }).click();
  await expect(page.getByTestId("input-news-title")).toHaveValue("Bản nháp cần giữ lại");
  await page.getByTestId("button-news-cancel").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Ở lại", exact: true }).click();
  await expect(page.getByTestId("input-news-title")).toHaveValue("Bản nháp cần giữ lại");
});

await run("Legacy service hubs show source state before an operator adopts them", async (page) => {
  await open(page, "/admin/dieu-huong");
  const label = page.locator("#navigation-legacy-services-gia-cong-sua-label");
  const card = label.locator("xpath=ancestor::article[1]");
  await expect(card.getByText("Gia công sữa", { exact: true })).toBeVisible();
  await expect(card.getByText("Mục con nguồn cũ · chưa lưu bản quản lý", { exact: true })).toBeVisible();
  await label.fill("Gia công sữa demo");
  await expect(card.getByRole("button", { name: "Bật quản lý", exact: true })).toBeEnabled();
});

for (const [path, prepare, inputId] of [
  ["/admin/noi-dung", null, "setting-brand.name"],
  ["/admin/thiet-ke", null, "builder-seo-title"],
  ["/admin/dieu-huong", "Thêm mục", "navigation-new-label"],
  ["/admin/thanh-vien", "Thêm tài khoản quản trị", "member-new-name"],
  ["/admin/dich-vu", "Thêm dịch vụ", "service-name"],
]) {
  await run(`Draft navigation guard: ${path}`, async (page) => {
    await open(page, path);
    if (prepare) await page.getByRole("button", { name: prepare, exact: true }).click();
    const input = inputId === "service-name" ? page.getByTestId("input-service-name") : page.locator(`[id="${inputId}"]`);
    await input.fill("Thay đổi chưa lưu");
    if (path === "/admin/dieu-huong" || path === "/admin/thanh-vien") {
      await page.getByRole("button", { name: "Tải lại", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Ở lại", exact: true }).click();
      await expect(input).toHaveValue("Thay đổi chưa lưu");
    }
    const shouldWarnOnReload = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(shouldWarnOnReload, true, "Reload must protect drafts");
    await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await expect(input).toHaveValue("Thay đổi chưa lưu");
    await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/admin/san-pham`);
  });
}

for (const width of [390, 1440]) {
  await run(`Ten admin routes at ${width}px: layout, labels, runtime`, async (page) => {
    for (const path of ["/admin", "/admin/san-pham", "/admin/dich-vu", "/admin/tin-tuc", "/admin/noi-dung", "/admin/thiet-ke", "/admin/dieu-huong", "/admin/thanh-vien", "/admin/audit"]) {
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${path}: no page overflow`);
      await page.screenshot({ path: `${output}/${path.split("/").at(-1)}-${width}.png`, fullPage: true });
    }
  }, "owner", width);
}

for (const direction of ["back", "forward"]) {
  await run(`Dirty product history ${direction}: stay and discard`, async (page) => {
    await open(page, "/admin/tin-tuc");
    await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
    await expect(page.getByTestId("button-product-edit-1")).toBeVisible();
    if (direction === "forward") {
      await page.getByRole("link", { name: "Tin tức", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/admin/tin-tuc`);
      await page.goBack();
      await expect(page.getByTestId("button-product-edit-1")).toBeVisible();
    }
    await page.getByTestId("button-product-edit-1").click();
    const name = page.getByLabel("Tên sản phẩm");
    await name.fill("Giữ tên sản phẩm đang sửa");
    await page.evaluate((step) => history.go(step), direction === "back" ? -1 : 1);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(`${origin}/admin/san-pham`);
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await expect(name).toHaveValue("Giữ tên sản phẩm đang sửa");
    await page.evaluate((step) => history.go(step), direction === "back" ? -1 : 1);
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/admin/tin-tuc`);
  });
}

await browser.close();
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
for (const result of results) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error.split("\n")[0]}` : ""}`);
process.exitCode = results.some((result) => !result.pass) ? 1 : 0;
