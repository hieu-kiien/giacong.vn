import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(scriptDir, "..", "src", "components", "request-cart", "CapturedRequestCartButton.module.css");
const desktopLoaderPath = path.join(scriptDir, "..", "src", "components", "request-cart", "DesktopCapturedRequestCartButton.tsx");
const capturedPagePath = path.join(scriptDir, "..", "src", "components", "CapturedPage.tsx");

test("quick-contact cart link stays inside the narrowed rail through medium desktop widths", () => {
  const css = fs.readFileSync(cssPath, "utf8");

  assert.match(css, /@media\s*\(min-width:\s*550px\)\s*and\s*\(max-width:\s*1399px\)/);
  const globalCss = fs.readFileSync(path.join(scriptDir, "..", "src", "app", "globals.css"), "utf8");
  assert.match(globalCss, /@media\s*\(min-width:\s*550px\)\s*and\s*\(max-width:\s*1399px\)/);
  assert.match(css, /\.container\s*\{[\s\S]*?height:\s*38px;[\s\S]*?width:\s*38px;/);
  assert.match(css, /\.link\s*\{[\s\S]*?height:\s*100%;[\s\S]*?width:\s*100%;/);
});


test("mobile does not eagerly load the hidden floating request cart", () => {
  const loader = fs.readFileSync(desktopLoaderPath, "utf8");
  const capturedPage = fs.readFileSync(capturedPagePath, "utf8");

  assert.match(loader, /matchMedia\("\(min-width: 550px\)"\)/);
  assert.match(loader, /lazy\(async \(\) =>/);
  assert.match(loader, /import\("\.\/CapturedRequestCartButton"\)/);
  assert.match(capturedPage, /DesktopCapturedRequestCartButton/);
  assert.doesNotMatch(capturedPage, /import \{ CapturedRequestCartButton \}/);
});

test("request-cart warnings do not expose internal variant codes", () => {
  const view = fs.readFileSync(path.join(scriptDir, "..", "src", "components", "request-cart", "RequestCartView.tsx"), "utf8");

  assert.doesNotMatch(view, /SKU \$\{line\.variantSku\}/);
  assert.match(view, /const label = line\.productName \|\| "Sản phẩm";/);
  assert.match(view, /aria-label="Xóa sản phẩm không còn tồn tại khỏi giỏ yêu cầu"/);
  assert.match(view, /Gỡ khỏi giỏ/);
});

test("missing products use one clear warning and do not look like quote-only items", () => {
  const view = fs.readFileSync(path.join(scriptDir, "..", "src", "components", "request-cart", "RequestCartView.tsx"), "utf8");

  assert.match(view, /line\.productName && blocking\.length > 0/);
  assert.match(view, /const hasPriceOnRequestLines = cart\.lines\.some\(\(line\) => Boolean\(line\.productName\) && line\.priceOnRequest\);/);
  assert.match(view, /hasPriceOnRequestLines \? "Liên hệ báo giá" : "Chưa thể tính"/);
});
