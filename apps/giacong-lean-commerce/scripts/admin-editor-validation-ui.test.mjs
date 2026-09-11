import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product and news editors validate locally before mutating", async () => {
  const [product, news] = await Promise.all([
    readFile(new URL("../src/app/admin/san-pham/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/tin-tuc/page.tsx", import.meta.url), "utf8"),
  ]);
  const productSubmit = product.slice(product.indexOf("async function submitProduct"), product.indexOf("async function archiveProduct"));
  const newsSubmit = news.slice(news.indexOf("async function submitPost"), news.indexOf("async function confirmDelete"));

  assert.match(product, /parseAdminProductPayload/);
  assert.match(productSubmit, /if \(!parsed\.input\)/);
  assert.match(product, /product-form-field-errors/);
  assert.match(news, /parseAdminNewsPayload/);
  assert.match(newsSubmit, /if \(!parsed\.input\)/);
  assert.match(newsSubmit, /setFieldErrors\(parsed\.fieldErrors\)/);
  assert.ok(productSubmit.indexOf("if (!parsed.input)") < productSubmit.indexOf("mutateAdmin"));
  assert.ok(newsSubmit.indexOf("if (!parsed.input)") < newsSubmit.indexOf("mutateAdmin"));
  assert.match(product, /<form noValidate onSubmit=\{onSubmit\}>/);
  assert.match(news, /<form noValidate onSubmit=\{submitPost\}>/);
});
