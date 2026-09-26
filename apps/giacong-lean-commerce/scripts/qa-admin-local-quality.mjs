// Regeneratable UI evidence. Local browser fixtures only; never calls a live admin API.
// Start `npm run dev -- --port 3100`, then `node scripts/qa-admin-local-quality.mjs`.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";

const origin = process.env.QA_LOCAL_ORIGIN ?? "http://localhost:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local fixture runner only");
const readyDataSources = {
  activeProducts: true,
  activeServices: true,
  adminMembersTable: true,
  auditLogsTable: true,
  leadsTable: true,
  newLeads: true,
  newsPostsTable: true,
  productDraftsReady: true,
  productMetaTable: true,
  productsTable: true,
  recentLeads: true,
  serviceMetaTable: true,
  servicesTable: true,
};
let dashboardReadiness = { ...readyDataSources };
const output = ".runtime/admin-quality";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const product = { id: 1, name: "Túi vải canvas in logo theo yêu cầu", slug: "tui-canvas", sku: "QA-001", categoryId: 1, categoryName: "Quà tặng", description: "Sản xuất theo thiết kế", shortDescription: "In thương hiệu theo yêu cầu", imageUrl: null, isActive: true, status: "published", leadTimeDays: 7, minimumOrderQuantity: 100, revision: 1, startingPrice: 25000, variantCount: 0, updatedAt: "2026-09-06T00:00:00Z" };
const newsItems = Array.from({ length: 27 }, (_, index) => {
  const isPublished = index < 20;
  const id = isPublished ? index + 1 : index + 81;
  return {
    excerpt: `Nội dung kiểm thử ${id}`,
    hasUnpublishedChanges: false,
    id,
    isPublished,
    publishedAt: isPublished ? "2026-09-06T00:00:00Z" : null,
    revision: 1,
    slug: `bai-viet-qa-${id}`,
    title: `${isPublished ? "Bài đã đăng" : "Bản nháp"} ${id}`,
    updatedAt: "2026-09-06T00:00:00Z",
  };
});
const navigationItems = [
  { id: "products", capturedMenuId: "menu-item-1742", draftParentId: null, draftHref: "/san-pham/", draftIsActive: true, draftLabel: "Mua hàng", draftSortOrder: 30, publishedParentId: null, publishedHref: "/san-pham/", publishedIsActive: true, publishedLabel: "Mua hàng", publishedSortOrder: 30, menuKey: "primary", version: 1, dirty: false, virtual: false },
  { id: "services", capturedMenuId: "menu-item-5166", draftParentId: null, draftHref: "/thue-gia-cong/", draftIsActive: true, draftLabel: "Thuê gia công", draftSortOrder: 40, publishedParentId: null, publishedHref: "/thue-gia-cong/", publishedIsActive: true, publishedLabel: "Thuê gia công", publishedSortOrder: 40, menuKey: "primary", version: 1, dirty: false, virtual: false },
  { id: "legacy-services-gia-cong-sua", capturedMenuId: "services-gia-cong-sua", draftParentId: "services", draftHref: "/gia-cong-sua/", draftIsActive: true, draftLabel: "Gia công sữa", draftSortOrder: 110, publishedParentId: "services", publishedHref: "/gia-cong-sua/", publishedIsActive: true, publishedLabel: "Gia công sữa", publishedSortOrder: 110, menuKey: "primary", version: 0, dirty: false, virtual: true },
  { id: "legacy-services-dich-vu-say", capturedMenuId: "services-dich-vu-say", draftParentId: "services", draftHref: "/dich-vu-say/", draftIsActive: true, draftLabel: "Dịch vụ sấy", draftSortOrder: 140, publishedParentId: "services", publishedHref: "/dich-vu-say/", publishedIsActive: true, publishedLabel: "Dịch vụ sấy", publishedSortOrder: 140, menuKey: "primary", version: 0, dirty: false, virtual: true },
];

async function run(name, check, role = "owner", width = 1440, height = 900) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
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
      : path.endsWith("/dashboard") ? { counts: { products: 28, activeProducts: 21, draftProducts: 7, services: 6, activeServices: 4, leads: 12, newLeads: 3, news: 8 }, dataReadiness: dashboardReadiness, member: { displayName: "Người kiểm thử", role }, recentLeads: [{ createdAt: "2026-09-06T00:00:00Z", fullName: "Doanh nghiệp kiểm thử", id: "qa-lead-1", status: "new" }] }
      : /\/products\/\d+$/.test(path) ? { product: { ...product, id: Number(path.split("/").at(-1)) } }
      : path.endsWith("/products") ? { products: Array.from({ length: 8 }, (_, i) => ({ ...product, id: i + 1 })), categories: [{ id: 1, name: "Quà tặng", slug: "qua-tang" }], total: 8 }
      : path.endsWith("/variants") ? { variants: [] }
      : path.endsWith("/news") ? (() => {
        const url = new URL(route.request().url());
        const page = Number(url.searchParams.get("page") ?? 1);
        const status = url.searchParams.get("status");
        const query = (url.searchParams.get("q") ?? "").toLocaleLowerCase();
        const queryFiltered = newsItems.filter((post) =>
          !query || post.title.toLocaleLowerCase().includes(query) || post.slug.toLocaleLowerCase().includes(query),
        );
        const filtered = queryFiltered.filter((post) => status === "draft" ? !post.isPublished : status === "published" ? post.isPublished : true);
        const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
        const total = filtered.length;
        return {
          posts: filtered.slice((page - 1) * pageSize, page * pageSize),
          total,
          statusCounts: {
            draft: queryFiltered.filter((post) => !post.isPublished).length,
            published: queryFiltered.filter((post) => post.isPublished).length,
            total: queryFiltered.length,
          },
          pagination: { currentPage: page, lastPage: Math.max(1, Math.ceil(total / pageSize)), pageSize, total },
        };
      })()
      : path.endsWith("/services") ? { services: [], total: 0 }
      : path.endsWith("/leads") ? { leads: [], total: 0 }
      : path.endsWith("/audit") ? { entries: [], total: 0, pagination: { currentPage: 1, lastPage: 1, pageSize: 20, total: 0 } }
      : path.endsWith("/crm/customers") ? { items: [], pagination: { currentPage: 1, lastPage: 1, pageSize: 20, total: 0 } }
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
  await page.getByTestId("button-open-csv-import").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("button-product-import-sample")).toBeVisible();
  const sampleDownload = page.waitForEvent("download");
  await page.getByTestId("button-product-import-sample").click();
  assert.match((await sampleDownload).suggestedFilename(), /\.csv$/i, "Sample import file downloads as CSV");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: `${output}/products-desktop-1920x1080.png` });
}, "owner", 1920, 1080);

await run("Product status filters stay shareable and reset when cleared", async (page) => {
  await open(page, "/admin/san-pham?status=draft");
  const filters = page.getByRole("group", { name: "Lọc sản phẩm theo trạng thái" });
  const all = filters.getByRole("button", { name: "Tất cả", exact: true });
  const drafts = filters.getByRole("button", { name: "Bản nháp / Chờ duyệt", exact: true });

  await expect(drafts).toHaveAttribute("aria-pressed", "true");
  await all.click();
  await expect(page).not.toHaveURL(/(?:\?|&)status=/);
  await page.reload();
  await expect(all).toHaveAttribute("aria-pressed", "true");

  await drafts.click();
  await expect(page).toHaveURL(/(?:\?|&)status=draft(?:&|$)/);
  await page.reload();
  await expect(drafts).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => history.back());
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(page).not.toHaveURL(/(?:\?|&)status=/);
  await page.evaluate(() => history.forward());
  await expect(drafts).toHaveAttribute("aria-pressed", "true");
});

await run("Customer creation fields expose their accessible names", async (page) => {
  await open(page, "/admin/khach-hang");
  await page.getByRole("button", { name: "Thêm khách hàng" }).click();
  const dialog = page.getByRole("dialog");

  for (const label of [
    "Tên công ty / Đơn vị đặt hàng *",
    "Mã số thuế (MST)",
    "Số điện thoại",
    "Email liên hệ",
    "Ngành nghề sản xuất",
    "Phân hạng khách hàng",
  ]) {
    await expect(dialog.getByLabel(label, { exact: true })).toBeVisible();
  }
});

await run("Product validation link opens the correct tab and focuses the invalid field", async (page) => {
  await open(page, "/admin/san-pham");
  await page.getByTestId("button-product-create").click();
  await page.getByTestId("input-product-name").fill("Sản phẩm kiểm tra");
  await page.getByTestId("input-product-slug").fill("san-pham-kiem-tra");
  await page.getByRole("tab", { name: "Ảnh & Media" }).click();
  await page.getByTestId("input-product-image").fill("javascript:alert(1)");
  await page.getByTestId("button-product-save").click();
  const fieldError = page.getByTestId("button-product-error-imageUrl");
  await expect(fieldError).toContainText("Ảnh chính");
  await fieldError.click();
  await expect(page.getByRole("tab", { name: "Ảnh & Media" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("input-product-image")).toBeFocused();
}, "owner", 1920, 1080);

await run("Service validation links focus the field and retry the same request id", async (page) => {
  const requestIds = [];
  await page.route("**/api/admin/services", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    requestIds.push(route.request().postDataJSON().requestId);
    await route.fulfill({
      status: 422,
      json: { ok: false, code: "VALIDATION_ERROR", message: "Dữ liệu dịch vụ chưa hợp lệ.", fieldErrors: { offerings: "Kiểm tra danh sách hạng mục." } },
    });
  });
  await open(page, "/admin/dich-vu");
  await page.getByTestId("button-service-create").click();
  await page.getByTestId("input-service-name").fill("Dịch vụ kiểm tra");
  await page.getByTestId("input-service-slug").fill("dich-vu-kiem-tra");
  await page.getByTestId("button-service-save").click();
  const fieldError = page.getByTestId("button-service-error-offerings");
  await expect(fieldError).toContainText("Hạng mục dịch vụ");
  await fieldError.click();
  await expect(page.locator("#service-tab-btn-offerings")).toHaveAttribute("aria-selected", "true");
  const offeringEditor = page.getByTestId("input-service-offerings");
  await expect(offeringEditor).toBeFocused();
  assert.equal(await offeringEditor.evaluate((element) => element.closest("details")?.open), true);
  await page.getByTestId("button-service-save").click();
  assert.equal(requestIds.length, 2);
  assert.equal(requestIds[0], requestIds[1], "The same service payload reuses its idempotency key after an error");
}, "owner", 1920, 1080);

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
  await expect(page.getByTestId("metric-products").locator(".admin-metric-value")).toHaveText("28");
  await expect(page.getByTestId("metric-draft-products").locator(".admin-metric-value")).toHaveText("7");
  await expect(page.getByTestId("metric-news").locator(".admin-metric-value")).toHaveText("8");
  await expect(page.getByText("Doanh nghiệp kiểm thử")).toBeVisible();
  await page.screenshot({ path: `${output}/dashboard-desktop.png`, fullPage: true });
});

await run("Dashboard never presents unavailable data as a genuine zero", async (page) => {
  dashboardReadiness = {
    ...readyDataSources,
    leadsTable: false,
    newsPostsTable: false,
    productDraftsReady: false,
    productsTable: false,
    recentLeads: true,
  };
  try {
    await open(page);
    await expect(page.getByTestId("metric-products").locator(".admin-metric-value")).toHaveText("—");
    await expect(page.getByTestId("metric-draft-products").locator(".admin-metric-value")).toHaveText("—");
    await expect(page.getByTestId("metric-news").locator(".admin-metric-value")).toHaveText("—");
    await expect(page.getByText("Chưa thể tải yêu cầu báo giá.")).toBeVisible();
    await expect(page.getByText("Chưa xác định trạng thái bản nháp vì dữ liệu sản phẩm chưa sẵn sàng.")).toBeVisible();
    await page.screenshot({ path: `${output}/dashboard-unavailable-1920x1080.png`, fullPage: true });
  } finally {
    dashboardReadiness = { ...readyDataSources };
  }
}, "owner", 1920, 1080);

await run("Dashboard labels failed filtered counts as unknown", async (page) => {
  dashboardReadiness = {
    ...readyDataSources,
    activeProducts: false,
    activeServices: false,
    newLeads: false,
  };
  try {
    await open(page);
    await expect(page.getByText("Chưa tải được số sản phẩm đang hoạt động")).toBeVisible();
    await expect(page.getByText("Chưa tải được số dịch vụ đang hoạt động")).toBeVisible();
    await expect(page.getByText("Chưa xác định", { exact: true })).toBeVisible();
    await expect(page.getByText("21 đang hoạt động")).toHaveCount(0);
    await expect(page.getByText("4 đang hoạt động")).toHaveCount(0);
    await expect(page.getByText("3 yêu cầu mới", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Xử lý 3 yêu cầu mới" })).toHaveCount(0);
    await expect(page.getByText("Chưa xác định được số yêu cầu mới")).toBeVisible();
    const readiness = page.getByTestId("accordion-data-readiness");
    await readiness.locator("summary").click();
    await expect(readiness).toContainText("Số sản phẩm đang hoạt động");
    await expect(readiness).toContainText("Số dịch vụ đang hoạt động");
    await expect(readiness).toContainText("Số yêu cầu mới");
    await expect(readiness).toContainText("Chưa tải được");
    await expect(readiness).not.toContainText("activeProducts");
    await expect(readiness).not.toContainText("Chưa có");
  } finally {
    dashboardReadiness = { ...readyDataSources };
  }
}, "owner", 1920, 1080);

await run("Dashboard reports an unavailable recent-lead preview separately", async (page) => {
  dashboardReadiness = { ...readyDataSources, recentLeads: false };
  try {
    await open(page);
    await expect(page.getByText("3 yêu cầu mới", { exact: true })).toBeVisible();
    await expect(page.locator(".admin-queue-view-all")).toContainText("12");
    await expect(page.getByText("Chưa thể tải danh sách yêu cầu gần đây.")).toBeVisible();
    await expect(page.getByText("Chưa có yêu cầu báo giá nào trong hàng đợi.")).toHaveCount(0);
  } finally {
    dashboardReadiness = { ...readyDataSources };
  }
}, "owner", 1920, 1080);

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

await run("News status filters include records beyond the first unfiltered page", async (page) => {
  await open(page, "/admin/tin-tuc");
  await expect(page.getByTestId("row-news-1")).toBeVisible();
  await expect(page.getByTestId("row-news-101")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Bản nháp\s+7/ })).toBeVisible();
  await page.getByRole("button", { name: /Bản nháp\s+7/ }).click();
  await expect(page.getByTestId("row-news-101")).toBeVisible();
  await expect(page.getByTestId("row-news-1")).toHaveCount(0);
  await expect(page.locator(".admin-pagination-copy")).toContainText("1–7 trong 7");
  await page.getByRole("button", { name: /Đã phát hành\s+20/ }).click();
  await expect(page.getByTestId("row-news-1")).toBeVisible();
  await expect(page.locator(".admin-pagination-copy")).toContainText("1–20 trong 20");
}, "owner", 1920, 1080);

await run("News search persists, filters before paging and exposes the selected status", async (page) => {
  await open(page, "/admin/tin-tuc");
  const filters = page.getByRole("group", { name: "Lọc bài viết theo trạng thái" });
  await page.getByTestId("input-news-search").fill("bai-viet-qa-101");
  await page.getByTestId("button-news-search").click();
  await expect(page).toHaveURL(/\/admin\/tin-tuc\?q=bai-viet-qa-101/);
  await expect(page.getByTestId("row-news-101")).toBeVisible();
  await expect(page.locator(".admin-pagination-copy")).toContainText("1–1 trong 1");
  await expect(filters.getByRole("button", { name: /Tất cả/ })).toHaveAttribute("aria-pressed", "true");
  await filters.getByRole("button", { name: /Bản nháp/ }).click();
  await expect(filters.getByRole("button", { name: /Bản nháp/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("button-news-clear-search").click();
  await expect(page).not.toHaveURL(/\bq=/);
  await filters.getByRole("button", { name: /Tất cả/ }).click();
  await expect(page.getByTestId("row-news-1")).toBeVisible();
}, "owner", 1920, 1080);

await run("Content publishing asks before writing and reports the saved state", async (page) => {
  const initialSetting = {
    key: "brand.name",
    group: "brand",
    label: "Tên thương hiệu",
    description: "Tên website",
    type: "text",
    draftValue: "Giacong.vn",
    publishedValue: "Giacong.vn",
    effectiveValue: "Giacong.vn",
    isDefaultValue: false,
    version: 1,
    dirty: false,
  };
  const writes = [];
  await page.route("**/api/admin/site-settings", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    writes.push("draft");
    const body = route.request().postDataJSON();
    const setting = { ...initialSetting, draftValue: body.value, version: 2, dirty: true };
    await route.fulfill({ json: { ok: true, data: { setting } } });
  });
  await page.route("**/api/admin/site-settings/publish", async (route) => {
    writes.push("publish");
    const setting = { ...initialSetting, draftValue: "Tên thương hiệu mới", publishedValue: "Tên thương hiệu mới", effectiveValue: "Tên thương hiệu mới", version: 3, dirty: false };
    await route.fulfill({ json: { ok: true, data: { setting } } });
  });
  await open(page, "/admin/noi-dung");
  await page.getByTestId("input-setting-brand.name").fill("Tên thương hiệu mới");
  await expect(page.getByTestId("publish-all-unsaved-hint")).toContainText("Còn 1 mục chưa lưu");
  await expect(page.getByTestId("button-publish-all")).toBeDisabled();
  await page.getByTestId("button-setting-save-apply-brand.name").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Xác nhận phát hành" })).toBeVisible();
  await expect(writes).toEqual([]);
  await expect(dialog.getByTestId("button-confirm-dialog")).toHaveClass(/admin-button-primary/);
  await dialog.getByTestId("button-confirm-dialog").click();
  await expect(page.getByRole("status")).toContainText("Đã lưu và áp dụng");
  await expect(page.getByTestId("setting-card-brand.name").getByText("Đã đăng")).toBeVisible();
  assert.deepEqual(writes, ["draft", "publish"]);
}, "owner", 1920, 1080);

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

for (const [width, height] of [[390, 844], [1366, 768], [1920, 1080]]) {
  await run(`Twelve admin routes at ${width}×${height}: layout, labels, runtime`, async (page) => {
    for (const path of ["/admin", "/admin/san-pham", "/admin/dich-vu", "/admin/tin-tuc", "/admin/noi-dung", "/admin/thiet-ke", "/admin/dieu-huong", "/admin/thanh-vien", "/admin/audit", "/admin/media", "/admin/yeu-cau", "/admin/khach-hang"]) {
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${path}: no page overflow`);
      if (path === "/admin/san-pham") {
        const table = await page.evaluate(() => {
          const wrapper = document.querySelector(".admin-table-scroll");
          const headers = [...document.querySelectorAll(".admin-product-table thead th")];
          const status = headers.find((header) => header.textContent?.trim() === "Trạng thái");
          const actions = headers.find((header) => header.textContent?.trim() === "Thao tác");
          const overlap = status && actions && status.getBoundingClientRect().right > actions.getBoundingClientRect().left;
          const hint = document.querySelector(".admin-table-scroll-hint");
          return { canScroll: wrapper ? wrapper.scrollWidth > wrapper.clientWidth + 1 : false, overlap, hintVisible: Boolean(hint && getComputedStyle(hint).display !== "none") };
        });
        if (width === 1366) {
          assert.equal(table.canScroll, true, "1366×768 product table exposes horizontal scroll");
          assert.equal(table.overlap, false, "1366×768 action column does not cover product status");
          assert.equal(table.hintVisible, true, "1366×768 explains how to reach hidden columns");
        }
        if (width === 1920) {
          assert.equal(table.canScroll, false, "1920×1080 product table fits without horizontal scrolling");
          assert.equal(table.hintVisible, false, "1920×1080 does not show an unnecessary scroll hint");
        }
      }
      const routeName = path === "/admin" ? "dashboard" : path.split("/").at(-1);
      await page.screenshot({ path: `${output}/${routeName}-${width}x${height}.png` });
    }
  }, "owner", width, height);
}

await run("Product editor protects dirty browser Back and restores browser Forward", async (page) => {
  await open(page, "/admin/san-pham");
  await page.getByTestId("button-product-edit-1").click();
  const name = page.getByTestId("input-product-name");
  await name.fill("Giữ tên sản phẩm đang sửa");
  await page.evaluate(() => history.back());
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(`${origin}/admin/san-pham?edit=1`);
  await page.getByRole("button", { name: "Ở lại", exact: true }).click();
  await expect(name).toHaveValue("Giữ tên sản phẩm đang sửa");
  await page.evaluate(() => history.back());
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/admin/san-pham`);
  await expect(page.getByTestId("button-product-edit-1")).toBeVisible();
  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(`${origin}/admin/san-pham?edit=1`);
  await expect(name).toBeVisible();
  await expect(name).toHaveValue(product.name);
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(`${origin}/admin/san-pham`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

await browser.close();
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
for (const result of results) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error.split("\n")[0]}` : ""}`);
process.exitCode = results.some((result) => !result.pass) ? 1 : 0;
