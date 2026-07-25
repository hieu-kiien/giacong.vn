import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("keeps the public site separate from Bagisto administration", () => {
  for (const directory of ["src/app/quan-tri", "src/app/api/quan-tri", "src/components/admin"]) {
    const target = path.join(root, directory);
    const files = existsSync(target)
      ? readdirSync(target, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
      : [];
    assert.equal(files.length, 0);
  }
});

test("does not render the captured commerce storefront or its checkout language", () => {
  const storefront = read("src/app/(storefront)/layout.tsx");
  const home = read("src/app/(storefront)/page.tsx");
  assert.doesNotMatch(storefront, /flatsome|woocommerce|giacong\.css|contact-form\.css/i);
  assert.doesNotMatch(home, /CapturedPage|Mua hàng|Thanh toán|hoàn tiền/i);
});
