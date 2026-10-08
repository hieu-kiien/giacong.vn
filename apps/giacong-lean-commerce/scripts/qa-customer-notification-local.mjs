// Regeneratable UI evidence; API traffic is intercepted and no email/Sheet write is made.
import assert from "node:assert/strict";
import { mkdir,writeFile,unlink,rmdir } from "node:fs/promises";
import { chromium,expect } from "playwright/test";
const origin = "http://localhost:3107";
const directory = "src/app/qa-notification-fixture";
const file = `${directory}/page.tsx`;
await mkdir(directory,{ recursive: true });
await mkdir(".runtime/customer-notification",{ recursive: true });
await writeFile(file,'import "@/styles/admin.css";\nimport { AdminCustomerContactDelivery } from "@/components/admin/AdminCustomerContactDelivery";\nexport default function Fixture() { return <main><AdminCustomerContactDelivery customerId="customer-fixture" /></main>; }');
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390,1366]) {
    const context = await browser.newContext({ viewport: { width,height: 900 } });
    const page = await context.newPage(); const errors = []; let posts = 0;
    page.on("pageerror",error => errors.push(error.message));
    let reviewRequired = false;
    await page.route("**/api/admin/customers/customer-fixture/contact-delivery",route => {
      const retry = route.request().method() === "POST";
      if (retry) posts++;
      return route.fulfill({ contentType: "application/json",body: JSON.stringify({ ok: true,requestId: "fixture",data: { delivery: { sheet: reviewRequired && !retry ? "pending" : "delivered",email: retry && !reviewRequired ? "delivered" : "pending",failed: !retry,reviewRequired } } }) });
    });
    await page.goto(`${origin}/qa-notification-fixture`,{ waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Google Sheets: Đã gửi · Email khách mới: Chờ gửi/)).toBeVisible();
    await page.getByRole("button",{ name: "Thử đồng bộ lại",exact: true }).click();
    await expect(page.getByText(/Google Sheets: Đã gửi · Email khách mới: Đã gửi/)).toBeVisible();
    await expect(page.getByRole("button",{ name: "Thử đồng bộ lại" })).toHaveCount(0);
    assert.equal(posts,1); assert.deepEqual(errors,[]);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `.runtime/customer-notification/delivered-${width}.png`,fullPage: true });
    reviewRequired = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button",{ name: "Thử đồng bộ Google Sheets",exact: true }).click();
    await expect(page.getByText(/Google Sheets: Đã gửi · Email khách mới: Chờ gửi/)).toBeVisible();
    await expect(page.getByRole("button",{ name: "Thử đồng bộ Google Sheets" })).toHaveCount(0);
    assert.equal(posts,2);
    await context.close();
  }
  console.log("PASS independent channel status, retry feedback and layout390/1366; no external writes");
} finally { await browser.close(); await unlink(file); await rmdir(directory); }
