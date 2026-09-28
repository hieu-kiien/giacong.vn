import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./app-error-boundaries.test.mjs";

test("admin uncaught render failures show an announced fallback, retry, dashboard link, and safe error digest", async () => {
  const source = await readFile(new URL("../src/app/admin/error.tsx", import.meta.url), "utf8");

  assert.match(source, /^"use client";/);
  assert.match(source, /role="alert"/);
  assert.match(source, /onClick=\{reset\}/);
  assert.match(source, /href="\/admin"/);
  assert.match(source, /error\.digest/);
  assert.doesNotMatch(source, /error\.message/);
  assert.match(source, /console\.error/);
  assert.doesNotMatch(source, /<main\b/, "the AdminShell already owns the page main landmark");
});
