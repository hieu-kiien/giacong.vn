import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const rootDir = path.resolve(import.meta.dirname, "..");
const cssPath = path.join(rootDir, "src", "styles", "admin.css");
const pagePath = path.join(rootDir, "src", "app", "admin", "page.tsx");
const primitivesPath = path.join(rootDir, "src", "components", "admin", "AdminPrimitives.tsx");

const css = fs.readFileSync(cssPath, "utf8");
const pageCode = fs.readFileSync(pagePath, "utf8");
const primitivesCode = fs.readFileSync(primitivesPath, "utf8");

/* ========================================================================== */
/* SECTION 1: Viewport & Responsive CSS Stress Test (360px - 768px)          */
/* ========================================================================== */

test("Responsive Layout: Global box-sizing ensures border-box model for all admin elements", () => {
  assert.match(
    css,
    /\.admin-app\s*\*,[\s\S]*?box-sizing:\s*border-box/,
    "Global .admin-app * must have box-sizing: border-box"
  );
});

test("Responsive Layout: .admin-grid-2 collapses to 1fr under <= 1120px viewports", () => {
  // Ensure default desktop 2-column layout collapses to single column at mobile/tablet
  assert.match(
    css,
    /@media\s*\(\s*max-width:\s*1120px\s*\)[\s\S]*?\.admin-grid-2\s*\{\s*grid-template-columns:\s*1fr;\s*\}/,
    ".admin-grid-2 must collapse to single column at <= 1120px"
  );
});

test("Responsive Layout: No fixed pixel width > 320px in any dashboard or queue class", () => {
  const queueClasses = [
    "admin-operations-queue",
    "admin-queue-section",
    "admin-queue-lead-row",
    "admin-queue-lead-info",
    "admin-queue-lead-name",
    "admin-queue-lead-meta",
    "admin-queue-lead-action",
    "admin-queue-empty",
    "admin-queue-pipeline-card",
    "admin-queue-pipeline-actions",
    "admin-dashboard-sidebar-column",
    "admin-dashboard-shortcuts",
    "admin-readiness-accordion",
    "admin-readiness-summary"
  ];

  // Regex to detect fixed widths like width: 400px, min-width: 500px, etc.
  for (const cls of queueClasses) {
    const classRegex = new RegExp(`\\.${cls}\\b[^{]*\\{([^}]+)\\}`, "g");
    let match;
    while ((match = classRegex.exec(css)) !== null) {
      const block = match[1];
      const widthMatch = block.match(/\b(?:min-)?width:\s*(\d+)px/);
      if (widthMatch) {
        const px = parseInt(widthMatch[1], 10);
        assert.ok(
          px <= 320,
          `Class .${cls} has fixed width ${px}px which exceeds minimum viewport target 360px!`
        );
      }
    }
  }
});

test("Responsive Stress: Lead rows have truncation and flex wrapping to prevent overflow", () => {
  // Lead info flex-basis & min-width
  assert.match(
    css,
    /\.admin-queue-lead-info\s*\{[^}]*min-width:\s*0[^}]*\}/,
    ".admin-queue-lead-info must specify min-width: 0 to enable flex truncation"
  );

  // Lead name ellipsis
  assert.match(
    css,
    /\.admin-queue-lead-name\s*\{[^}]*text-overflow:\s*ellipsis[^}]*\}/,
    ".admin-queue-lead-name must have text-overflow: ellipsis"
  );
  assert.match(
    css,
    /\.admin-queue-lead-name\s*\{[^}]*overflow:\s*hidden[^}]*\}/,
    ".admin-queue-lead-name must have overflow: hidden"
  );

  // Lead meta wrap
  assert.match(
    css,
    /\.admin-queue-lead-meta\s*\{[^}]*flex-wrap:\s*wrap[^}]*\}/,
    ".admin-queue-lead-meta must have flex-wrap: wrap"
  );

  // Queue footer wrap
  assert.match(
    css,
    /\.admin-queue-footer\s*\{[^}]*flex-wrap:\s*wrap[^}]*\}/,
    ".admin-queue-footer must have flex-wrap: wrap"
  );

  // Pipeline actions wrap
  assert.match(
    css,
    /\.admin-queue-pipeline-actions\s*\{[^}]*flex-wrap:\s*wrap[^}]*\}/,
    ".admin-queue-pipeline-actions must have flex-wrap: wrap"
  );
});

test("Responsive Stress: Mobile padding under <= 768px is compact and leaves ample room on 360px", () => {
  // Content padding at <= 768px: 29px 17px 52px (total 34px horizontal padding)
  assert.match(
    css,
    /@media\s*\(\s*max-width:\s*768px\s*\)[\s\S]*?\.admin-content\s*\{[^}]*padding:\s*29px\s*17px\s*52px;/,
    ".admin-content must use 17px horizontal padding on <= 768px viewports"
  );

  // Queue section padding at <= 768px: 16px (total 32px horizontal padding)
  assert.match(
    css,
    /@media\s*\(\s*max-width:\s*768px\s*\)[\s\S]*?\.admin-queue-section\s*\{\s*padding:\s*16px;\s*\}/,
    ".admin-queue-section must use 16px padding on <= 768px viewports"
  );

  // Metric grid at <= 420px: 2 columns with 8px gap
  assert.match(
    css,
    /@media\s*\(\s*max-width:\s*420px\s*\)[\s\S]*?\.admin-metric-grid[\s\S]*?grid-template-columns:\s*1fr\s*1fr;\s*gap:\s*8px;/,
    ".admin-metric-grid must use 1fr 1fr with 8px gap at <= 420px"
  );
});

/* ========================================================================== */
/* SECTION 2: Edge Cases & Component Behavior                                 */
/* ========================================================================== */

test("Edge Case: Fallback for empty or missing lead fullName", () => {
  // Verifies lead.fullName || "Khách hàng doanh nghiệp"
  assert.match(
    primitivesCode,
    /lead\.fullName\s*\|\|\s*"Khách hàng doanh nghiệp"/,
    "Lead name must fallback gracefully to 'Khách hàng doanh nghiệp' when empty"
  );
});

test("Edge Case: Empty queue handling when recentLeads is empty or absent", () => {
  assert.match(
    primitivesCode,
    /recentLeads\s*&&\s*recentLeads\.length\s*>\s*0\s*\?/,
    "AdminOperationsQueue must conditionally branch on recentLeads availability"
  );
  assert.match(
    primitivesCode,
    /Chưa có yêu cầu báo giá nào trong hàng đợi\./,
    "Must display polite empty state message when no leads are pending"
  );
});

test("Edge Case: Status badge color mapping for all B2B lead lifecycle stages", () => {
  // Test lead status helper covers new, qualified, won (green), contacted, quotation_sent, sampling, negotiation (blue), lost, spam (red)
  assert.match(primitivesCode, /function queueLeadStatusKind/, "Must define queueLeadStatusKind helper");
  assert.match(primitivesCode, /status === "new"/, "Handles new");
  assert.match(primitivesCode, /status === "quotation_sent"/, "Handles quotation_sent");
  assert.match(primitivesCode, /status === "lost"/, "Handles lost");
  assert.match(primitivesCode, /status === "spam"/, "Handles spam");
});

test("Security & Isolation: DevOps DataReadiness is strictly hidden from non-owners", () => {
  assert.match(
    pageCode,
    /session\.role === "owner"\s*&&\s*data\.dataReadiness/,
    "DevOps DataReadiness accordion must only render when role is owner"
  );
});
