// Regeneratable local fixture evidence; never reads or writes live customer data.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "playwright/test";
import { buildCustomerExportXlsx } from "../src/lib/admin-customer-xlsx.ts";

const origin = process.env.QA_LOCAL_ORIGIN ?? "http://localhost:3107";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const output = ".runtime/admin-simple";
await mkdir(output, { recursive: true });
const customer = { id: "u1", name: "Khách kiểm thử", email: "qa@example.test", phone: "0900000001", username: null, createdAt: "2026-10-05", lastRequestAt: null, requestCount: 0, saleCount: 21, saleTotal: 2100 };
const sale = { id: "s1", customerId: "u1", saleCode: "GD-1", confirmedAt: "2026-10-05", totalAmount: 100 };
const workbook = buildCustomerExportXlsx([customer], [sale]);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
let loggedOut = false;
let exportFails = false;
let exportedQuery = "";
const errors = [];
context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
await context.route("**/api/admin/**", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith("/session")) {
    return route.fulfill({ status: loggedOut ? 401 : 200, json: loggedOut
      ? { ok: false, code: "UNAUTHENTICATED", message: "Phiên đăng nhập đã kết thúc." }
      : { ok: true, data: { authenticated: true, authMethod: "account", subject: "account:u1", email: customer.email, role: "owner" } } });
  }
  if (url.pathname.endsWith("/export")) {
    exportedQuery = url.searchParams.get("query") ?? "";
    assert.equal(url.searchParams.get("format"), "xlsx");
    return exportFails
      ? route.fulfill({ status: 400, json: { ok: false, message: "Hãy tìm kiếm để thu nhỏ danh sách trước khi xuất." } })
      : route.fulfill({ status: 200, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: workbook });
  }
  if (url.pathname.endsWith("/customers/u1")) {
    const page = Number(url.searchParams.get("salesPage") ?? 1);
    return route.fulfill({ json: { ok: true, data: { customer: { ...customer, requests: [], sales: [{ ...sale, saleCode: page === 1 ? "GD-MỚI" : "GD-CŨ" }], salesPagination: { currentPage: page, lastPage: 2, pageSize: 20, total: 21 } } } } });
  }
  if (url.pathname.endsWith("/customers")) return route.fulfill({ json: { ok: true, data: { customers: [customer], ready: true, total: 1, pagination: { currentPage: 1, lastPage: 1, pageSize: 20, total: 1 } } } });
  return route.fulfill({ status: 404, json: { ok: false, message: "Fixture route unavailable" } });
});
await context.route("**/api/auth/sign-out", async (route) => {
  loggedOut = true;
  await route.fulfill({ json: { success: true } });
});
try {
  const page = await context.newPage();
  await page.goto(`${origin}/admin/khach-hang/`);
  await expect(page.getByRole("heading", { name: "Khách hàng", exact: true })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Các khu vực quản trị" });
  await expect(navigation.locator("a:visible")).toHaveCount(5);
  await navigation.locator("summary").click();
  await expect(navigation.locator("a:visible")).toHaveCount(11);
  await navigation.locator("summary").click();
  await page.getByTestId("input-customer-search").fill("qa@example.test");
  await page.getByTestId("button-customer-search").click();
  await expect(page.getByTestId("link-customer-export")).toBeEnabled();
  const downloadReady = page.waitForEvent("download");
  await page.getByTestId("link-customer-export").click();
  const download = await downloadReady;
  assert.ok(download.suggestedFilename().endsWith(".xlsx"));
  await download.saveAs(`${output}/khach-hang.xlsx`);
  assert.equal(exportedQuery, "qa@example.test");
  exportFails = true;
  await page.getByTestId("link-customer-export").click();
  await expect(page.getByRole("alert").filter({ hasText: "thu nhỏ danh sách" })).toBeVisible();
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("GD-MỚI");
  await dialog.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(dialog).toContainText("GD-CŨ");
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.screenshot({ path: `${output}/khach-hang-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("link-customer-export")).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: `${output}/khach-hang-mobile.png`, fullPage: true });
  const other = await context.newPage();
  await other.goto(`${origin}/admin/khach-hang/`);
  await expect(other.getByRole("heading", { name: "Khách hàng", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Menu tài khoản quản trị/ }).click();
  await page.getByTestId("link-admin-logout").click();
  await expect(other.getByRole("heading", { name: "Đăng nhập khu vực quản trị", exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log("PASS compact navigation, filtered XLSX download/error, full sale pagination, mobile layout and logout across tabs");
} finally {
  await context.close();
  await browser.close();
}
