import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product and news editors validate locally before mutating", async () => {
  const [product, news] = await Promise.all([
    readFile(new URL("../src/app/admin/san-pham/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/tin-tuc/page.tsx", import.meta.url), "utf8"),
  ]);
  const productSubmit = product.slice(product.indexOf("async function submitProduct"), product.indexOf("async function archiveProduct"));
  const newsSubmit = news.slice(news.indexOf("async function submitPost"), news.indexOf("async function confirmDelete"));

  assert.match(product, /parseAdminProductPayload/);
  assert.match(productSubmit, /if \(!parsed\.input\)/);
  assert.match(product, /product-form-field-errors/);
  assert.match(news, /parseAdminNewsPayload/);
  assert.match(newsSubmit, /if \(!parsed\.input\)/);
  assert.match(newsSubmit, /setFieldErrors\(parsed\.fieldErrors\)/);
  assert.ok(productSubmit.indexOf("if (!parsed.input)") < productSubmit.indexOf("mutateAdmin"));
  assert.ok(newsSubmit.indexOf("if (!parsed.input)") < newsSubmit.indexOf("mutateAdmin"));
  assert.match(product, /<form\b(?=[^>]*\bnoValidate\b)(?=[^>]*\bonSubmit=\{onSubmit\})[^>]*>/);
  assert.match(news, /<form\b(?=[^>]*\bnoValidate\b)(?=[^>]*\bonSubmit=\{submitPost\})[^>]*>/);
});

test("service editor exposes server field errors instead of only a generic alert", async () => {
  const service = await readFile(
    new URL("../src/app/admin/dich-vu/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(service, /service-form-field-errors/);
  assert.match(service, /Object\.entries\(error\.fieldErrors\)/);
});

test("product and service validation summaries use Vietnamese labels and navigate to fields", async () => {
  const [product, service] = await Promise.all([
    readFile(new URL("../src/app/admin/san-pham/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/dich-vu/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(product, /productFieldLabels/);
  assert.match(product, /button-product-error-\$\{field\}/);
  assert.match(product, /focusProductFieldError/);
  assert.doesNotMatch(product, /\{field\}: \{message\}/);
  assert.match(service, /serviceFieldLabels/);
  assert.match(service, /button-service-error-\$\{field\}/);
  assert.match(service, /focusServiceFieldError/);
  assert.doesNotMatch(service, /\{field\}: \{message\}/);
});

test("service and variant saves reuse request ids when retrying the same payload", async () => {
  const [service, variant] = await Promise.all([
    readFile(new URL("../src/app/admin/dich-vu/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminVariantPanel.tsx", import.meta.url), "utf8"),
  ]);
  const serviceSubmit = service.slice(service.indexOf("async function submitService"), service.indexOf("async function archiveService"));
  const variantSubmit = variant.slice(variant.indexOf("async function saveVariant"), variant.indexOf("async function archiveVariant"));

  assert.match(service, /serviceRequestRef = useRef/);
  assert.match(serviceSubmit, /requestKey/);
  assert.match(serviceSubmit, /serviceRequestRef\.current\?\.key === requestKey/);
  assert.match(variant, /variantRequestRef = useRef/);
  assert.match(variantSubmit, /requestKey/);
  assert.match(variantSubmit, /variantRequestRef\.current\?\.key === requestKey/);
});

test("product SEO preview follows saved product fields and marks an edited slug as custom", async () => {
  const [product, seo] = await Promise.all([
    readFile(new URL("../src/app/admin/san-pham/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminProductSeoPreview.tsx", import.meta.url), "utf8"),
  ]);
  const preview = product.slice(product.indexOf("<AdminProductSeoPreview"), product.indexOf("\n            />", product.indexOf("<AdminProductSeoPreview")));

  assert.match(preview, /seo\.slug === form\.slug/);
  assert.match(preview, /slugFollowsName:\s*seo\.slug\.trim\(\) === ""/);
  assert.match(seo, /const data = initialData/);
  assert.match(seo, /readOnly/);
  assert.match(seo, /tên, mô tả ngắn/i);
});

test("lead bulk status reports partial failures and leaves failed records selected", async () => {
  const lead = await readFile(new URL("../src/app/admin/yeu-cau/page.tsx", import.meta.url), "utf8");
  const start = lead.indexOf("async function applyBulkStatus");
  const bulkSubmit = lead.slice(start, start + 1800);

  assert.match(bulkSubmit, /failedLeads/);
  assert.match(bulkSubmit, /setSelectedIds\(new Set\(failedLeads/);
  assert.match(bulkSubmit, /showToast\("error"/);
  assert.doesNotMatch(bulkSubmit, /catch\s*\{\s*\/\/ continue with other leads/);
});

test("publishing content changes requires a clear confirmation and explains disabled publish-all", async () => {
  const content = await readFile(new URL("../src/app/admin/noi-dung/page.tsx", import.meta.url), "utf8");

  assert.match(content, /confirmSaveAndPublish/);
  assert.match(content, /saveAndPublishRequestRef = useRef/);
  assert.match(content, /Xác nhận phát hành/);
  assert.match(content, /Còn \{unsavedKeys\.size\} mục chưa lưu/);
  assert.match(content, /aria-pressed=\{activeGroup === tab\.value\}/);
});

test("product and news status filters expose their selected state to assistive technology", async () => {
  const [product, news] = await Promise.all([
    readFile(new URL("../src/app/admin/san-pham/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/tin-tuc/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(product, /aria-pressed=\{statusFilter === "all"\}/);
  assert.match(product, /aria-label="Lọc sản phẩm theo trạng thái"/);
  assert.match(news, /aria-pressed=\{statusFilter === "all"\}/);
  assert.match(news, /aria-label="Lọc bài viết theo trạng thái"/);
});

test("news admin search persists in the URL and reaches a bounded server-side query", async () => {
  const [page, route, data] = await Promise.all([
    readFile(new URL("../src/app/admin/tin-tuc/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/news/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/admin-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /data-testid="input-news-search"/);
  assert.match(page, /params\.set\("q", searchQuery\)/);
  assert.match(page, /searchQuery/);
  assert.match(route, /searchQuery\.length > 120/);
  assert.match(route, /query: searchQuery/);
  assert.match(data, /input\.query/);
  assert.match(data, /ESCAPE/);
});
