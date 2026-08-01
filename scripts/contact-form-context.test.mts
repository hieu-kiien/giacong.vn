import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getContactServiceContext } from "../src/components/contact-form.ts";

test("keeps only the approved service context from a consultation link", () => {
  assert.equal(getContactServiceContext("?service=say-thuc-pham-say"), "say-thuc-pham-say");
  assert.equal(getContactServiceContext("?service=gia-cong-my-pham"), "");
  assert.equal(getContactServiceContext("?service=say-thuc-pham-say&service=other"), "say-thuc-pham-say");
});

test("adds a keyboard-inert honeypot field to each contact form", async () => {
  const source = await readFile(new URL("../src/components/contact-form.ts", import.meta.url), "utf8");

  assert.match(source, /input\.name = "website"/);
  assert.match(source, /input\.tabIndex = -1/);
  assert.match(source, /ensureContactHoneypot/);
});
