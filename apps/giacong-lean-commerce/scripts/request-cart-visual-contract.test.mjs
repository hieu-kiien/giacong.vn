import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(scriptDir, "..", "src", "components", "request-cart", "CapturedRequestCartButton.module.css");

test("quick-contact cart link stays inside the narrowed tablet rail", () => {
  const css = fs.readFileSync(cssPath, "utf8");

  assert.match(css, /@media\s*\(min-width:\s*550px\)\s*and\s*\(max-width:\s*1199px\)/);
  assert.match(css, /\.container\s*\{[\s\S]*?height:\s*38px;[\s\S]*?width:\s*38px;/);
  assert.match(css, /\.link\s*\{[\s\S]*?height:\s*100%;[\s\S]*?width:\s*100%;/);
});
