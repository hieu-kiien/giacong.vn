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

test("admin access and loading states keep presentation in CSS", async () => {
  const [shell, styles, layout] = await Promise.all([
    readFile(new URL("../src/components/admin/AdminShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/admin-access.css", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/layout.tsx", import.meta.url), "utf8"),
  ]);
  const accessStates = shell.slice(shell.indexOf("function AdminLoadingScreen"));

  assert.doesNotMatch(accessStates, /style=\{\{/);
  assert.match(accessStates, /admin-access-card--auth/);
  assert.match(accessStates, /admin-access-title/);
  assert.match(accessStates, /admin-access-detail__summary/);
  assert.match(accessStates, /admin-access-detail__body/);
  assert.match(accessStates, /admin-access-skeleton--brand/);
  assert.match(accessStates, /admin-access-skeleton--title/);
  assert.match(accessStates, /admin-access-skeleton--line-wide/);
  assert.match(accessStates, /admin-access-skeleton--line-short/);

  assert.match(styles, /\.admin-access-card--auth\s*\{[\s\S]*?max-width:\s*500px/);
  assert.match(styles, /\.admin-access-card \.admin-access-title\s*\{[\s\S]*?font-size:\s*30px[\s\S]*?font-weight:\s*700/);
  assert.match(styles, /\.admin-access-detail__summary\s*\{/);
  assert.match(styles, /\.admin-access-skeleton--brand\s*\{/);
  assert.match(layout, /import "\.\.\/\.\.\/styles\/admin-access\.css";/);
});
