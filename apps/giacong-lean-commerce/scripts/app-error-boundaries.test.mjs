import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("route error boundary recovers child layouts and pages without exposing internals", async () => {
  const source = await readFile(new URL("../src/app/error.tsx", import.meta.url), "utf8");

  assert.match(source, /^"use client";/);
  assert.match(source, /role="alert"/);
  assert.match(source, /onClick=\{reset\}/);
  assert.match(source, /href="\/"/);
  assert.match(source, /error\.digest/);
  assert.doesNotMatch(source, /error\.message/);
  assert.match(source, /console\.error/);
});

test("global error boundary replaces the failed root layout with a standalone accessible document", async () => {
  const source = await readFile(new URL("../src/app/global-error.tsx", import.meta.url), "utf8");

  assert.match(source, /^"use client";/);
  assert.match(source, /<html\s+lang="vi"/);
  assert.match(source, /<body/);
  assert.match(source, /role="alert"/);
  assert.match(source, /onClick=\{reset\}/);
  assert.match(source, /error\.digest/);
  assert.doesNotMatch(source, /error\.message/);
  assert.match(source, /console\.error/);
});
