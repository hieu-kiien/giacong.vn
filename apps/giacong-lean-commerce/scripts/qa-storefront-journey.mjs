// Regeneratable read-only layout evidence; does not submit forms or modify remote data.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const origin = process.env.QA_ACCOUNT_ORIGIN ?? "https://staging.kienhieu.id.vn";
assert.ok(["localhost", "127.0.0.1", "staging.kienhieu.id.vn"].includes(new URL(origin).hostname));
const output = ".runtime/storefront-journey";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 768, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
    const page = await context.newPage();
    for (const path of ["/", "/san-pham/", "/tin-tuc/", "/thue-gia-cong/", "/lien-he/", "/gui-yeu-cau/", "/tai-khoan/dang-nhap/"]) {
      const errors = [];
      const onError = (error) => errors.push(error.message);
      page.on("pageerror", onError);
      const response = await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth,
        header: Boolean(document.querySelector("#header")), footer: Boolean(document.querySelector("#footer, footer")),
        headings: [...document.querySelectorAll("main h1, #main h1")].map((el) => el.textContent.trim()),
        overflow: [...document.querySelectorAll("main *, #main *")].filter((el) => {
          const b = el.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 2 && getComputedStyle(el).position !== "fixed";
        }).slice(0, 4).map((el) => `${el.tagName}.${el.className}`),
      }));
      await page.screenshot({ path: `${output}/${path.replaceAll("/", "_") || "home"}-${width}.png`, fullPage: true });
      results.push({ path, width, status: response?.status(), ...layout, errors });
      page.off("pageerror", onError);
    }
    await context.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  assert.ok(results.every((result) => result.status === 200 && result.scroll <= result.width + 1 && result.errors.length === 0 && result.header && result.footer), "See results.json for route failures");
} finally { await browser.close(); }
