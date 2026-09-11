// Local-only E2E fixture. API state is disposable memory; public rendering uses the real reader.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";
import { applyNavigationToMarkup } from "../src/lib/site-navigation.ts";

const origin = process.env.QA_LOCAL_ORIGIN ?? "http://localhost:3101";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local runner only");
const home = JSON.parse(await readFile(new URL("../src/data/pages/home.json", import.meta.url), "utf8"));
const output = ".runtime/admin-navigation-nested";
await mkdir(output, { recursive: true });
const parent = {
  id: "services",
  capturedMenuId: "menu-item-5166",
  draftHref: "/thue-gia-cong/",
  draftIsActive: true,
  draftLabel: "Thuê gia công",
  draftParentId: null,
  draftSortOrder: 40,
  publishedHref: "/thue-gia-cong/",
  publishedIsActive: true,
  publishedLabel: "Thuê gia công",
  publishedParentId: null,
  publishedSortOrder: 40,
  menuKey: "primary",
  version: 1,
  updatedAt: "2026-09-10T00:00:00Z",
  dirty: false,
};
const items = [parent];
const mutations = [];

function response(data, status = 200) { return { status, json: { ok: true, data } }; }
function navigationPayload() { return { canEdit: true, canPublish: true, items, role: "owner" }; }
function updateItem(item, body, published = false) {
  if (!published) {
    item.draftLabel = body.label ?? item.draftLabel;
    item.draftHref = body.href ?? item.draftHref;
    item.draftParentId = body.parentId ?? null;
    item.draftSortOrder = body.sortOrder ?? item.draftSortOrder;
    item.draftIsActive = body.isActive ?? item.draftIsActive;
  }
  if (published) {
    item.publishedLabel = item.draftLabel;
    item.publishedHref = item.draftHref;
    item.publishedParentId = item.draftParentId;
    item.publishedSortOrder = item.draftSortOrder;
    item.publishedIsActive = item.draftIsActive;
  }
  item.version += 1;
  item.dirty = !published;
  return item;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(10000);
await context.route(`${origin}/api/admin/**`, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (path.endsWith("/session")) return route.fulfill(response({ authenticated: true, subject: "qa@example.test", role: "owner" }));
  if (path.endsWith("/navigation") && request.method() === "GET") return route.fulfill(response(navigationPayload()));
  if (path.endsWith("/navigation") && request.method() === "POST") {
    const body = request.postDataJSON();
    const item = {
      ...parent,
      id: "qa-child",
      capturedMenuId: null,
      draftHref: body.href,
      draftLabel: body.label,
      draftParentId: body.parentId ?? null,
      draftSortOrder: body.sortOrder,
      publishedHref: body.href,
      publishedLabel: body.label,
      publishedParentId: body.parentId ?? null,
      publishedSortOrder: body.sortOrder,
      version: 1,
    };
    items.push(item);
    mutations.push({ method: "POST", path, body });
    return route.fulfill(response({ item }, 201));
  }
  if (path.match(/\/navigation\/[^/]+$/) && request.method() === "PATCH") {
    const item = items.find((candidate) => path.endsWith(candidate.id));
    assert.ok(item, `PATCH target exists: ${path}`);
    const body = request.postDataJSON();
    mutations.push({ method: "PATCH", path, body });
    return route.fulfill(response({ item: updateItem(item, body) }));
  }
  if (path.endsWith("/publish") && request.method() === "POST") {
    const item = items.find((candidate) => path.includes(`/navigation/${candidate.id}/`));
    assert.ok(item, `publish target exists: ${path}`);
    mutations.push({ method: "POST", path, body: request.postDataJSON() });
    return route.fulfill(response({ item: updateItem(item, {}, true) }));
  }
  return route.fulfill(response({}));
});

await page.goto(`${origin}/admin/dieu-huong`, { waitUntil: "domcontentloaded" });
await expect(page.getByRole("heading", { name: "Menu website" })).toBeVisible();
await page.getByRole("button", { name: "Thêm mục" }).click();
await page.locator("#navigation-new-label").fill("Dịch vụ đóng gói");
await page.locator("#navigation-new-href").fill("/dich-vu-dong-goi/");
await page.locator("#navigation-new-parent").selectOption("services");
await page.getByRole("button", { name: "Thêm mục", exact: true }).last().click();
const child = page.locator("article.admin-navigation-card").filter({ hasText: "Dịch vụ đóng gói" }).last();
await expect(child).toBeVisible();
await child.locator("input").nth(0).fill("Dịch vụ đóng gói mới");
await child.locator("input[type=number]").fill("45");
await child.getByRole("checkbox").uncheck();
await child.getByRole("button", { name: "Lưu nháp" }).click();
await expect(page.locator(".admin-content-notice")).toContainText("Đã lưu bản nháp");
await child.getByRole("checkbox").check();
await child.getByRole("button", { name: "Lưu nháp" }).click();
await expect(page.locator(".admin-content-notice")).toContainText("Đã lưu bản nháp");
await child.getByRole("button", { name: "Phát hành" }).click();
await expect(page.locator(".admin-content-notice")).toContainText("Đã phát hành");
await page.keyboard.press("Escape");
await expect(page.getByRole("dialog")).toHaveCount(0);
await page.screenshot({ path: `${output}/admin-1440.png`, fullPage: false });
await page.setViewportSize({ width: 390, height: 900 });
await page.screenshot({ path: `${output}/admin-390.png`, fullPage: false });
await page.setViewportSize({ width: 1440, height: 900 });
assert.equal(items.find((item) => item.id === "qa-child")?.publishedParentId, "services");
assert.equal(items.find((item) => item.id === "qa-child")?.publishedSortOrder, 45);

for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 });
  await page.route(`${origin}/`, async (route) => {
    const publicItems = items.filter((item) => item.publishedIsActive).map((item) => ({
      id: item.id, capturedMenuId: item.capturedMenuId, parentId: item.publishedParentId,
      href: item.publishedHref, isActive: item.publishedIsActive, label: item.publishedLabel,
      menuKey: item.menuKey, sortOrder: item.publishedSortOrder,
    }));
    return route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><head><style>${home.css ?? ""}</style></head><body>${applyNavigationToMarkup(home.markup, publicItems)}</body></html>` });
  });
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  const nestedLink = page.locator('a[href="/dich-vu-dong-goi/"]').first();
  await expect(nestedLink).toBeVisible();
  assert.ok((await nestedLink.textContent() ?? "").length > 0, "nested child label rendered");
  assert.equal(await nestedLink.evaluate((link) => link.closest("ul")?.className.includes("nested-navigation") ?? false), true);
  await page.screenshot({ path: `${output}/public-${width}.png`, fullPage: false });
}

assert.equal(mutations.some((mutation) => mutation.method === "PATCH" && mutation.body.parentId === "services"), true);
await browser.close();
console.log(JSON.stringify({ ok: true, checked: ["create", "parent-select", "reorder", "toggle", "save", "publish", "public-reader-desktop", "public-reader-mobile"] }));
