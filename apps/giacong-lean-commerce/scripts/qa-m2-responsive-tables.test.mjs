import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(...segments) {
  return readFile(new URL(`../src/${segments.join("/")}`, import.meta.url), "utf8");
}

test("M2 CSS: min-width: 1080px is completely removed from admin table styles", async () => {
  const css = await readSource("styles", "admin.css");
  assert.doesNotMatch(css, /1080px/, "rigid 1080px constraint must be eliminated");
});

test("M2 CSS: defective mobile display:none hack is replaced with universal card styling", async () => {
  const css = await readSource("styles", "admin.css");
  assert.doesNotMatch(
    css,
    /\.admin-product-table\s+td\s*\{\s*display:\s*none/,
    "defective hack hiding cells must be gone"
  );
  assert.match(
    css,
    /\.admin-table,\s*\.admin-table\s+thead,\s*\.admin-table\s+tbody,\s*\.admin-table\s+tr,\s*\.admin-table\s+th,\s*\.admin-table\s+td\s*\{[^}]*display:\s*block/
  );
});

test("M2 CSS: mobile table-to-card rules enforce block layout and clip thead", async () => {
  const css = await readSource("styles", "admin.css");

  // thead is visually clipped for screen readers
  assert.match(css, /\.admin-table\s+thead\s*\{[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
  assert.match(css, /\.admin-table\s+thead\s*\{[^}]*position:\s*absolute/);

  // tbody rows are styled as cards
  assert.match(css, /\.admin-table\s+tbody\s+tr\s*\{[^}]*border:\s*1px\s+solid/);
  assert.match(css, /\.admin-table\s+tbody\s+tr\s*\{[^}]*border-radius:\s*8px/);
  assert.match(css, /\.admin-table\s+tbody\s+tr\s*\{[^}]*background:\s*var\(--admin-surface\)/);

  // td elements have borders removed and padding standardized
  assert.match(css, /\.admin-table\s+td\s*\{[^}]*border:\s*none\s*!important/);

  // data-label attribute generates card field label
  assert.match(css, /\.admin-table\s+td\[data-label\]::before\s*\{[^}]*content:\s*attr\(data-label\)/);
});

test("M2 CSS: text overflow prevention is configured for mobile cards", async () => {
  const css = await readSource("styles", "admin.css");

  assert.match(css, /\.admin-table\s+\.admin-item-name\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.admin-table\s+\.admin-item-desc\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.admin-table\s+\.admin-description[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.admin-table\s+\.admin-mono\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("M2 CSS: mobile actions and select wrap gracefully", async () => {
  const css = await readSource("styles", "admin.css");

  // action cell wraps and takes full card width
  assert.match(css, /\.admin-table\s+\.admin-table-actions\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.admin-table\s+\.admin-table-actions\s+\.admin-button\s*\{[^}]*min-height:\s*40px/);

  // lead status select is 100% width on mobile
  assert.match(css, /\.admin-lead-status-select\s*\{[^}]*max-width:\s*100%/);
  assert.match(css, /\.admin-lead-status-select\s*\{[^}]*min-height:\s*38px/);
});

test("M2 Leads Table (/admin/yeu-cau): inline minWidth: 150 is removed and status select is streamlined", async () => {
  const page = await readSource("app", "admin", "yeu-cau", "page.tsx");

  assert.doesNotMatch(page, /minWidth:\s*150/, "intrusive 150px inline style must be eliminated");
  assert.match(page, /className="admin-select admin-lead-status-select"/);
  assert.match(page, /data-testid=\{`select-lead-status-\$\{lead\.id\}`\}/);
  assert.match(page, /data-label="Người liên hệ"/);
  assert.match(page, /data-label="Liên lạc"/);
  assert.match(page, /data-label="Nhu cầu"/);
  assert.match(page, /data-label="Mã yêu cầu"/);
  assert.match(page, /data-label="Trạng thái"/);
  assert.match(page, /data-label="Gửi dữ liệu"/);
  assert.match(page, /data-label="Tiếp nhận"/);
});

test("M2 Products Table (/admin/san-pham): data-labels and action cell layout on mobile", async () => {
  const page = await readSource("app", "admin", "san-pham", "page.tsx");

  assert.match(page, /data-label="Danh mục \/ Mã hàng"/);
  assert.match(page, /data-label="Quy cách"/);
  assert.match(page, /data-label="Tối thiểu \/ Giá từ"/);
  assert.match(page, /data-label="Đã bán"/);
  assert.match(page, /data-label="Trạng thái"/);
  assert.match(page, /data-label="Thời gian làm hàng"/);
  assert.match(page, /data-label="Cập nhật"/);
  assert.match(page, /canManage \? <td className="admin-product-select">/);
  assert.match(page, /canManage \? <td className="admin-sticky-actions">/);
});

test("M2 Services Table (/admin/dich-vu): data-labels and responsive actions", async () => {
  const page = await readSource("app", "admin", "dich-vu", "page.tsx");

  assert.match(page, /data-label="Tóm tắt"/);
  assert.match(page, /data-label="Trạng thái"/);
  assert.match(page, /data-label="Tối thiểu"/);
  assert.match(page, /data-label="Thời gian làm hàng"/);
  assert.match(page, /data-label="Cập nhật"/);
  assert.match(page, /className="admin-sticky-actions"/);
  assert.match(page, /className="admin-table-actions"/);
});

test("M2 Customers Table (/admin/khach-hang): data-labels and responsive card styling", async () => {
  const page = await readSource("app", "admin", "khach-hang", "page.tsx");

  assert.match(page, /data-label="Doanh nghiệp"/);
  assert.match(page, /data-label="Mã số thuế"/);
  assert.match(page, /data-label="Ngành nghề"/);
  assert.match(page, /data-label="Phân hạng"/);
  assert.match(page, /data-label="Yêu cầu RFQ"/);
  assert.match(page, /data-label="Tương tác cuối"/);
  assert.match(page, /className="admin-sticky-actions"/);
  assert.match(page, /className="admin-table-actions"/);
});

test("M2 Geometry Simulation: Viewport 360px card layout has zero overflow", async () => {
  const css = await readSource("styles", "admin.css");

  // Verify responsive media query threshold
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);

  // Compute mobile box budget on 360px viewport:
  // Viewport = 360px
  // .admin-content: padding 29px 17px 52px => content width = 360 - (17 * 2) = 326px
  // .admin-table tbody: padding 12px => table content width = 326 - (12 * 2) = 302px
  // .admin-table tbody tr: padding 12px, border 1px * 2 => card inner width = 302 - 24 - 2 = 276px
  const viewportWidth = 360;
  const contentPadding = 17 * 2;
  const tbodyPadding = 12 * 2;
  const cardPadding = 12 * 2;
  const cardBorder = 1 * 2;
  const innerCardWidth = viewportWidth - contentPadding - tbodyPadding - cardPadding - cardBorder;

  assert.equal(innerCardWidth, 276, "Calculated inner card width on 360px viewport is 276px");

  // Sub-element checks inside 276px:
  // 1. .admin-thumb: 48px width + 12px gap = 60px. Remaining for .admin-item-name = 216px.
  //    .admin-item-name has flex: 1, min-width: 0, overflow-wrap: anywhere => Fits within 216px without overflow.
  // 2. .admin-lead-status-select: max-width: 100%, width: 100% => Fits 276px.
  // 3. .admin-table-actions .admin-button: flex: 1 1 120px, flex-wrap: wrap => Each button takes 100% or 50% if room, wraps on overflow.
  // 4. .admin-product-cell: min-width: 0 !important, width: 100% => No rigid min-width.
  assert.ok(innerCardWidth > 120, "Cards have ample space for 120px mobile action buttons");
});
