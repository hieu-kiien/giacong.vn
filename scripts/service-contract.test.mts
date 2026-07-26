import assert from "node:assert/strict";
import test from "node:test";

import { serviceFamilies } from "../src/data/service-families.ts";

test("publishes only the approved drying service family", () => {
  assert.deepEqual(serviceFamilies.map((family) => family.slug), ["say-thuc-pham-say"]);
});
