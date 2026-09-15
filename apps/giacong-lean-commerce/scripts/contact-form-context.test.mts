import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getContactServiceContext } from "../src/components/contact-form.ts";

test("keeps only the approved service context from a consultation link", () => {
  assert.equal(getContactServiceContext("?service=say-thuc-pham-say"), "say-thuc-pham-say");
  assert.equal(getContactServiceContext("?service=gia-cong-my-pham"), "gia-cong-my-pham");
  assert.equal(getContactServiceContext("?service=does-not-exist"), "");
  assert.equal(getContactServiceContext("?service=say-thuc-pham-say&service=other"), "say-thuc-pham-say");
});

test("generic contact forms keep one request id across retries and clear it after success", async () => {
  const source = await readFile(new URL("../src/components/contact-form.ts", import.meta.url), "utf8");

  assert.match(source, /form\.dataset\.requestId/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /payload\.set\("request_id"/);
  assert.match(source, /delete form\.dataset\.requestId/);
});
