import test from "node:test";
import assert from "node:assert/strict";

import { assertMultipartSize, mediaPublicUrl } from "../src/lib/admin-media.ts";

test("product media uses only the canonical public namespace", () => {
  assert.equal(mediaPublicUrl("products/00000000-0000-0000-0000-000000000000.jpg"), "/media/products/00000000-0000-0000-0000-000000000000.jpg");
});

test("multipart payload is bounded above the 8 MiB file limit", () => {
  assert.doesNotThrow(() => assertMultipartSize(8 * 1024 * 1024 + 256 * 1024));
  assert.throws(() => assertMultipartSize(8 * 1024 * 1024 + 256 * 1024 + 1), /large/i);
});
