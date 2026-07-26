import assert from "node:assert/strict";
import test from "node:test";

import { getContactServiceContext } from "../src/components/contact-form.ts";

test("keeps only the approved service context from a consultation link", () => {
  assert.equal(getContactServiceContext("?service=say-thuc-pham-say"), "say-thuc-pham-say");
  assert.equal(getContactServiceContext("?service=gia-cong-my-pham"), "");
  assert.equal(getContactServiceContext("?service=say-thuc-pham-say&service=other"), "say-thuc-pham-say");
});
