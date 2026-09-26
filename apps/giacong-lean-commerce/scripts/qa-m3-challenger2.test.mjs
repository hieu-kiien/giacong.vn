import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(...segments) {
  return readFile(new URL(`../src/${segments.join("/")}`, import.meta.url), "utf8");
}

/* ========================================================================== */
/* SECTION 1: Standardized AdminModal Accessibility & Contract Verification    */
/* ========================================================================== */

test("AdminModal: Core accessibility primitives and WAI-ARIA compliance in AdminDialog.tsx", async () => {
  const dialogSrc = await readSource("components", "admin", "AdminDialog.tsx");

  // 1. WAI-ARIA Dialog semantics
  assert.match(dialogSrc, /role="dialog"/, "AdminModal surface must declare role='dialog'");
  assert.match(dialogSrc, /aria-modal="true"/, "AdminModal surface must declare aria-modal='true'");
  assert.match(dialogSrc, /aria-labelledby=\{labelledBy\}/, "AdminModal must connect aria-labelledby to labelledBy prop");
  assert.match(dialogSrc, /aria-describedby=\{describedBy\}/, "AdminModal must support aria-describedby");
  assert.match(dialogSrc, /tabIndex=\{-1\}/, "AdminModal surface must have tabIndex=-1 for programmatic focus");

  // 2. Header and close accessibility
  assert.match(dialogSrc, /<h2 id=\{labelledBy\}>\{title\}<\/h2>/, "AdminModal header must provide matching h2 with id={labelledBy}");
  assert.match(dialogSrc, /aria-label="Đóng"/, "AdminModal close button must have clear accessible name");

  // 3. Portal rendering
  assert.match(dialogSrc, /createPortal\(/, "AdminModal must render via React createPortal");
  assert.match(dialogSrc, /document\.body/, "AdminModal must portal into document.body");
  assert.match(dialogSrc, /if \(!mounted \|\| typeof document === "undefined"\)\s*\{\s*return null;\s*\}/, "AdminModal must handle SSR safely");

  // 4. Keyboard ESC handling
  assert.match(dialogSrc, /if \(event\.key === "Escape"\)\s*\{\s*event\.preventDefault\(\);\s*onCloseRef\.current\(\);/, "AdminModal must close on Escape key with event.preventDefault");

  // 5. Focus trapping & restoration
  assert.match(dialogSrc, /document\.addEventListener\("keydown", onKeyDown\)/, "AdminModal must attach keydown listener for tab trap");
  assert.match(dialogSrc, /event\.key !== "Tab"/, "AdminModal must check for Tab key during trapping");
  assert.match(dialogSrc, /event\.shiftKey/, "AdminModal must support backwards tab trapping with Shift+Tab");
  assert.match(dialogSrc, /previouslyFocused\.focus\(\)/, "AdminModal must restore previously focused element on unmount");

  // 6. Body scroll lock
  assert.match(dialogSrc, /document\.body\.style\.overflow = "hidden"/, "AdminModal must prevent background scroll while mounted");
  assert.match(dialogSrc, /document\.body\.style\.overflow = originalOverflow/, "AdminModal must restore body overflow on unmount");
});

test("AdminModal instance 1: khach-hang Create Customer modal uses AdminModal with WAI-ARIA and no hand-rolled overlays", async () => {
  const pageSrc = await readSource("app", "admin", "khach-hang", "page.tsx");

  // 1. Clean import and instantiation
  assert.match(pageSrc, /import \{[^}]*AdminModal[^}]*\} from "@\/components\/admin\/AdminDialog"/, "Must import AdminModal");
  assert.match(pageSrc, /<AdminModal\s+labelledBy="customer-create-modal-title"\s+onClose=\{\(\) => setIsCreateOpen\(false\)\}\s+title="Tạo Hồ Sơ Khách Hàng Doanh Nghiệp Mới"/, "Create customer modal must be instantiated via AdminModal with explicit title and labelledBy");

  // 2. Hand-rolled fixed overlay elimination
  assert.doesNotMatch(pageSrc, /position:\s*"fixed",\s*inset:\s*0,\s*zIndex:\s*60/, "Must not contain raw inline fixed modal overlay");
  assert.doesNotMatch(pageSrc, /backgroundColor:\s*"rgba\(0,\s*0,\s*0,\s*0\.4\)"/, "Must not contain inline rgba backdrop");

  // 3. Form elements and accessible buttons inside modal
  assert.match(pageSrc, /Tên công ty \/ Đơn vị đặt hàng \*/, "Company name field must be clearly labeled");
  for (const [fieldId, element] of [
    ["customer-company-name", "input"],
    ["customer-tax-code", "input"],
    ["customer-phone", "input"],
    ["customer-email", "input"],
    ["customer-industry", "select"],
    ["customer-tier", "select"],
  ]) {
    assert.match(pageSrc, new RegExp(`<label[^>]*htmlFor="${fieldId}"`), `${fieldId} needs a connected label`);
    assert.match(pageSrc, new RegExp(`<${element}[^>]*id="${fieldId}"`), `${fieldId} needs a matching control id`);
  }
  assert.match(pageSrc, /onClick=\{\(\) => setIsCreateOpen\(false\)\}/, "Cancel button must dismiss modal");
  assert.match(pageSrc, /disabled=\{creating \|\| !newCompany\.trim\(\)\}/, "Submit button must have guarded disabled state");
});

test("AdminModal instance 2: AdminCustomerDrawer uses AdminModal with WAI-ARIA, portal and wide layout", async () => {
  const drawerSrc = await readSource("components", "admin", "AdminCustomerDrawer.tsx");

  // 1. AdminModal integration
  assert.match(drawerSrc, /import \{ AdminModal \} from "@\/components\/admin\/AdminDialog"/, "AdminCustomerDrawer must import AdminModal");
  assert.match(drawerSrc, /<AdminModal\s+labelledBy="customer-drawer-title"\s+onClose=\{onClose\}\s+title=\{customer\?\.company_name \|\| "Chi tiết Doanh nghiệp"\}\s+width="wide"/, "AdminCustomerDrawer must configure AdminModal with labelledBy, onClose, and width='wide'");

  // 2. Raw overlay elimination
  assert.doesNotMatch(drawerSrc, /style=\{\{\s*position:\s*"fixed",\s*inset:\s*0,\s*backgroundColor:\s*"rgba\(0,\s*0,\s*0,\s*0\.4\)"/, "Drawer must not use legacy fixed backdrop");

  // 3. Semantic closing tag
  assert.match(drawerSrc, /<\/AdminModal>/, "AdminCustomerDrawer must terminate with </AdminModal>");
});

/* ========================================================================== */
/* SECTION 2: Sticky Action Bar Layout & Viewport Verification (< 768px)       */
/* ========================================================================== */

test("Sticky Action Bar CSS: Layout, positioning, and mobile responsive rules", async () => {
  const css = await readSource("styles", "admin.css");

  // 1. Sticky positioning and elevation
  assert.match(css, /\.admin-floating-action-bar\s*\{[^}]*position:\s*sticky;/s, "Floating action bar must have position: sticky");
  assert.match(css, /\.admin-floating-action-bar\s*\{[^}]*bottom:\s*16px;/s, "Floating action bar default bottom offset is 16px");
  assert.match(css, /\.admin-floating-action-bar\s*\{[^}]*z-index:\s*40;/s, "Floating action bar z-index must be 40 to stay above table content");
  assert.match(css, /\.admin-floating-action-bar\s*\{[^}]*backdrop-filter:\s*blur\(12px\);/s, "Floating action bar must have blur backdrop");

  // 2. Dirty state visual indicator
  assert.match(css, /\.admin-floating-action-bar\.is-dirty\s*\{[^}]*border-color:\s*#f59e0b;/s, "Dirty action bar must have warning border");
  assert.match(css, /\.admin-floating-dirty-dot\s*\{[^}]*animation:\s*admin-dirty-pulse\s+2s\s+infinite/s, "Dirty dot must have pulse animation");

  // 3. Flex wrap layout on inner container
  assert.match(css, /\.admin-floating-action-bar-inner\s*\{[^}]*display:\s*flex;/s, "Inner container must be flex");
  assert.match(css, /\.admin-floating-action-bar-inner\s*\{[^}]*flex-wrap:\s*wrap;/s, "Inner container must flex-wrap to prevent overflow");
  assert.match(css, /\.admin-floating-action-bar-inner\s*\{[^}]*justify-content:\s*space-between;/s, "Inner container must justify space-between");

  // 4. Mobile responsive rule (< 768px -> max-width: 640px)
  assert.match(
    css,
    /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.admin-floating-action-bar\s*\{[^}]*bottom:\s*8px;[\s\S]*?\.admin-floating-action-bar-inner\s*\{[^}]*flex-direction:\s*column;[\s\S]*?\.admin-floating-action-bar-actions\s*\{[^}]*justify-content:\s*flex-end;/s,
    "Mobile action bar must adapt to narrow viewports"
  );
});

test("Sticky Action Bar & Progressive Disclosure: Product Editor (/admin/san-pham)", async () => {
  const pageSrc = await readSource("app", "admin", "san-pham", "page.tsx");

  // 1. Progressive Disclosure Tabs
  assert.match(pageSrc, /role="tablist"/, "Tabs container must declare role='tablist'");
  assert.match(pageSrc, /role="tab"/, "Tab buttons must declare role='tab'");
  assert.match(pageSrc, /id="tab-btn-general"/, "Tab button general id");
  assert.match(pageSrc, /id="tab-btn-media"/, "Tab button media id");
  assert.match(pageSrc, /id="tab-btn-variants-seo"/, "Tab button variants_seo id");
  assert.match(pageSrc, /role="tabpanel"/, "Tab panels must declare role='tabpanel'");

  // 2. DOM Retention invariant (no conditional unmounting)
  assert.match(pageSrc, /display:\s*activeTab === "general" \? "block" : "none"/, "Tab 1 must stay in DOM with CSS display toggle");
  assert.match(pageSrc, /display:\s*activeTab === "media" \? "block" : "none"/, "Tab 2 must stay in DOM with CSS display toggle");
  assert.match(pageSrc, /display:\s*activeTab === "variants_seo" \? "block" : "none"/, "Tab 3 must stay in DOM with CSS display toggle");

  // 3. Floating Sticky Action Bar integration
  assert.match(pageSrc, /className=\{`admin-floating-action-bar \$\{isDirty \? "is-dirty" : ""\}`\}/, "Must bind isDirty to action bar class");
  assert.match(pageSrc, /role="region"/, "Action bar must declare role='region'");
  assert.match(pageSrc, /aria-label="Thao tác lưu biểu mẫu"/, "Action bar must provide accessible region label");
  assert.match(pageSrc, /data-testid="button-product-cancel"/, "Cancel button testid preserved in floating bar");
  assert.match(pageSrc, /data-testid="button-product-save"/, "Save button testid preserved in floating bar");
  assert.match(pageSrc, /Có thay đổi chưa lưu/, "Pulsing dirty indicator text must be present");
});

test("Sticky Action Bar & Progressive Disclosure: Service Editor (/admin/dich-vu)", async () => {
  const pageSrc = await readSource("app", "admin", "dich-vu", "page.tsx");

  // 1. Progressive Disclosure Tabs
  assert.match(pageSrc, /role="tablist"/, "Tabs container must declare role='tablist'");
  assert.match(pageSrc, /role="tab"/, "Tab buttons must declare role='tab'");
  assert.match(pageSrc, /id="service-tab-btn-general"/, "Service tab general id");
  assert.match(pageSrc, /id="service-tab-btn-offerings"/, "Service tab offerings id");
  assert.match(pageSrc, /id="service-tab-btn-media"/, "Service tab media id");
  assert.match(pageSrc, /role="tabpanel"/, "Service tab panels must declare role='tabpanel'");

  // 2. DOM Retention invariant (no conditional unmounting)
  assert.match(pageSrc, /display:\s*activeTab === "general" \? "block" : "none"/, "Tab 1 must stay in DOM with CSS display toggle");
  assert.match(pageSrc, /display:\s*activeTab === "offerings" \? "block" : "none"/, "Tab 2 must stay in DOM with CSS display toggle");
  assert.match(pageSrc, /display:\s*activeTab === "media_cta" \? "block" : "none"/, "Tab 3 must stay in DOM with CSS display toggle");

  // 3. Floating Sticky Action Bar integration
  assert.match(pageSrc, /className=\{`admin-floating-action-bar \$\{isDirty \? "is-dirty" : ""\}`\}/, "Must bind isDirty to action bar class");
  assert.match(pageSrc, /role="region"/, "Action bar must declare role='region'");
  assert.match(pageSrc, /aria-label="Thao tác lưu dịch vụ"/, "Action bar must provide accessible region label");
  assert.match(pageSrc, /data-testid="button-service-cancel"/, "Cancel button testid preserved in floating bar");
  assert.match(pageSrc, /data-testid="button-service-save"/, "Save button testid preserved in floating bar");
  assert.match(pageSrc, /Có thay đổi chưa lưu/, "Pulsing dirty indicator text must be present");
});
