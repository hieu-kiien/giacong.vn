import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(scriptDir, "..", "src", "components", "request-cart", "CapturedRequestCartButton.module.css");
const desktopLoaderPath = path.join(scriptDir, "..", "src", "components", "request-cart", "DesktopCapturedRequestCartButton.tsx");
const capturedPagePath = path.join(scriptDir, "..", "src", "components", "CapturedPage.tsx");

test("quick-contact cart link stays inside the narrowed tablet rail", () => {
  const css = fs.readFileSync(cssPath, "utf8");

  assert.match(css, /@media\s*\(min-width:\s*550px\)\s*and\s*\(max-width:\s*1199px\)/);
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
