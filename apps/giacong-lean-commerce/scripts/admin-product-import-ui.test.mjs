import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL("../src/components/admin/AdminProductImportPanel.tsx", import.meta.url);
const pagePath = new URL("../src/app/admin/san-pham/page.tsx", import.meta.url);

test("product import UI panel exists and exposes the safe CSV workflow", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /parseProductImportCsv/);
  assert.match(source, /prepareAdminProductImportRows/);
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /rows/);
  assert.match(source, /Chỉ nhập dòng hợp lệ/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-busy/);
  assert.match(source, /replayed/);
  assert.match(source, /catalog_manager/);
  assert.match(source, /<button className="admin-button admin-button-quiet admin-import-file-label"/);
  assert.match(source, /onClick=\{\(\) => inputRef\.current\?\.click\(\)\}/);
  assert.match(source, /type="button"/);
  assert.match(source, /inputRef/);
  assert.match(source, /result\.createdCount < validRows\.length/);
  assert.match(source, /Kết quả nhập một phần/);
});

test("product page integrates bulk import without changing the API surface", async () => {
  const [page, component] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(componentPath, "utf8"),
  ]);

  assert.ok(component.includes("/api/admin/products/import"));
  assert.match(page, /AdminProductImportPanel/);
  assert.match(page, /onImported/);
  await access(componentPath);
});
