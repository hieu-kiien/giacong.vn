// Regeneratable component fixtures; all writes intercepted locally, no real account/data.
import assert from "node:assert/strict";
import { mkdir, writeFile, unlink, rmdir } from "node:fs/promises";
import { chromium, expect } from "playwright/test";
import { serializeCustomerConfirmation } from "../src/lib/customer-request-confirmation.ts";
import { WEBSITE_SIGN_OUT_EVENT } from "../src/lib/customer-session-events.ts";
const origin = process.env.QA_LOCAL_ORIGIN ?? "http://localhost:3107";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const fixtureDirectory = "src/app/qa-contact-fixture";
const fixtureFile = `${fixtureDirectory}/page.tsx`;
const output = ".runtime/customer-contact";
await mkdir(fixtureDirectory, { recursive: true });
await mkdir(output, { recursive: true });
await writeFile(fixtureFile, `"use client";
import { useState } from "react";
import { CustomerContactProfile } from "../(storefront)/tai-khoan/CustomerContactProfile";
import { RequestForm } from "@/components/request-cart/RequestForm";
import { RequestCartView } from "@/components/request-cart/RequestCartView";
import type { RequestCartContact } from "@/lib/request-cart-client";
const cart = { currency: "VND" as const, hasPriceOnRequest: false, isSubmittable: true, lineCount: 0, lines: [], pricedSubtotal: 0, requestType: "Đặt sản phẩm" as const, snapshotToken: "fixture", totalQuantity: 0, uniformUnit: null };
export default function ContactFixture() {
const [accepted, setAccepted] = useState<{contact: RequestCartContact; receivedAt: string; reference: string} | null>(null);
return <main><CustomerContactProfile complete={false} next={null} initial={{name:"Google Name",phone:"",companyName:"",email:"qa@example.test"}} />
{accepted ? <p role="status">Đã tiếp nhận {accepted.reference}</p> : <RequestForm cart={cart} onConflict={()=>{}} onAccepted={setAccepted} />}<RequestCartView /></main>;
}`);
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    let saveFails = true;
    let submits = 0;
    let submitted;
    let sessionUserId = "fixture-user";
    await context.route("**/api/auth/get-session**", (route) => route.fulfill({ json: sessionUserId ? { user: { id: sessionUserId, name: "Google Name", email: "qa@example.test", emailVerified: true }, session: { id: "fixture-session", userId: sessionUserId, expiresAt: "2030-01-01" } } : null }));
    await context.route("**/api/customer/contact", (route) => route.fulfill(route.request().method() === "GET"
      ? { json: { ok: true, contact: { name: "Saved Name", phone: "0912345678", companyName: "Fixture Company", email: "qa@example.test" } } }
      : saveFails ? { status: 503, json: { ok: false, message: "Chưa lưu được thông tin. Vui lòng thử lại." } } : { json: { ok: true } }));
    await context.route("**/api/contact", (route) => { submits++; submitted = route.request().postDataJSON(); return route.fulfill({ status: 202, json: { ok: true, reference: "QA-REQUEST", receivedAt: "2026-10-05T00:00:00Z" } }); });
    const page = await context.newPage();
    await page.goto(`${origin}/qa-contact-fixture/`, { waitUntil: "networkidle" });
    await expect(page.locator("#ho-va-ten")).toHaveValue("Saved Name");
    await expect(page.locator("#so-dien-thoai")).toHaveValue("0912345678");
    await expect(page.locator("#email")).toHaveValue("qa@example.test");
    await expect(page.locator("#ten-cong-ty")).toHaveValue("Fixture Company");
    await page.getByRole("button", { name: "Lưu thông tin liên hệ", exact: true }).click();
    await expect(page.locator("#profile-phone-error")).toBeVisible();
    await expect(page.locator("#profile-consent-error")).toBeVisible();
    await page.locator("#contact-profile-phone").fill("0912345678");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Lưu thông tin liên hệ", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Chưa lưu được" })).toBeVisible();
    saveFails = false;
    await page.getByRole("button", { name: "Lưu thông tin liên hệ", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Đã lưu thông tin" })).toBeVisible();
    await page.screenshot({ path: `${output}/contact-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.locator("#tinh-thanh-giao-hang").fill("Hà Nội");
    await page.getByRole("button", { name: "Gửi yêu cầu báo giá" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Đã tiếp nhận QA-REQUEST" })).toBeVisible();
    assert.equal(submits, 1);
    assert.ok(JSON.stringify(submitted).includes("0912345678"));
    const snapshot = { cart: { currency: "VND", hasPriceOnRequest: false, isSubmittable: true, lineCount: 1,
      lines: [{ adjustments: [], contactFromQuantity: null, imageUrl: null, isAvailable: true, isSubmittable: true, lineTotal: 100, minimumOrderQuantity: 1, parentSlug: "test", priceOnRequest: false, productName: "Test", quantity: 1, quantityStep: 1, unit: "gói", unitPrice: 100, variantLabel: "Test", variantSku: "TEST" }],
      pricedSubtotal: 100, requestType: "Đặt sản phẩm", snapshotToken: "a".repeat(64), totalQuantity: 1, uniformUnit: "gói" }, contact: null, receivedAt: "2026-10-05T00:00:00Z", reference: "QA-OWNED" };
    const owned = serializeCustomerConfirmation(snapshot, "fixture-user");
    await page.evaluate((value) => sessionStorage.setItem("giacong.request-cart.accepted.v1", value), owned);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("QA-OWNED", { exact: true })).toBeVisible();
    sessionUserId = "";
    await page.evaluate((event) => window.dispatchEvent(new Event(event)), WEBSITE_SIGN_OUT_EVENT);
    await expect(page.getByText("QA-OWNED", { exact: true })).toHaveCount(0);
    await expect(page.locator("#ho-va-ten")).toHaveCount(0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("giacong.request-cart.accepted.v1")), null);
    sessionUserId = "other-user";
    await page.evaluate((value) => sessionStorage.setItem("giacong.request-cart.accepted.v1", value), owned);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("QA-OWNED", { exact: true })).toHaveCount(0);
    await context.close();
  }
  console.log("PASS contact validation, consent, save failure/retry, profile prefill, submit, logout clears contact/confirmation, other account cannot restore confirmation; responsive 390/1366");
} finally {
  await browser.close();
  await unlink(fixtureFile);
  await rmdir(fixtureDirectory);
}
