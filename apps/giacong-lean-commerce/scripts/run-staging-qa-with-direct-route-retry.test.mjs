import assert from "node:assert/strict";
import test from "node:test";

const scriptUrl = new URL("./run-staging-qa-with-direct-route-retry.mjs", import.meta.url);

test("direct-route retry wrapper is bounded to transport-like HTTP failures", async () => {
  const source = await (await import("node:fs/promises")).readFile(scriptUrl, "utf8");

  assert.match(source, /const maxAttempts = directQa \? 3 : 1/);
  assert.match(source, /HTTP \(\?:404\|502\|503\|504\)/);
  assert.match(source, /retryable = directQa && retryableTransportStatus\.test\(result\.output\)/);
  assert.match(source, /attempt >= maxAttempts/);
  assert.match(source, /await delay\(3000\)/);
});
