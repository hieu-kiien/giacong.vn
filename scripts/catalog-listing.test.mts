// Contract for `/san-pham` listing and the product card, against the approved
// references (`SCR-02-product-list`, `SCR-03-product-card`) and the specs in
// `docs/research/`. The pure listing module is exercised as a module; the `.tsx`
// surfaces Node cannot import are asserted as source text, matching
// `commerce-foundation.test.mts`.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.join(import.meta.dirname, "..");

const listing = await import("../src/components/catalog/catalog-listing" + ".ts");
const demoCatalog = await import("../src/data/demo-catalog" + ".ts");
const demoImages = await import("../src/data/demo-product-images" + ".ts");
const demoPolicy = await import("../src/lib/demo-catalog-policy" + ".ts");

const FORBIDDEN_SURFACE_PATTERN =
  /\b(rating|review|favorite|wishlist|checkout|payment|shipping|thanh-toan|gio-hang)\b/i;

function readSource(...segments: string[]): Promise<string> {
  return readFile(path.join(repoRoot, ...segments), "utf8");
}

const catalogSource = (file: string) => readSource("src", "components", "catalog", file);

// ---------------------------------------------------------------------------
// 1. Card view model: image fallback, anatomy fields, action resolution
// ---------------------------------------------------------------------------

test("the demo packshot fallbacks are the four local product assets", () => {
  const { DEMO_PRODUCT_IMAGES } = demoImages;

  assert.equal(DEMO_PRODUCT_IMAGES.length, 4, "all four approved demo packshots are used");
  for (const source of DEMO_PRODUCT_IMAGES) {
    assert.match(source, /^\/images\/products\/demo-[a-z-]+\.png$/, `${source} must be a local demo asset`);
  }
  assert.equal(new Set(DEMO_PRODUCT_IMAGES).size, 4, "each packshot appears once");
});

test("cards rotate through the demo packshots and never repeat inside one row", () => {
  const { DEMO_PRODUCT_IMAGES, demoProductImage } = demoImages;

  for (let index = 0; index < 12; index += 1) {
    assert.equal(demoProductImage(index), DEMO_PRODUCT_IMAGES[index % 4], `index ${index} rotates`);
  }
  // A four-column row must not show the same packshot twice.
  assert.equal(new Set([0, 1, 2, 3].map(demoProductImage)).size, 4);
});

test("a real catalog image wins over the demo fallback", () => {
  const [product] = listing.buildCatalogCards([{
    ...demoCatalog.DEMO_CATALOG_LIST[0],
    imageUrl: "https://cdn.example.test/anh-that.png",
  }]);

  assert.equal(product.imageUrl, "https://cdn.example.test/anh-that.png");
  assert.equal(product.fallbackImageUrl, demoImages.DEMO_PRODUCT_IMAGES[0], "the fallback stays available for onError");
});

test("every card carries the approved anatomy fields and no forbidden one", () => {
  const cards = listing.buildCatalogCards(demoCatalog.DEMO_CATALOG_PRODUCTS);

  assert.equal(cards.length, demoCatalog.DEMO_CATALOG_PRODUCTS.length);
  for (const card of cards) {
    assert.equal(typeof card.name, "string");
    assert.ok(card.name.length > 0);
    assert.equal(card.categoryName, card.categoryName?.trim());
    assert.ok(card.startingPrice > 0, `${card.slug} must carry a price`);
    assert.ok(card.specLabel.length > 0, `${card.slug} must state its quy cách`);
    assert.ok(card.availabilityLabel.length > 0, `${card.slug} must state availability`);
    assert.equal(card.detailHref, `/san-pham/${card.slug}/`);
    assert.deepEqual(
      Object.keys(card).filter((key) => FORBIDDEN_SURFACE_PATTERN.test(key)),
      [],
      `${card.slug} must not model a forbidden surface`,
    );
  }
});

test("a single usable variant becomes a direct add with MOQ, step and unit", () => {
  const product = demoCatalog.DEMO_CATALOG_PRODUCTS.find((item: { variants: unknown[] }) => item.variants.length === 1);
  assert.ok(product, "demo data must contain a single-variant product");
  const [card] = listing.buildCatalogCards([product]);
  const variant = product.variants[0];

  assert.equal(card.action.kind, "add-to-request-cart");
  assert.deepEqual(card.purchase, {
    contactFromQuantity: variant.contactFromQuantity,
    minimumOrderQuantity: variant.minimumOrderQuantity,
    quantityStep: variant.quantityStep,
    unit: variant.unit,
    variantSku: variant.sku,
  });
  assert.equal(card.unitLabel, variant.unit, "the price needs its gray unit");
});

test("several usable variants ask for the quy cách instead of inventing a SKU", () => {
  const product = demoCatalog.DEMO_CATALOG_PRODUCTS.find((item: { variants: unknown[] }) => item.variants.length > 1);
  assert.ok(product, "demo data must contain a multi-variant product");
  const [card] = listing.buildCatalogCards([product]);

  assert.equal(card.action.kind, "select-variant");
  assert.equal(card.action.label, "Chọn quy cách");
  assert.equal(card.purchase, null, "no stepper without a canonical variant");
  assert.doesNotMatch(JSON.stringify(card), /"variantSku"/, "a select-variant card must carry no variant key at all");
});

test("a list row without variant data cannot quick-add", () => {
  // The Bagisto list contract publishes no variants, so a card built from it must
  // route to detail rather than guess a SKU.
  const [card] = listing.buildCatalogCards([demoCatalog.DEMO_CATALOG_LIST[1]]);

  assert.equal(card.action.kind, "select-variant");
  assert.equal(card.purchase, null);
});

test("a product with no usable variant reports unavailable and offers no stepper", () => {
  const [card] = listing.buildCatalogCards([{
    ...demoCatalog.DEMO_CATALOG_PRODUCTS[1],
    availableVariantCount: 0,
    variants: demoCatalog.DEMO_CATALOG_PRODUCTS[1].variants.map((variant: object) => ({ ...variant, isAvailable: false })),
  }]);

  assert.equal(card.action.kind, "unavailable");
  assert.equal(card.purchase, null);
  assert.match(card.availabilityLabel, /hết hàng/i);
  assert.equal(card.isAvailable, false);
});

test("tier-price disclosure comes from the cheapest usable variant, never invented", () => {
  const product = demoCatalog.DEMO_CATALOG_PRODUCTS[0];
  const [card] = listing.buildCatalogCards([product]);
  const cheapest = product.variants
    .filter((variant: { isAvailable: boolean }) => variant.isAvailable)
    .reduce((best: { tierPrices: Array<{ price: number }> }, variant: { tierPrices: Array<{ price: number }> }) =>
      variant.tierPrices[0].price < best.tierPrices[0].price ? variant : best);

  assert.ok(card.tierPrices.length >= 2, "a tier band must be disclosed when the feed has one");
  assert.deepEqual(card.tierPrices, cheapest.tierPrices);
  assert.equal(card.contactFromQuantity, cheapest.contactFromQuantity);

  const [listCard] = listing.buildCatalogCards([demoCatalog.DEMO_CATALOG_LIST[0]]);
  assert.deepEqual(listCard.tierPrices, [], "no tier rows may be fabricated for a list-only row");
});

// ---------------------------------------------------------------------------
// 2. Demo fallback: filtered, sorted and paginated like the real feed, and
//    never served when the real feed works
// ---------------------------------------------------------------------------

const baseFilters = {
  category: "",
  direction: "asc" as const,
  page: 1,
  pageSize: 12 as const,
  query: "",
  sort: "name" as const,
};

test("the demo fallback answers the full filter contract", () => {
  const all = listing.demoCatalogList(baseFilters);

  assert.equal(all.products.length, demoCatalog.DEMO_CATALOG_PRODUCTS.length);
  assert.equal(all.pagination.total, demoCatalog.DEMO_CATALOG_PRODUCTS.length);
  assert.equal(all.pagination.currentPage, 1);
  assert.equal(all.pagination.perPage, 12);

  const searched = listing.demoCatalogList({ ...baseFilters, query: "  BỘT  " });
  assert.ok(searched.products.length > 0, "search must match case- and space-insensitively");
  for (const product of searched.products) {
    assert.match(`${product.name} ${product.shortDescription}`.toLowerCase(), /bột/);
  }

  const categorised = listing.demoCatalogList({ ...baseFilters, category: "bao-bi-dong-goi" });
  assert.ok(categorised.products.length > 0);
  for (const product of categorised.products) {
    assert.equal(product.category?.slug, "bao-bi-dong-goi");
  }

  assert.equal(listing.demoCatalogList({ ...baseFilters, query: "khong-ton-tai-gi-ca" }).products.length, 0);
});

test("the demo fallback sorts on every allowlisted column and direction", () => {
  const names = listing.demoCatalogList({ ...baseFilters, sort: "name" })
    .products.map((product: { name: string }) => product.name);
  assert.deepEqual(names, [...names].sort((left, right) => left.localeCompare(right, "vi")));

  const descending = listing.demoCatalogList({ ...baseFilters, direction: "desc", sort: "name" })
    .products.map((product: { name: string }) => product.name);
  assert.deepEqual(descending, [...names].reverse());

  const prices = listing.demoCatalogList({ ...baseFilters, sort: "starting_price" })
    .products.map((product: { startingPrice: { price: number } }) => product.startingPrice.price);
  assert.deepEqual(prices, [...prices].sort((left, right) => left - right));
});

test("the demo fallback paginates without dropping or duplicating a product", () => {
  const first = listing.demoCatalogList({ ...baseFilters, pageSize: 12, page: 1 });
  assert.equal(first.pagination.lastPage, 1);

  const page1 = listing.demoCatalogList({ ...baseFilters, page: 1, pageSize: 12 });
  const smallPages = [1, 2, 3].map((page) => listing.demoCatalogList({ ...baseFilters, page, pageSize: 12 }));
  assert.equal(smallPages[0].products.length, page1.products.length);

  // Page beyond the end stays inside the contract instead of throwing.
  const beyond = listing.demoCatalogList({ ...baseFilters, page: 999 });
  assert.equal(beyond.products.length, 0);
  assert.equal(beyond.pagination.total, demoCatalog.DEMO_CATALOG_PRODUCTS.length);
});

test("the demo fallback is refused in production and can be disabled outside it", () => {
  assert.equal(demoPolicy.demoCatalogFallbackAllowed({ NODE_ENV: "development" }), true);
  assert.equal(demoPolicy.demoCatalogFallbackAllowed({ NODE_ENV: "test" }), true);
  assert.equal(
    demoPolicy.demoCatalogFallbackAllowed({ NODE_ENV: "production" }),
    false,
    "a production build must show the error state rather than demo rows",
  );
  assert.equal(
    demoPolicy.demoCatalogFallbackAllowed({ CATALOG_DEMO_FALLBACK: "1", NODE_ENV: "production" }),
    false,
    "no flag may re-enable demo catalog data in production",
  );
  assert.equal(
    demoPolicy.demoCatalogFallbackAllowed({ CATALOG_DEMO_FALLBACK: "0", NODE_ENV: "development" }),
    false,
  );
});

test("the listing module names no forbidden V1 surface and adds no dependency", async () => {
  const source = await catalogSource("catalog-listing.ts");
  const imageSource = await readSource("src", "data", "demo-product-images.ts");

  assert.doesNotMatch(source, FORBIDDEN_SURFACE_PATTERN, "the listing module must not model a forbidden surface");
  assert.doesNotMatch(imageSource, FORBIDDEN_SURFACE_PATTERN, "the shared demo image source stays in the same guard");
  assert.doesNotMatch(source, /^import .*from ["'](?!\.|@\/)/m, "no new runtime dependency may be imported");
});

// ---------------------------------------------------------------------------
// 3. Listing page geometry, per SCR-02 and PAGE_TOPOLOGY §/san-pham
// ---------------------------------------------------------------------------

test("the trust row carries exactly the four approved benefits", () => {
  const { CATALOG_TRUST_BENEFITS } = listing;

  assert.equal(CATALOG_TRUST_BENEFITS.length, 4, "the heading row shows four trust benefits");
  for (const benefit of CATALOG_TRUST_BENEFITS) {
    assert.ok(benefit.label.length > 0);
    assert.doesNotMatch(benefit.label, FORBIDDEN_SURFACE_PATTERN, `${benefit.label} must not claim a forbidden surface`);
    assert.doesNotMatch(
      benefit.label,
      /giao hàng|vận chuyển|thanh toán|đổi trả/i,
      `${benefit.label} must not promise shipping or payment`,
    );
  }
});

test("the listing renders the approved page structure on an off-white page", async () => {
  const source = await catalogSource("CatalogList.tsx");

  assert.match(source, /bg-\[#f7f8f4\]/, "the catalog body sits on the off-white page surface");
  assert.match(source, /aria-label="Breadcrumb"/, "breadcrumb first");
  assert.match(source, /Trang chủ/, "breadcrumb links home");
  assert.match(source, /Danh sách sản phẩm/, "the approved H1");
  assert.match(source, /CATALOG_TRUST_BENEFITS/, "the trust row is data-driven, not hand-repeated");
  assert.match(source, /Tìm sản phẩm/, "the search label the QA flow drives");
  assert.match(source, /CatalogFilterDrawer/, "mobile filters live in the drawer");
  assert.match(source, /B2B|doanh nghiệp/, "the support strip closes the page");
  assert.doesNotMatch(source, /gradient|backdrop-blur/, "no gradient or glass treatment");
  assert.doesNotMatch(source, FORBIDDEN_SURFACE_PATTERN, "the listing must not render a forbidden surface");
});

test("the grid is 4/3/2/1 columns across the implementation viewports", async () => {
  const source = await catalogSource("CatalogList.tsx");

  assert.match(source, /data-catalog-grid/, "the QA hook stays on the grid");
  assert.match(
    source,
    /grid-cols-1 min-\[360px\]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/,
    "1 column at 320, 2 at 390/768, 3 at 1024, 4 at 1440",
  );
});

test("the desktop sidebar is the measured 230px rail", async () => {
  const source = await catalogSource("CatalogList.tsx");

  assert.match(source, /lg:grid-cols-\[230px_minmax\(0,1fr\)\]/, "230px sidebar beside the grid");
  assert.match(source, /aria-label="Bộ lọc sản phẩm"/, "the sidebar is a labelled complementary region");
  assert.match(source, /max-lg:hidden/, "below 1024 the sidebar gives way to the drawer");
});

test("loading, empty and error states keep the grid region intact", async () => {
  const source = await catalogSource("CatalogList.tsx");

  assert.match(source, /aria-busy=\{isPending\}/, "loading preserves the grid and announces itself");
  assert.match(source, /role="status"/, "the empty state is announced without removing the filters");
  assert.match(source, /Chưa tìm thấy sản phẩm phù hợp\./, "the empty copy the QA flow drives");
  assert.match(source, /data-catalog-skeleton/, "a skeleton holds the grid geometry while a filter commits");
});

test("every filter stays canonical URL state", async () => {
  const source = await catalogSource("CatalogList.tsx");

  assert.match(source, /catalogHref/, "URL is derived through the locked query contract");
  assert.match(source, /router\.push/, "filters commit by navigation, so the URL is shareable");
  assert.doesNotMatch(source, /useState<CatalogFilters>/, "filter state must not be duplicated in React state");
});

// ---------------------------------------------------------------------------
// 4. Product card, per SCR-03 and the ProductCard specification
// ---------------------------------------------------------------------------

test("the card is image-led, equal-height and carries the approved anatomy", async () => {
  const source = await catalogSource("CatalogProductCard.tsx");

  assert.match(source, /data-catalog-card/, "the QA hook stays on the card");
  assert.match(source, /flex h-full flex-col/, "cards keep equal heights within a row");
  assert.match(source, /commerce-card-surface/, "1px border, 10-12px radius and the subtle shadow");
  assert.match(source, /CatalogProductImage/, "the image leads the card");
  assert.match(source, /data-catalog-category-pill/, "the category pill sits inside the image");
  assert.match(source, /COMMERCE_TYPOGRAPHY\.price/, "the price uses the red price token");
  assert.match(source, /unitLabel/, "the price carries its gray unit");
  // `startingPrice` is the lowest price across usable variants, not the price at
  // MOQ, so the card must qualify it rather than present it as *the* price.
  assert.match(source, /Từ<\/span>/, "the floor price is labelled as a floor");
  assert.match(source, /specLabel/, "the specification line is rendered");
  assert.match(source, /availabilityLabel/, "availability is rendered");
  assert.match(source, /<details/, "tier prices are a progressive disclosure, not always-on noise");
  assert.match(source, /CatalogCardPurchase/, "the stepper and cart action are delegated to the client island");
  assert.match(source, /action\.label/, "a product needing a choice asks for the quy cách");
});

test("the card links to detail from both the image and the name, and nothing else", async () => {
  const source = await catalogSource("CatalogProductCard.tsx");

  assert.match(source, /detailHref/, "the card links to detail");
  assert.ok((source.match(/<Link\b/g) ?? []).length >= 2, "image and name both link to detail");
});

test("the card renders no rating, review, favorite or quick-add SKU", async () => {
  const source = await catalogSource("CatalogProductCard.tsx");

  assert.doesNotMatch(source, FORBIDDEN_SURFACE_PATTERN, "no forbidden surface on the card");
  assert.doesNotMatch(source, /\bStar\b|\bHeart\b/, "no star or heart iconography");
  assert.doesNotMatch(source, /gradient/, "no gradient treatment");
});

test("the card image holds a stable 1.25:1 ratio and falls back to a local packshot", async () => {
  const source = await catalogSource("CatalogProductImage.tsx");

  assert.match(source, /fallbackSrc/, "the card passes a local demo packshot as the fallback");
  assert.match(source, /onError/, "a broken upstream image degrades to the packshot instead of a gray box");
  assert.match(source, /aspect-\[5\/4\]|commerce-image-frame/, "the card image area is 1.25:1");
  assert.doesNotMatch(source, /gradient/, "no gradient placeholder");
});

test("the quantity stepper and cart action reuse the locked contracts", async () => {
  const source = await catalogSource("CatalogCardPurchase.tsx");

  assert.match(source, /"use client"/, "the stepper is the only interactive island on the card");
  assert.match(source, /clampCommerceQuantity|stepCommerceQuantity/, "quantity respects MOQ and step through the shared rule");
  assert.match(source, /upsertRequestCartLine/, "adding a line goes through the locked storage contract");
  assert.match(source, /writeRequestCart/, "the line is persisted through the locked contract");
  assert.match(source, /REQUEST_CART_STORAGE_KEY/, "the badge is notified on the contract's own key");
  assert.match(source, /StorageEvent/, "a same-tab add must still update the shared header badge");
  assert.match(source, /aria-live/, "the confirmation is announced, not colour-only");
  assert.match(source, /min-h-11|commerce-target/, "every target clears 44px");
  // An emptied number field leaves the state at 0, so the add path must clamp
  // rather than depend on the input's blur landing first.
  assert.match(
    source,
    /const requested = clampCommerceQuantity/,
    "the stored quantity is clamped at add time, not only on blur",
  );
  assert.match(source, /quantity: requested/, "the clamped value is what reaches storage");
  assert.doesNotMatch(source, /formatVnd/, "the card never computes money for the cart");
  assert.doesNotMatch(source, FORBIDDEN_SURFACE_PATTERN, "the island must not reach a forbidden surface");
});

// ---------------------------------------------------------------------------
// 5. Route wiring: real feed first, demo only as an isolated fallback
// ---------------------------------------------------------------------------

test("/san-pham prefers the real feed and falls back to demo data visibly", async () => {
  const source = await readSource("src", "app", "(commerce)", "san-pham", "page.tsx");

  assert.match(source, /getCatalogProducts/, "the real Bagisto feed is attempted first");
  assert.match(source, /demoCatalogFallbackAllowed/, "the fallback is gated, not automatic");
  assert.match(source, /demoCatalogList/, "the isolated demo fallback answers when Bagisto is down");
  assert.match(source, /buildCatalogCards/, "cards are built server-side from the locked view model");
  assert.match(source, /isDemoData/, "a demo-backed listing must say so in the UI");
  assert.doesNotMatch(source, FORBIDDEN_SURFACE_PATTERN, "the route must not wire a forbidden surface");
});

test("the listing suite runs from its own npm script and inside the check gate", async () => {
  const manifest = JSON.parse(await readSource("package.json")) as { scripts: Record<string, string> };

  assert.match(manifest.scripts["test:listing"] ?? "", /catalog-listing\.test\.mts/, "the suite has a runner");
  assert.match(manifest.scripts.check ?? "", /test:listing/, "and the check gate runs it");
});
