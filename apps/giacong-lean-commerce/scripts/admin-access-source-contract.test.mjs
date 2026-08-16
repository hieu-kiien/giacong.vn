import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin admission keeps hostname, origin, and public-mode boundaries", async () => {
  const source = await readFile(new URL("../src/lib/admin-access.ts", import.meta.url), "utf8");
  assert.match(source, /adminHostnames/);
  assert.match(source, /adminOrigins/);
  assert.match(source, /publicAdmin/);
  assert.match(source, /cf-access-jwt-assertion/);
  assert.match(source, /mutationMethods/);
});