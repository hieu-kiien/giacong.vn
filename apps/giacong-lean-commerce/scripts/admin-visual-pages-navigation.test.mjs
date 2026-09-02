import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("published managed pages expose a contextual edit hand-off", async () => {
  const [blocks, route, home, action] = await Promise.all([
    readSource("../src/components/site/PageBlocks.tsx"),
    readSource("../src/app/(storefront)/[...slug]/page.tsx"),
    readSource("../src/app/(storefront)/page.tsx"),
    readSource("../src/components/admin/AdminPageContextualAction.tsx"),
  ]);

  assert.match(blocks, /pageKey\?: string/);
  assert.match(blocks, /AdminPageContextualAction/);
  assert.match(blocks, /pageKey=\{pageKey\}/);
  assert.match(route, /pageKey=\{managedPage\.pageKey\}/);
  assert.match(home, /pageKey=\{managedPage\.pageKey\}/);
  assert.match(action, /\/admin\/thiet-ke\?page=/);
  assert.match(action, /encodeURIComponent\(pageKey\)/);
});

test("page contextual action is host-gated by the shared visual context and role", async () => {
  const action = await readSource("../src/components/admin/AdminPageContextualAction.tsx");

  assert.match(action, /useAdminVisualContext/);
  assert.match(action, /status\s*!==\s*["']ready["']/);
  assert.match(action, /owner/);
  assert.match(action, /content_manager/);
  assert.doesNotMatch(action, /fetchAdmin|\/api\/admin\/session/);
});

test("admin page builder honors a safe page deep-link through the canonical page API", async () => {
  const source = await readSource("../src/components/admin/AdminPageBuilder.tsx");

  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\.get\(["']page["']\)/);
  assert.match(source, /page\.pageKey === requestedPage/);
  assert.match(source, /fetchAdmin<PagesResponse>\(["']\/api\/admin\/pages["']\)/);
  assert.doesNotMatch(source, /api\/admin\/visual/);
});

test("admin page builder keeps request IDs stable across retriable writes and locks duplicate submits", async () => {
  const source = await readSource("../src/components/admin/AdminPageBuilder.tsx");

  assert.match(source, /getPageRequestId/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /requestId \}/);
  assert.match(source, /saveInFlight\.current/);
  assert.match(source, /publishInFlight\.current/);
  assert.match(source, /createInFlight\.current/);
  assert.match(source, /status === 0 \|\| reason\.status >= 500/);
});

test("managed page contextual control stays out of captured fallback paths", async () => {
  const source = await readSource("../src/app/(storefront)/[...slug]/page.tsx");

  assert.match(source, /if \(managedPage\?\.blocks\.length\)/);
  assert.match(source, /<PageBlocks blocks=\{managedPage\.blocks\} pageKey=\{managedPage\.pageKey\} \/>/);
  assert.match(source, /const data = await readCapturedPath\(routePath\)/);
  assert.match(source, /return <CapturedPage/);
});

test("page contextual action has keyboard and responsive affordances", async () => {
  const styles = await readSource("../src/components/admin/AdminNewsContextualAction.module.css");

  assert.match(styles, /max-width/);
  assert.match(styles, /@media/);
  assert.match(styles, /focus-visible/);
});
