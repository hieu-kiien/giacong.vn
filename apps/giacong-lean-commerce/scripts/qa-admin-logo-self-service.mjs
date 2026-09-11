// Local-only E2E contract against the real admin page. API state is in-memory;
// public readback uses the real captured-markup reader and never touches Access,
// staging, production, or R2.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";
import { applyHomepageSiteSettingsToMarkup } from "../src/lib/site-markup.ts";

const origin = process.env.QA_LOCAL_ORIGIN ?? "http://localhost:3101";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local runner only");
const home = JSON.parse(await readFile(new URL("../src/data/pages/home.json", import.meta.url), "utf8"));
const imageBytes = await readFile(new URL("../public/images/home-hero/hero-2.png", import.meta.url));
const defaults = {
  brand_name: "Giacong.vn", brand_tagline: "Giải pháp gia công toàn diện", logo_url: "", logo_dark_url: "", favicon_url: "",
  primary_color: "#6cbe45", accent_color: "#bde875", site_title: "Giacong.vn", site_description: "Mô tả",
  contact_phone: "0947142999", contact_email: "info@giacong.vn", contact_zalo_url: "", contact_messenger_url: "",
  contact_address: "VP Hà Nội: 108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội", hero_eyebrow: "Giacong.vn cung cấp",
  hero_title: "Giải pháp gia công toàn diện chuyên nghiệp", hero_description: "Mô tả hero", hero_primary_cta_label: "Về chúng tôi",
  hero_primary_cta_url: "/gioi-thieu-ve-gia-cong/", hero_secondary_cta_label: "Liên hệ ngay", hero_secondary_cta_url: "/lien-he/",
  hero_image_url: "", about_title: "Đồng hành cùng doanh nghiệp", about_description: "Mô tả giới thiệu",
  footer_description: "Giacong.vn", footer_copyright: "Copyright",
};
const values = new Map(Object.entries(defaults));
const settings = new Map(["logo_url", "logo_dark_url", "favicon_url"].map((key) => [key, {
  key, group: "brand", label: key === "logo_url" ? "Logo sáng" : key === "logo_dark_url" ? "Logo tối" : "Favicon",
  description: "QA fixture", type: "image", draftValue: "", publishedValue: "", effectiveValue: "", isDefaultValue: true,
  version: 1, updatedBy: "qa@example.test", updatedAt: "2026-09-09T00:00:00Z", publishedBy: null, publishedAt: null, dirty: false,
}]));

function payload() { return { canEdit: true, role: "owner", settings: [...settings.values()] }; }
function update(key, value, publish = false) {
  const setting = settings.get(key);
  assert.ok(setting, `setting exists: ${key}`);
  if (publish) setting.publishedValue = setting.draftValue;
  else setting.draftValue = value;
  if (publish) setting.dirty = false;
  else setting.dirty = setting.draftValue !== setting.publishedValue;
  setting.effectiveValue = setting.publishedValue || "";
  setting.isDefaultValue = !setting.publishedValue;
  setting.version += 1;
  values.set(key, publish ? setting.publishedValue : setting.draftValue);
  return setting;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(10000);
await page.route(`${origin}/api/admin/**`, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (path.endsWith("/session")) return route.fulfill({ json: { ok: true, data: { authenticated: true, subject: "qa@example.test", role: "owner" } } });
  if (path.endsWith("/site-settings") && request.method() === "GET") return route.fulfill({ json: { ok: true, data: payload() } });
  if (path.endsWith("/site-settings/media") && request.method() === "POST") {
    const body = request.postDataBuffer()?.toString("latin1") ?? "";
    const key = body.match(/name="key"\r\n\r\n([^\r\n]+)/)?.[1];
    assert.ok(key, "multipart upload includes setting key");
    const url = `/media/qa/${key}.png`;
    const setting = update(key, url);
    return route.fulfill({ json: { ok: true, data: { setting } } });
  }
  if (path.endsWith("/site-settings/publish") && request.method() === "POST") {
    const body = request.postDataJSON();
    return route.fulfill({ json: { ok: true, data: { setting: update(body.key, "", true) } } });
  }
  if (path.endsWith("/site-settings") && request.method() === "PATCH") {
    const body = request.postDataJSON();
    return route.fulfill({ json: { ok: true, data: { setting: update(body.key, body.value) } } });
  }
  return route.fulfill({ json: { ok: true, data: {} } });
});

async function publicReadback(width, expectedDark = "/media/qa/logo_dark_url.png") {
  await page.setViewportSize({ width, height: 900 });
  await page.route(`${origin}/`, async (route) => {
    const publicSettings = { ...defaults, ...Object.fromEntries([...values].map(([key, value]) => [key, value])) };
    const body = applyHomepageSiteSettingsToMarkup(home.markup, publicSettings);
    return route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><head><style>${home.css ?? ""}</style></head><body>${body}</body></html>` });
  });
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".header_logo")).toHaveAttribute("src", "/media/qa/logo_url.png");
  await expect(page.locator(".header-logo-dark")).toHaveAttribute("src", expectedDark);
  await expect(page.locator("footer .icon-box-img img")).toHaveAttribute("src", "/media/qa/logo_url.png");
  const logoFits = await page.evaluate(() => {
    const images = [...document.querySelectorAll("#logo img, footer .icon-box-img img")];
    return images.every((image) => image.getBoundingClientRect().width <= innerWidth);
  });
  assert.equal(logoFits, true, `managed logos fit at ${width}px`);
}

await page.goto(`${origin}/admin/noi-dung`, { waitUntil: "domcontentloaded" });
await expect(page.getByRole("heading", { name: "Nội dung & thương hiệu" })).toBeVisible();

for (const [label, fileName] of [["Logo sáng", "logo-light.png"], ["Logo tối", "logo-dark.png"], ["Favicon", "favicon.png"]]) {
  await page.getByLabel(`Tải ảnh lên cho ${label}`).setInputFiles({ name: fileName, mimeType: "image/png", buffer: imageBytes });
  await expect(page.getByRole("status")).toContainText("Đã tải ảnh lên và lưu bản nháp");
  const key = label === "Logo sáng" ? "logo_url" : label === "Logo tối" ? "logo_dark_url" : "favicon_url";
  await expect(page.getByTestId(`setting-preview-${key}`)).toHaveAttribute("src", `/media/qa/${key}.png`);
}

await page.reload();
await expect(page.getByTestId("setting-preview-logo_url")).toHaveAttribute("src", "/media/qa/logo_url.png");
await expect(page.getByTestId("setting-preview-logo_dark_url")).toHaveAttribute("src", "/media/qa/logo_dark_url.png");
await expect(page.getByTestId("setting-preview-favicon_url")).toHaveAttribute("src", "/media/qa/favicon_url.png");

for (const key of ["logo_url", "logo_dark_url", "favicon_url"]) {
  await page.getByTestId(`button-setting-publish-${key}`).click();
  await expect(page.getByRole("status")).toContainText("Đã phát hành");
}
assert.deepEqual([...settings.values()].map((setting) => setting.publishedValue), ["/media/qa/logo_url.png", "/media/qa/logo_dark_url.png", "/media/qa/favicon_url.png"]);
await publicReadback(1440);
await publicReadback(390);
values.set("logo_dark_url", "");
await publicReadback(390, "/media/qa/logo_url.png");

await browser.close();
console.log(JSON.stringify({ ok: true, checked: ["upload", "preview", "reload", "publish", "public-header-desktop", "public-header-mobile", "public-footer", "favicon-separation", "fallback-contract"] }));
