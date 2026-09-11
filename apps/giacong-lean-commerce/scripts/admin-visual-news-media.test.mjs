import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("news detail exposes the published post id to the contextual admin action", async () => {
  const [source, publicData] = await Promise.all([
    readSource("../src/app/(storefront)/tin-tuc/[slug]/page.tsx"),
    readSource("../src/lib/news-public.ts"),
  ]);

  assert.match(source, /AdminNewsContextualAction/);
  assert.match(source, /newsId=\{post\.id\}/);
  assert.match(publicData, /export interface PublicNewsPost[\s\S]*id: number/);
  assert.match(publicData, /SELECT id, published_slug AS slug/);
  assert.match(publicData, /id: row\.id/);
  assert.doesNotMatch(source, /draft_/);
});

test("contextual news action consumes AdminVisualMode context and only allows content managers", async () => {
  const source = await readSource("../src/components/admin/AdminNewsContextualAction.tsx");

  assert.match(source, /useAdminVisualContext/);
  assert.match(source, /owner/);
  assert.match(source, /const editableRoles = new Set\(\["owner"\]\)/);
  assert.match(source, /status\s*!==\s*["']ready["']/);
  assert.match(source, /\/admin\/tin-tuc\?edit=/);
  assert.doesNotMatch(source, /fetchAdmin|\/api\/admin\/session/);
});

test("admin visual mode provides session state without adding a public session fetch", async () => {
  const mode = await readSource("../src/components/admin/AdminVisualMode.tsx");
  const layout = await readSource("../src/app/(storefront)/layout.tsx");

  assert.match(mode, /createContext/);
  assert.match(mode, /AdminVisualContext\.Provider/);
  assert.match(mode, /value=\{\{[^}]*session[^}]*status/s);
  assert.match(layout, /isAdminHost\s*\?/);
  assert.match(layout, /<AdminVisualMode>/);
});

test("admin news deep link opens a canonical post and ignores invalid edit ids safely", async () => {
  const source = await readSource("../src/app/admin/tin-tuc/page.tsx");

  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\.get\(["']edit["']\)/);
  assert.match(source, /\/api\/admin\/news\/\$\{[^}]*\}/);
  assert.match(source, /Number\.isSafeInteger/);
  assert.match(source, /Không thể tải bài viết được yêu cầu/);
});

test("contextual action has a bounded responsive style", async () => {
  const styles = await readSource("../src/components/admin/AdminNewsContextualAction.module.css");

  assert.match(styles, /max-width/);
  assert.match(styles, /@media/);
  assert.match(styles, /focus-visible/);
});

test("single news publication locks duplicate submits while the request is active", async () => {
  const source = await readSource("../src/app/admin/tin-tuc/page.tsx");

  assert.match(source, /const publicationInFlight = useRef\(false\)/);
  assert.match(source, /if \(publicationInFlight\.current \|\| newsBatchInFlight\.current\) return;/);
  assert.match(source, /publicationInFlight\.current = true/);
  assert.match(source, /publicationInFlight\.current = false/);
  assert.match(source, /disabled=\{publicationId !== null \|\| batchAction !== null\}/);
});

test("news batch publication shares the single-publication in-flight lock", async () => {
  const source = await readSource("../src/app/admin/tin-tuc/page.tsx");

  assert.match(source, /selectedPosts\.length === 0 \|\| publicationInFlight\.current \|\| newsBatchInFlight\.current/);
  assert.match(source, /data-testid="button-news-batch-publish" disabled=\{publicationId !== null \|\| batchAction !== null\}/);
  assert.match(source, /data-testid="button-news-batch-unpublish" disabled=\{publicationId !== null \|\| batchAction !== null\}/);
});
