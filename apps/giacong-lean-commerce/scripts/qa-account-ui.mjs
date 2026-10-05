// Regeneratable browser evidence. Uses a separate anonymous browser; never submits an account or changes data.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";

const origin = process.env.QA_ACCOUNT_ORIGIN ?? "http://localhost:3107";
const emailEnabled = process.env.QA_ACCOUNT_EMAIL_ENABLED === "true";
assert.ok(["localhost", "127.0.0.1", "staging.kienhieu.id.vn"].includes(new URL(origin).hostname));
const output = ".runtime/account-ui";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 958, height: 900 }, { width: 1366, height: 768 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${origin}/tai-khoan/dang-nhap/?next=admin`);
    assert.equal(response.status(), 200);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("button", { name: /Đăng nhập bằng Google$/ })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      headerBottom: document.querySelector("#header").getBoundingClientRect().bottom,
      mainTop: document.querySelector("#main").getBoundingClientRect().top,
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      headerColor: getComputedStyle(document.querySelector("#header .nav > li > a")).color,
      heroTop: document.querySelector(".giacong-page-hero").getBoundingClientRect().top,
      heroBackground: getComputedStyle(document.querySelector(".giacong-page-hero")).backgroundImage,
      desktopNavigationBottom: Math.max(...Array.from(document.querySelectorAll("#header .header-nav-main > li > a"), (link) => link.getBoundingClientRect().bottom)),
    }));
    assert.ok(dimensions.mainTop >= dimensions.headerBottom - 1, "Account main overlaps navigation");
    assert.ok(dimensions.scrollWidth <= dimensions.width + 1, "Account page overflows horizontally");
    assert.ok(Math.abs(dimensions.heroTop) <= 1, "Shared green hero must sit behind the navigation");
    assert.ok(dimensions.heroBackground.includes("/images/home-captured/form-bg.webp"), "Approved contact hero background is missing");
    if (viewport.width >= 850) assert.ok(dimensions.desktopNavigationBottom <= dimensions.headerBottom + 8, "Desktop navigation wraps beyond its two-row header");
    await page.getByTestId("auth-mode-create-account").click();
    await expect(page.getByRole("button", { name: /Tạo tài khoản bằng Google$/ })).toBeVisible();
    if (emailEnabled) await expect(page.getByTestId("input-signup-email")).toBeVisible();
    else await expect(page.getByTestId("input-signup-email")).toHaveCount(0);
    await page.screenshot({ path: `${output}/signup-${viewport.width}.png`, fullPage: true });
    await page.getByTestId("auth-mode-sign-in").click();
    await expect(page.getByTestId("input-auth-password")).toBeVisible();
    await page.getByLabel("Hiện mật khẩu", { exact: true }).check();
    await expect(page.getByTestId("input-auth-password")).toHaveAttribute("type", "text");
    await page.getByLabel("Hiện mật khẩu", { exact: true }).uncheck();
    await expect(page.getByTestId("input-auth-password")).toHaveAttribute("type", "password");
    if (emailEnabled) await expect(page.getByTestId("button-auth-forgot")).toBeVisible();
    else await expect(page.getByTestId("button-auth-forgot")).toHaveCount(0);
    await page.screenshot({ path: `${output}/login-${viewport.width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    results.push({ viewport, ...dimensions, result: "PASS" });
    await context.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
