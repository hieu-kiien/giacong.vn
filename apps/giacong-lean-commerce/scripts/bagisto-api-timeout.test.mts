import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the server-only Bagisto boundary explicit and credential-free", async () => {
  const source = await readFile(new URL("../src/lib/bagisto-api.ts", import.meta.url), "utf8");
  assert.match(source, /^import "server-only";/);
  assert.match(source, /base\.username \|\| base\.password/);
  assert.match(source, /redirect: "error"/);
});

test("keeps timeout bounded and converts aborts into an explicit error", async () => {
  const source = await readFile(new URL("../src/lib/bagisto-api.ts", import.meta.url), "utf8");
  assert.match(source, /MAX_TIMEOUT_MS = 30_000/);
  assert.match(source, /controller\.signal\.aborted/);
  assert.match(source, /BagistoApiTimeoutError/);
});