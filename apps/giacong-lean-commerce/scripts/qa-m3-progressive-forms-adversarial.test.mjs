import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(...segments) {
  return readFile(new URL(`../src/${segments.join("/")}`, import.meta.url), "utf8");
}

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `phải tìm thấy function ${name}()`);
  let depth = 0;
  let end = -1;
  let seenBrace = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      seenBrace = true;
    } else if (ch === "}") {
      depth -= 1;
      if (seenBrace && depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert.ok(end !== -1, `không đóng ngoặc được function ${name}`);
  return source.slice(start, end);
}

// 1. PRODUCT FORM: PROGRESSIVE DISCLOSURE & DOM RETENTION
test("M3 Product: 3 progressive disclosure tabs configured with proper WAI-ARIA roles", async () => {
  const source = await readSource("app", "admin", "san-pham", "page.tsx");

  // Tablist container
  assert.match(source, /role="tablist"/, "Product editor must have a tablist container");
  assert.match(source, /aria-label="Phân nhóm thông tin sản phẩm"/, "Tablist must have an accessible label");

  // 3 Tab buttons
  assert.match(source, /role="tab"[^>]*id="tab-btn-general"/, "Tab button 'general' must exist with id");
  assert.match(source, /role="tab"[^>]*id="tab-btn-media"/, "Tab button 'media' must exist with id");
  assert.match(source, /role="tab"[^>]*id="tab-btn-variants-seo"/, "Tab button 'variants-seo' must exist with id");

  // ARIA relationships
  assert.match(source, /aria-controls="tab-panel-general"/);
  assert.match(source, /aria-controls="tab-panel-media"/);
  assert.match(source, /aria-controls="tab-panel-variants-seo"/);

  assert.match(source, /role="tabpanel"[^>]*id="tab-panel-general"/);
  assert.match(source, /role="tabpanel"[^>]*id="tab-panel-media"/);
  assert.match(source, /role="tabpanel"[^>]*id="tab-panel-variants-seo"/);

  assert.match(source, /aria-labelledby="tab-btn-general"/);
  assert.match(source, /aria-labelledby="tab-btn-media"/);
  assert.match(source, /aria-labelledby="tab-btn-variants-seo"/);
});

test("M3 Product: Inactive tabs use CSS display toggle and NEVER unmount inputs", async () => {
  const source = await readSource("app", "admin", "san-pham", "page.tsx");

  // Assert NO conditional unmounting of tabs
  assert.doesNotMatch(
    source,
    /\{activeTab === ["']general["'] &&/,
    "Must not conditionally unmount general tab panel"
  );
  assert.doesNotMatch(
    source,
    /\{activeTab === ["']media["'] &&/,
    "Must not conditionally unmount media tab panel"
  );
  assert.doesNotMatch(
    source,
    /\{activeTab === ["']variants_seo["'] &&/,
    "Must not conditionally unmount variants_seo tab panel"
  );

  // Assert CSS display control
  assert.match(source, /style=\{\{\s*display:\s*activeTab === ["']general["'] \? ["']block["'] : ["']none["']\s*\}\}/);
  assert.match(source, /style=\{\{\s*display:\s*activeTab === ["']media["'] \? ["']block["'] : ["']none["']\s*\}\}/);
  assert.match(source, /style=\{\{\s*display:\s*activeTab === ["']variants_seo["'] \? ["']block["'] : ["']none["']\s*\}\}/);

  // Assert critical data-testids are present across tabs
  const requiredTestIds = [
    "input-product-name",
    "input-product-slug",
    "input-product-short-description",
    "input-product-description",
    "select-product-category",
    "input-product-sku",
    "select-product-status",
    "checkbox-product-active",
    "input-product-lead-time",
    "input-product-image",
    "button-product-save",
    "button-product-cancel",
  ];

  for (const tid of requiredTestIds) {
    assert.match(source, new RegExp(`data-testid="${tid}"`), `Product form must retain data-testid "${tid}"`);
  }
});

test("M3 Product: Floating Sticky Action Bar configured with dirty indicator & guard hooks", async () => {
  const source = await readSource("app", "admin", "san-pham", "page.tsx");

  assert.match(source, /className=\{`admin-floating-action-bar \$\{isDirty \? "is-dirty" : ""\}`\}/);
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label="Thao tác lưu biểu mẫu"/);
  assert.match(source, /admin-floating-dirty-indicator/);
  assert.match(source, /admin-floating-dirty-dot/);
  assert.match(source, /admin-floating-clean-indicator/);
  assert.match(source, /disabled=\{saving\}/);
});

// 2. SERVICE FORM: PROGRESSIVE DISCLOSURE & DOM RETENTION
test("M3 Service: 3 progressive disclosure tabs configured with proper WAI-ARIA roles", async () => {
  const source = await readSource("app", "admin", "dich-vu", "page.tsx");

  assert.match(source, /role="tablist"/, "Service editor must have a tablist container");
  assert.match(source, /role="tab"[^>]*id="service-tab-btn-general"/);
  assert.match(source, /role="tab"[^>]*id="service-tab-btn-offerings"/);
  assert.match(source, /role="tab"[^>]*id="service-tab-btn-media"/);

  assert.match(source, /aria-controls="service-tab-panel-general"/);
  assert.match(source, /aria-controls="service-tab-panel-offerings"/);
  assert.match(source, /aria-controls="service-tab-panel-media"/);

  assert.match(source, /role="tabpanel"[^>]*id="service-tab-panel-general"/);
  assert.match(source, /role="tabpanel"[^>]*id="service-tab-panel-offerings"/);
  assert.match(source, /role="tabpanel"[^>]*id="service-tab-panel-media"/);
});

test("M3 Service: Inactive tabs use CSS display toggle and NEVER unmount inputs", async () => {
  const source = await readSource("app", "admin", "dich-vu", "page.tsx");

  assert.doesNotMatch(source, /\{activeTab === ["']general["'] &&/);
  assert.doesNotMatch(source, /\{activeTab === ["']offerings["'] &&/);
  assert.doesNotMatch(source, /\{activeTab === ["']media_cta["'] &&/);

  assert.match(source, /style=\{\{\s*display:\s*activeTab === ["']general["'] \? ["']block["'] : ["']none["']\s*\}\}/);
  assert.match(source, /style=\{\{\s*display:\s*activeTab === ["']offerings["'] \? ["']block["'] : ["']none["']\s*\}\}/);
  assert.match(source, /style=\{\{\s*display:\s*activeTab === ["']media_cta["'] \? ["']block["'] : ["']none["']\s*\}\}/);

  const requiredTestIds = [
    "input-service-name",
    "input-service-slug",
    "input-service-summary",
    "input-service-description",
    "select-service-status",
    "checkbox-service-active",
    "input-service-sort-order",
    "input-service-moq",
    "input-service-lead-time",
    "input-service-offerings",
    "button-service-clear-image",
    "input-service-cta-label",
    "input-service-cta-href",
    "button-service-save",
    "button-service-cancel",
  ];

  for (const tid of requiredTestIds) {
    assert.match(source, new RegExp(`data-testid="${tid}"`), `Service form must retain data-testid "${tid}"`);
  }
});

test("M3 Service: Floating Sticky Action Bar configured with dirty indicator & guard hooks", async () => {
  const source = await readSource("app", "admin", "dich-vu", "page.tsx");

  assert.match(source, /className=\{`admin-floating-action-bar \$\{isDirty \? "is-dirty" : ""\}`\}/);
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label="Thao tác lưu dịch vụ"/);
  assert.match(source, /admin-floating-dirty-indicator/);
  assert.match(source, /admin-floating-dirty-dot/);
  assert.match(source, /admin-floating-clean-indicator/);
  assert.match(source, /disabled=\{saving\}/);
});

// 3. MODAL STANDARDIZATION
test("M3 Modals: khach-hang bulk tier dialog standardizes to AdminModal", async () => {
  const source = await readSource("app", "admin", "khach-hang", "page.tsx");

  assert.match(source, /import\s*\{\s*AdminModal\s*\}\s*from\s*["']@\/components\/admin\/AdminDialog["']/);
  assert.match(source, /<AdminModal[\s\S]*?labelledBy="customer-bulk-title"[\s\S]*?title="Đổi phân hạng khách hàng hàng loạt"/);

  // Ensure no hand-rolled overlay remains
  assert.doesNotMatch(source, /style=\{\{\s*position:\s*["']fixed["'],\s*inset:\s*0/);
});

test("M3 Modals: AdminCustomerDrawer standardizes to AdminModal", async () => {
  const source = await readSource("components", "admin", "AdminCustomerDrawer.tsx");

  assert.match(source, /import\s*\{\s*AdminModal\s*\}\s*from\s*["']@\/components\/admin\/AdminDialog["']/);
  assert.match(source, /<AdminModal[\s\S]*?labelledBy="customer-drawer-title"[\s\S]*?width="wide"/);

  // Ensure no hand-rolled overlay remains
  assert.doesNotMatch(source, /style=\{\{\s*position:\s*["']fixed["'],\s*inset:\s*0/);
});

// 4. CSS SPECIFICATIONS
test("M3 CSS: Progressive Form Tabs and Floating Action Bar classes are defined with responsive behavior", async () => {
  const css = await readSource("styles", "admin.css");

  // Tabs styles
  assert.match(css, /\.admin-form-tabs\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.admin-form-tabs\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.admin-form-tab\s*\{[^}]*border-bottom:\s*2px solid/);
  assert.match(css, /\.admin-form-tab\.is-active\s*\{/);
  assert.match(css, /\.admin-form-tab-panel\.is-hidden\s*\{[^}]*display:\s*none !important/);

  // Sticky Floating Action Bar styles
  assert.match(css, /\.admin-floating-action-bar\s*\{[^}]*position:\s*sticky/);
  assert.match(css, /\.admin-floating-action-bar\s*\{[^}]*bottom:\s*16px/);
  assert.match(css, /\.admin-floating-action-bar\s*\{[^}]*z-index:\s*40/);
  assert.match(css, /\.admin-floating-action-bar\.is-dirty\s*\{[^}]*border-color:/);
  assert.match(css, /\.admin-floating-dirty-dot\s*\{[^}]*animation:\s*admin-dirty-pulse/);

  // Mobile media query
  assert.match(css, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.admin-floating-action-bar\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.admin-floating-action-bar-inner\s*\{[\s\S]*?flex-direction:\s*column/);
});

// 5. ADVERSARIAL STRESS TESTS
test("Adversarial: isProductEditorDirty correctly catches mutations on all form properties", async () => {
  const source = await readSource("app", "admin", "san-pham", "page.tsx");
  const fnSource = extractFunction(source, "isProductEditorDirty");
  const jsSource = fnSource
    .replace(/:\s*ProductFormState\s*\|\s*null/g, "")
    .replace(/\)\s*:\s*boolean\s*\{/, ") {");
  const isDirty = new Function(`${jsSource}; return isProductEditorDirty;`)();

  const base = {
    categoryId: "1",
    description: "Mô tả sản phẩm chuẩn",
    id: 10,
    imageUrl: "/images/p10.png",
    isActive: true,
    leadTimeDays: "5",
    name: "Sản phẩm A",
    revision: 1,
    shortDescription: "Ngắn",
    sku: "SKU-A",
    slug: "san-pham-a",
    status: "published",
  };

  assert.equal(isDirty({ ...base }, { ...base }), false);
  assert.equal(isDirty({ ...base, name: "Sản phẩm A đã đổi" }, { ...base }), true);
  assert.equal(isDirty({ ...base, categoryId: "2" }, { ...base }), true);
  assert.equal(isDirty({ ...base, description: "Mô tả mới" }, { ...base }), true);
  assert.equal(isDirty({ ...base, imageUrl: "/images/p10-new.png" }, { ...base }), true);
  assert.equal(isDirty({ ...base, isActive: false }, { ...base }), true);
  assert.equal(isDirty({ ...base, leadTimeDays: "10" }, { ...base }), true);
  assert.equal(isDirty({ ...base, shortDescription: "Ngắn hơn" }, { ...base }), true);
  assert.equal(isDirty({ ...base, sku: "SKU-B" }, { ...base }), true);
  assert.equal(isDirty({ ...base, slug: "san-pham-a-moi" }, { ...base }), true);
  assert.equal(isDirty({ ...base, status: "draft" }, { ...base }), true);
  assert.equal(isDirty(null, { ...base }), false);
});

test("Adversarial: the real service editor parser handles malformed offering lines", async () => {
  const { parseOfferingLines } = await import("../src/lib/admin-service-offerings.ts");

  assert.deepEqual(parseOfferingLines(""), []);
  assert.deepEqual(parseOfferingLines("   \n   \n"), []);
  assert.deepEqual(parseOfferingLines("CNC | /cnc/\n | /empty-name/\nName only\n|||"), [
    { href: "/cnc/", label: "CNC" },
    { href: "/empty-name/", label: "" },
    { href: "", label: "Name only" },
    { href: "||", label: "" },
  ]);
});

test("Adversarial: single-flight confirmation invariant - zero window.confirm calls", async () => {
  const p1 = await readSource("app", "admin", "san-pham", "page.tsx");
  const p2 = await readSource("app", "admin", "dich-vu", "page.tsx");
  const p3 = await readSource("app", "admin", "khach-hang", "page.tsx");
  const p4 = await readSource("components", "admin", "AdminCustomerDrawer.tsx");

  assert.doesNotMatch(p1, /window\.confirm/, "san-pham must not use window.confirm");
  assert.doesNotMatch(p2, /window\.confirm/, "dich-vu must not use window.confirm");
  assert.doesNotMatch(p3, /window\.confirm/, "khach-hang must not use window.confirm");
  assert.doesNotMatch(p4, /window\.confirm/, "AdminCustomerDrawer must not use window.confirm");
});
