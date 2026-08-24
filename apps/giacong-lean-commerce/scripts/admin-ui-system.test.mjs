import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(...segments) {
  return readFile(new URL(`../src/${segments.join("/")}`, import.meta.url), "utf8");
}

test("the toast system renders a live region and auto-dismisses without alert()", async () => {
  const source = await readSource("components", "admin", "AdminToast.tsx");

  assert.match(source, /aria-live="polite"/);
  assert.doesNotMatch(source, /\balert\(/, "admin feedback must not use window.alert");
  assert.match(source, /AUTO_DISMISS_MS/);
  assert.match(source, /export function useAdminToast/);
  assert.match(source, /export function AdminToastProvider/);
});

test("destructive actions route through the confirm dialog, never window.confirm", async () => {
  const dialog = await readSource("components", "admin", "AdminDialog.tsx");

  assert.match(dialog, /export function AdminModal/);
  assert.match(dialog, /export function AdminConfirmDialog/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /Escape/);
  assert.doesNotMatch(dialog, /window\.confirm/);
});

test("form fields keep label, hint and error wiring consistent", async () => {
  const field = await readSource("components", "admin", "AdminField.tsx");

  assert.match(field, /htmlFor=\{id\}/);
  assert.match(field, /role="alert"/);
});

test("the shell mounts the toast provider so every admin page shares feedback", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(shell, /AdminToastProvider/);
});
