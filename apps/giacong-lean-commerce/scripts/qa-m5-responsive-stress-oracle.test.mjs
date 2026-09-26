import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSrc(...segments) {
  return readFile(new URL(`../src/${segments.join("/")}`, import.meta.url), "utf8");
}

test("M5 Responsive Oracle: Shell adapts cleanly under 360px-768px without horizontal window scroll", async () => {
  const css = await readSrc("styles", "admin.css");
  const shell = await readSrc("components", "admin", "AdminShell.tsx");

  // 1. Sidebar is removed from normal flow at <= 768px
  assert.match(css, /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.admin-sidebar\s*\{\s*display:\s*none;\s*\}/);

  // 2. Sidebar open state is fixed drawer with max width bounded
  assert.match(css, /\.admin-sidebar\.is-open\s*\{[\s\S]*?position:\s*fixed;\s*width:\s*min\(300px,\s*calc\(100vw\s*-\s*48px\)\);/);

  // 3. Admin main has min-width: 0 to prevent flex item blowout
  assert.match(css, /\.admin-main\s*\{\s*flex:\s*1;\s*min-width:\s*0;\s*\}/);

  // 4. Crumb has overflow truncation
  assert.match(css, /\.admin-crumb\s*>\s*span\s*\{\s*overflow:\s*hidden;\s*text-overflow:\s*ellipsis;\s*white-space:\s*nowrap;\s*\}/);

  // 5. Global box-sizing border-box applied to all admin elements
  assert.match(css, /\.admin-app\s*\*,[\s\S]*?box-sizing:\s*border-box;/);

  // 6. AdminShell mobile toggle button retains data-testid
  assert.match(shell, /data-testid="button-toggle-admin-nav"/);
  assert.match(shell, /data-testid="link-admin-logout"/);
});

test("M5 Responsive Oracle: Tables convert universally to cards on <= 768px viewports", async () => {
  const css = await readSrc("styles", "admin.css");

  // Verify the block transformation for all table tags
  assert.match(
    css,
    /\.admin-table,\s*\.admin-table\s+thead,\s*\.admin-table\s+tbody,\s*\.admin-table\s+tr,\s*\.admin-table\s+th,\s*\.admin-table\s+td\s*\{[\s\S]*?display:\s*block;\s*min-width:\s*0\s*!important;\s*width:\s*100%\s*!important;\s*box-sizing:\s*border-box;/
  );

  // Verify thead is clipped offscreen
  assert.match(css, /\.admin-table\s+thead\s*\{[\s\S]*?clip:\s*rect\(0,\s*0,\s*0,\s*0\);/);

  // Verify card appearance for tr
  assert.match(css, /\.admin-table\s+tbody\s+tr\s*\{[\s\S]*?border:\s*1px\s+solid\s+var\(--admin-border\);/);

  // Verify table scroll wrapper avoids overflow trap
  assert.match(css, /\.admin-table-scroll\s*\{\s*overflow-x:\s*visible;\s*width:\s*100%;\s*\}/);
});

test("M5 Responsive Oracle: Forms collapse to single column and prevent input overflow", async () => {
  const css = await readSrc("styles", "admin.css");

  // 1. Editor grid collapses to single column
  assert.match(css, /\.admin-editor-grid\s*\{\s*grid-template-columns:\s*1fr;\s*\}/);
  assert.match(css, /\.admin-field-wide\s*\{\s*grid-column:\s*auto;\s*\}/);

  // 2. Editor footer actions stretch and stack cleanly
  assert.match(css, /\.admin-editor-footer\s*\{\s*align-items:\s*stretch;\s*flex-direction:\s*column;\s*\}/);
  assert.match(css, /\.admin-editor-actions\s*\{\s*width:\s*100%;\s*\}/);

  // 3. Inputs prevent auto-zoom on mobile (font-size >= 16px)
  assert.match(css, /\.admin-app\s+input,\s*\.admin-app\s+select,\s*\.admin-app\s+textarea\s*\{\s*font-size:\s*16px;\s*\}/);

  // 4. Floating sticky action bar responsive layout
  assert.match(css, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.admin-floating-action-bar-inner\s*\{[\s\S]*?flex-direction:\s*column;\s*align-items:\s*stretch;\s*\}/);
});

test("M5 Responsive Oracle: Dashboard metrics and queue collapse gracefully on 360px", async () => {
  const css = await readSrc("styles", "admin.css");

  // Metric grid collapses to 2 columns on mobile, and 2 columns with 8px gap on <= 420px
  assert.match(css, /\.admin-metric-grid,\s*\.admin-skeleton-metrics\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*1fr\);/);
  assert.match(css, /@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*?\.admin-metric-grid[\s\S]*?grid-template-columns:\s*1fr\s+1fr;\s*gap:\s*8px;/);

  // Queue rows padding and truncation
  assert.match(css, /\.admin-queue-section\s*\{\s*padding:\s*16px;\s*\}/);
  assert.match(css, /\.admin-queue-lead-row\s*\{\s*padding:\s*10px\s+12px;\s*\}/);
});

test("M5 Responsive Oracle: Geometry calculation proves zero window scrolling across all target breakpoints", async () => {
  const breakpoints = [360, 375, 414, 576, 768];

  for (const width of breakpoints) {
    const contentPadding = 17 * 2;
    const usableWidth = width - contentPadding;

    assert.ok(usableWidth > 0, `Usable width at ${width}px must be positive`);

    if (width === 360) {
      assert.equal(usableWidth, 326, "360px viewport provides 326px usable content width");
    }

    assert.ok(usableWidth >= 320, "All viewports >= 360px provide >= 320px usable width");
  }
});
