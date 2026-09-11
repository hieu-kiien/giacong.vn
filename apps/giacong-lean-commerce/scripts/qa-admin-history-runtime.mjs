import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = (process.env.QA_ADMIN_BASE_URL ?? "https://admin-staging.kienhieu.id.vn").replace(/\/$/, "");
const storageStatePath = process.env.QA_ADMIN_STORAGE_STATE?.trim();

if (!storageStatePath) {
  console.error("ADMIN HISTORY QA BLOCKED: set QA_ADMIN_STORAGE_STATE to the existing storage-state file.");
  process.exit(2);
}

const storageState = resolve(storageStatePath);
let exitCode = 0;
try {
  await access(storageState);
} catch {
  console.error(`ADMIN HISTORY QA BLOCKED: storage state was not found at ${storageState}.`);
  process.exit(2);
}

const browser = await chromium.launch();
const appMutations = [];
const pageErrors = [];

function captureRuntimeSignals(page) {
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== new URL(baseUrl).hostname) return;
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return;
    if (url.pathname.startsWith("/cdn-cgi/")) return;
    appMutations.push(`${request.method()} ${url.pathname}`);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
}

async function waitForAdmin(page, path) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  assert.equal(response?.status(), 200, `${path} phải trả 200 sau Access login`);
  await page.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible", timeout: 15_000 });
}

async function setupProductForBack(page) {
  await waitForAdmin(page, "/admin/noi-dung");
  await page.getByRole("link", { name: "Tin tức", exact: true }).click();
  await page.waitForURL(/\/admin\/tin-tuc(?:\?|#|$)/, { timeout: 10_000 });
  await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
  await page.waitForURL(/\/admin\/san-pham(?:\?|#|$)/, { timeout: 10_000 });
  await page.getByTestId("button-product-edit-14").click();
  const input = page.getByLabel("Tên sản phẩm");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  return input;
}

async function setupProductForForward(page) {
  await waitForAdmin(page, "/admin/noi-dung");
  await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
  await page.waitForURL(/\/admin\/san-pham(?:\?|#|$)/, { timeout: 10_000 });
  await page.getByRole("link", { name: "Tin tức", exact: true }).click();
  await page.waitForURL(/\/admin\/tin-tuc(?:\?|#|$)/, { timeout: 10_000 });
  await page.evaluate(() => history.back());
  await page.waitForURL(/\/admin\/san-pham(?:\?|#|$)/, { timeout: 10_000 });
  await page.getByTestId("button-product-edit-14").click();
  const input = page.getByLabel("Tên sản phẩm");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  return input;
}

async function assertGuardDialog(page, sourceHref, marker, label) {
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(await dialog.count(), 1, `${label}: chỉ được có một dialog`);
  assert.equal(await page.evaluate(() => location.href), sourceHref, `${label}: URL phải giữ ở entry nguồn`);
  assert.equal(await page.getByText("Cập nhật sản phẩm", { exact: true }).count() > 0, true, `${label}: editor không được unmount`);
  assert.equal(await page.getByLabel("Tên sản phẩm").inputValue(), marker, `${label}: giá trị dirty phải còn nguyên`);
  assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, `${label}: focus phải ở trong dialog`);
}

async function assertNestedGuardDialog(page, sourceHref, label) {
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(await dialog.count(), 1, `${label}: chỉ được có một dialog`);
  assert.equal(await page.evaluate(() => location.href), sourceHref, `${label}: URL phải giữ ở entry nguồn`);
  assert.equal(await page.getByText("Cập nhật sản phẩm", { exact: true }).count() > 0, true, `${label}: editor không được unmount`);
  assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, `${label}: focus phải ở trong dialog`);
}

async function fillDirtyProduct(page, prefix) {
  const input = page.getByLabel("Tên sản phẩm");
  const marker = `QA-DOT2-${prefix}-${Date.now()}`;
  await input.fill(marker);
  await page.waitForTimeout(500);
  return { input, marker, sourceHref: await page.evaluate(() => location.href) };
}

async function assertStayed(page, sourceHref, marker, label) {
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => location.href), sourceHref, `${label}: URL phải được giữ`);
  assert.equal(await page.getByLabel("Tên sản phẩm").inputValue(), marker, `${label}: form phải được giữ`);
  assert.equal(await page.getByRole("dialog").count(), 0, `${label}: dialog phải đóng`);
}

async function openSidebarDialog(page, sourceHref, marker, target, label) {
  await page.getByRole("link", { name: target, exact: true }).click();
  await assertGuardDialog(page, sourceHref, marker, label);
}

async function runSidebarCase() {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  captureRuntimeSignals(page);
  try {
    await setupProductForBack(page);
    const { marker, sourceHref } = await fillDirtyProduct(page, "SIDEBAR");
    await openSidebarDialog(page, sourceHref, marker, "Tin tức", "Sidebar");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await assertStayed(page, sourceHref, marker, "Sidebar/Ở lại");
    await openSidebarDialog(page, sourceHref, marker, "Tin tức", "Sidebar/Bỏ");
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await page.waitForURL(/\/admin\/tin-tuc(?:\?|#|$)/, { timeout: 10_000 });
    assert.equal(await page.getByText("Cập nhật sản phẩm", { exact: true }).count(), 0, "Sidebar/Bỏ: editor phải unmount");
  } finally {
    await context.close();
  }
}

async function runSvgCase() {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  captureRuntimeSignals(page);
  try {
    await setupProductForBack(page);
    const { marker, sourceHref } = await fillDirtyProduct(page, "SVG");
    const svg = page.locator('a[href="/admin/tin-tuc"] svg').first();
    assert.equal(await svg.count() > 0, true, "SVG: sidebar phải có icon SVG để mô phỏng click phần tử con");
    assert.ok(await svg.boundingBox(), "SVG: icon phải hiển thị và có vùng click");
    await svg.click();
    await assertGuardDialog(page, sourceHref, marker, "SVG");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await assertStayed(page, sourceHref, marker, "SVG/Ở lại");
  } finally {
    await context.close();
  }
}

async function runBackTwiceCase() {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  captureRuntimeSignals(page);
  try {
    await setupProductForBack(page);
    const { marker, sourceHref } = await fillDirtyProduct(page, "BACK-X2");
    await page.evaluate(() => history.back());
    await assertGuardDialog(page, sourceHref, marker, "Back lần 1");
    await page.evaluate(() => history.back());
    await page.waitForTimeout(350);
    await assertGuardDialog(page, sourceHref, marker, "Back lần 2");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await assertStayed(page, sourceHref, marker, "Back×2/Ở lại");
  } finally {
    await context.close();
  }
}

async function runForwardTwiceCase() {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  captureRuntimeSignals(page);
  try {
    await setupProductForForward(page);
    const { marker, sourceHref } = await fillDirtyProduct(page, "FORWARD-X2");
    await page.evaluate(() => history.forward());
    await assertGuardDialog(page, sourceHref, marker, "Forward");
    await page.evaluate(() => history.forward());
    await page.waitForTimeout(350);
    await assertGuardDialog(page, sourceHref, marker, "Forward lần 2");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await assertStayed(page, sourceHref, marker, "Forward×2/Ở lại");
    const discardMarker = `QA-DOT2-FORWARD-DISCARD-${Date.now()}`;
    await page.getByLabel("Tên sản phẩm").fill(discardMarker);
    await page.waitForTimeout(500);
    await page.evaluate(() => history.forward());
    await assertGuardDialog(page, sourceHref, discardMarker, "Forward/Bỏ");
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await page.waitForURL(/\/admin\/tin-tuc(?:\?|#|$)/, { timeout: 10_000 });
    assert.equal(await page.getByText("Cập nhật sản phẩm", { exact: true }).count(), 0, "Forward/Bỏ: editor phải unmount");
  } finally {
    await context.close();
  }
}

async function runQueryHashCase() {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  captureRuntimeSignals(page);
  try {
    await setupProductForBack(page);
    const { marker } = await fillDirtyProduct(page, "QUERY-HASH");
    await page.evaluate(async () => {
      const state = { queryFixture: true };
      history.pushState(state, "", `${location.pathname}?tab=a#alpha`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      history.pushState(state, "", `${location.pathname}?tab=b#beta`);
    });
    await page.waitForTimeout(250);
    const sourceHref = await page.evaluate(() => location.href);
    assert.match(sourceHref, /\?tab=b#beta$/, `Query/hash: phải ở entry hiện tại trước Back (actual ${sourceHref})`);
    await page.evaluate(() => history.back());
    await assertGuardDialog(page, sourceHref, marker, "Query/hash");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await assertStayed(page, sourceHref, marker, "Query/hash/Ở lại");
    await page.evaluate(() => history.back());
    await assertGuardDialog(page, sourceHref, marker, "Query/hash/Bỏ");
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => location.href).then((href) => /\?tab=a#alpha$/.test(href)), true, "Query/hash/Bỏ: URL phải trở về entry đích");
    assert.notEqual(await page.getByLabel("Tên sản phẩm").inputValue(), marker, "Query/hash/Bỏ: draft phải bị loại bỏ dù pathname không đổi");
  } finally {
    await context.close();
  }
}

async function runBackDiscardCase() {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  captureRuntimeSignals(page);
  try {
    await setupProductForBack(page);
    const { marker, sourceHref } = await fillDirtyProduct(page, "BACK-DISCARD");
    await page.evaluate(() => history.back());
    await assertGuardDialog(page, sourceHref, marker, "Back/Bỏ");
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await page.waitForURL(/\/admin\/tin-tuc(?:\?|#|$)/, { timeout: 10_000 });
    assert.equal(await page.getByText("Cập nhật sản phẩm", { exact: true }).count(), 0, "Back/Bỏ: editor phải unmount");
  } finally {
    await context.close();
  }
}

async function runRemountCase() {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  captureRuntimeSignals(page);
  try {
    await setupProductForBack(page);
    const first = await fillDirtyProduct(page, "REMOUNT-1");
    await openSidebarDialog(page, first.sourceHref, first.marker, "Tin tức", "Remount/Bỏ");
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await page.waitForURL(/\/admin\/tin-tuc(?:\?|#|$)/, { timeout: 10_000 });
    await page.evaluate(() => history.back());
    await page.waitForURL(/\/admin\/san-pham(?:\?|#|$)/, { timeout: 10_000 });
    await page.getByTestId("button-product-edit-14").click();
    await page.getByLabel("Tên sản phẩm").waitFor({ state: "visible", timeout: 10_000 });
    const second = await fillDirtyProduct(page, "REMOUNT-2");
    await openSidebarDialog(page, second.sourceHref, second.marker, "Tin tức", "Remount/sau mount");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await assertStayed(page, second.sourceHref, second.marker, "Remount/Ở lại");
  } finally {
    await context.close();
  }
}

async function runNestedEditorsCase() {
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  captureRuntimeSignals(page);
  try {
    await setupProductForBack(page);
    const variantInput = page.getByLabel(/^Tên biến thể/);
    await variantInput.waitFor({ state: "visible", timeout: 10_000 });
    const variantMarker = `QA-DOT2-VARIANT-${Date.now()}`;
    await variantInput.fill(variantMarker);
    await page.waitForTimeout(350);
    const variantHref = await page.evaluate(() => location.href);
    await page.getByRole("link", { name: "Tin tức", exact: true }).click();
    await assertNestedGuardDialog(page, variantHref, "Nested/variant");
    assert.equal(await variantInput.inputValue(), variantMarker, "Nested/variant: draft phải còn nguyên");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => location.href), variantHref, "Nested/variant: Ở lại phải giữ URL");
    assert.equal(await variantInput.inputValue(), variantMarker, "Nested/variant: Ở lại phải giữ draft");
    await page.getByRole("button", { name: "Hủy", exact: true }).first().click();
    await assertNestedGuardDialog(page, variantHref, "Nested/variant/đóng editor");
    assert.equal(await variantInput.inputValue(), variantMarker, "Nested/variant/đóng editor: draft phải còn nguyên");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await page.getByRole("button", { name: "Hủy", exact: true }).last().click();

    const mediaInput = page.getByLabel("Mô tả ảnh", { exact: true });
    await mediaInput.waitFor({ state: "visible", timeout: 10_000 });
    const mediaMarker = `QA-DOT2-MEDIA-${Date.now()}`;
    await mediaInput.fill(mediaMarker);
    await page.waitForTimeout(350);
    const mediaHref = await page.evaluate(() => location.href);
    await page.getByRole("link", { name: "Tin tức", exact: true }).click();
    await assertNestedGuardDialog(page, mediaHref, "Nested/media");
    assert.equal(await mediaInput.inputValue(), mediaMarker, "Nested/media: draft phải còn nguyên");
    await page.getByRole("button", { name: "Ở lại", exact: true }).click();
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => location.href), mediaHref, "Nested/media: Ở lại phải giữ URL");
    assert.equal(await mediaInput.inputValue(), mediaMarker, "Nested/media: Ở lại phải giữ draft");
  } finally {
    await context.close();
  }
}

try {
  await runSidebarCase();
  console.log("PASS 1/9 Sidebar dirty + Ở lại/Bỏ");
  await runSvgCase();
  console.log("PASS 2/9 SVG child dirty");
  await runBackTwiceCase();
  console.log("PASS 3/9 Back×2 single-flight");
  await runForwardTwiceCase();
  console.log("PASS 4/9 Forward×2 single-flight");
  await runQueryHashCase();
  console.log("PASS 5/9 query/hash giữ href");
  await runBackDiscardCase();
  console.log("PASS 6/9 Back + Bỏ thay đổi");
  await runRemountCase();
  console.log("PASS 7/9 remount đăng ký lại guard");
  await runNestedEditorsCase();
  console.log("PASS 8/9 nested variant/media aggregate guard");
  assert.deepEqual(appMutations, [], `Không được có app mutation: ${appMutations.join(", ")}`);
  assert.deepEqual(pageErrors, [], `Không được có page error: ${pageErrors.join(" | ")}`);
  console.log("PASS 9/9 mutation/page-error telemetry");
  console.log("ADMIN HISTORY QA PASSED");
} catch (error) {
  console.error(`ADMIN HISTORY QA FAILED: ${error instanceof Error ? error.message : String(error)}`);
  if (appMutations.length) console.error(`app mutations: ${appMutations.join(", ")}`);
  if (pageErrors.length) console.error(`page errors: ${pageErrors.join(" | ")}`);
  exitCode = 1;
} finally {
  await browser.close();
}

process.exit(exitCode);
