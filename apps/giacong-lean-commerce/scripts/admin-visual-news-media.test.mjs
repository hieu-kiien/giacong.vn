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

test("contextual news action opens an owner-only editor and reuses the news write API", async () => {
  const source = await readSource("../src/components/admin/AdminNewsContextualAction.tsx");

  assert.match(source, /useAdminVisualContext/);
  assert.match(source, /owner/);
  assert.match(source, /const editableRoles = new Set\(\["owner"\]\)/);
  assert.match(source, /status\s*!==\s*["']ready["']/);
  assert.match(source, /AdminModal/);
  assert.match(source, /fetchAdmin/);
  assert.match(source, /mutateAdmin/);
  assert.match(source, /\/admin\/tin-tuc\?edit=/);
  assert.match(source, /AdminConfirmDialog/);
});

test("news listing exposes create and per-post edit hand-offs on the storefront", async () => {
  const [listing, publicData] = await Promise.all([
    readSource("../src/app/(storefront)/tin-tuc/page.tsx"),
    readSource("../src/lib/news-public.ts"),
  ]);

  assert.match(listing, /AdminNewsContextualAction/);
  assert.match(listing, /AdminNewsCreateContextualAction/);
  assert.match(listing, /label="Sửa bài viết"/);
  assert.match(listing, /newsId=\{post\.id\}/);
  assert.match(publicData, /SELECT id, published_slug AS slug/);
  assert.match(publicData, /id: row\.id/);
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
  assert.match(source, /searchParams\.get\(["']create["']\)/);
  assert.match(source, /applyNewsEditor\(\{ \.\.\.emptyForm \}\)/);
});

test("admin product deep links open the existing editor for create and edit", async () => {
  const [source, action] = await Promise.all([
    readSource("../src/app/admin/san-pham/page.tsx"),
    readSource("../src/components/admin/AdminCatalogContextualAction.tsx"),
  ]);

  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\.get\(["']create["']\)/);
  assert.match(source, /searchParams\.get\(["']edit["']\)/);
  assert.match(source, /\/api\/admin\/products\/\$\{id\}/);
  assert.match(source, /requestOpenEditor\(toProductForm\(result\.product\)\)/);
  assert.match(action, /\/admin\/san-pham\?edit=/);
  assert.match(action, /Sửa sản phẩm/);
});

test("admin service deep links open the existing editor for create and edit", async () => {
  const [source, action] = await Promise.all([
    readSource("../src/app/admin/dich-vu/page.tsx"),
    readSource("../src/components/admin/AdminServiceCreateContextualAction.tsx"),
  ]);

  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\.get\(["']create["']\)/);
  assert.match(source, /searchParams\.get\(["']edit["']\)/);
  assert.match(source, /\/api\/admin\/services\/\$\{id\}/);
  assert.match(source, /requestServiceEditor\(\{/);
  assert.match(action, /AdminModal/);
  assert.match(action, /mutateAdmin/);
  assert.match(action, /parseAdminServicePayload/);
  assert.match(action, /Thêm dịch vụ/);
});

test("product and service create shortcuts reuse inline forms and the canonical write APIs", async () => {
  const [product, service] = await Promise.all([
    readSource("../src/components/admin/AdminProductCreateContextualAction.tsx"),
    readSource("../src/components/admin/AdminServiceCreateContextualAction.tsx"),
  ]);

  assert.match(product, /AdminModal/);
  assert.match(product, /mutateAdmin/);
  assert.match(product, /parseAdminProductPayload/);
  assert.match(product, /\/api\/admin\/products/);
  assert.match(product, /useRegisterAdminUnsaved/);
  assert.doesNotMatch(product, /href="\/admin\/san-pham\?create=1"/);

  assert.match(service, /AdminModal/);
  assert.match(service, /mutateAdmin/);
  assert.match(service, /parseAdminServicePayload/);
  assert.match(service, /\/api\/admin\/services/);
  assert.match(service, /useRegisterAdminUnsaved/);
  assert.doesNotMatch(service, /href="\/admin\/dich-vu\?create=1"/);
});

test("buying and news entry points expose their next action", async () => {
  const [badge, navigation, listing, newsData, catalog] = await Promise.all([
    readSource("../src/components/storefront/RequestCartBadge.tsx"),
    readSource("../src/components/storefront/navigation.ts"),
    readSource("../src/app/(storefront)/tin-tuc/page.tsx"),
    readSource("../src/lib/news-public.ts"),
    readSource("../src/components/catalog/CatalogList.tsx"),
  ]);

  assert.match(badge, /href="\/gui-yeu-cau\/"/);
  assert.match(navigation, /request-cart entry is kept in the header badge/);
  assert.match(listing, /searchParams/);
  assert.match(listing, /name="s"/);
  assert.match(newsData, /published_content LIKE/);
  assert.match(catalog, /data-catalog-request-cart-link/);
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
