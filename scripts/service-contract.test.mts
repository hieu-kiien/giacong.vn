import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { serviceFamilies } from "../src/data/service-families.ts";

test("publishes only the approved drying service family", () => {
  assert.deepEqual(serviceFamilies.map((family) => family.slug), ["say-thuc-pham-say"]);
});

test("service calls to action carry the canonical service context", async () => {
  const source = await readFile(new URL("../src/components/services/ServiceLanding.tsx", import.meta.url), "utf8");
  const directory = await readFile(new URL("../src/components/services/ServiceDirectory.tsx", import.meta.url), "utf8");

  assert.match(source, /\/lien-he\/\?service=say-thuc-pham-say/);
  assert.match(directory, /href="\/lien-he\/\?service=say-thuc-pham-say"/);
});
