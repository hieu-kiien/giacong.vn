// Contract for `/san-pham/[slug]` — the product detail page.
//
// Two halves, matching what Node can and cannot import:
//  - the view model (`src/lib/product-detail-view.ts`) and the shared demo policy
//    (`src/lib/demo-catalog-policy.ts`) are exercised as modules;
//  - the `.tsx` components and the CSS module are asserted as source text, which is
//    how `scripts/commerce-foundation.test.mts` already covers presentation files.
//
// References: docs/research/components/product-detail.spec.md,
// docs/research/{BEHAVIORS,PAGE_TOPOLOGY,DESIGN_TOKENS}.md and
// docs/handoff-references/references/approved/preview-600/SCR-04-product-detail.webp.
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.join(import.meta.dirname, "..");

const detailView = await import("../src/lib/product-detail-view" + ".ts");
const demoPolicy = await import("../src/lib/demo-catalog-policy" + ".ts");
const demoCatalog = await import("../src/data/demo-catalog" + ".ts");

/** Forbidden V1 surfaces, as `scripts/commerce-foundation.test.mts` defines them. */
const FORBIDDEN_SURFACE_PATTERN =
  /\b(rating|review|favorite|wishlist|checkout|payment|shipping|thanh-toan|gio-hang|tai-khoan)\b/i;

/** Reference imagery carries stars and hearts; none of it may reach the implementation. */
const SOCIAL_PROOF_PATTERN = /\b(star|stars|heart|hearts|ratingCount|reviewCount)\b/i;

const DETAIL_SOURCES = [
  ["src", "components", "catalog", "ProductDetailPage.tsx"],
  ["src", "components", "catalog", "ProductGallery.tsx"],
  ["src", "components", "catalog", "ProductPurchasePanel.tsx"],
  ["src", "components", "catalog", "TierPriceTable.tsx"],
  ["src", "components", "catalog", "RelatedProductCard.tsx"],
  ["src", "components", "catalog", "product-detail.module.css"],
  ["src", "components", "site", "CapturedStorefrontTabFrame.tsx"],
  ["src", "components", "site", "CapturedStorefrontTabFrame.module.css"],
  ["src", "lib", "product-detail-view.ts"],
  ["src", "lib", "demo-catalog-policy.ts"],
  ["src", "lib", "catalog-detail-source.ts"],
  ["src", "data", "demo-product-gallery.ts"],
  ["src", "app", "(storefront)", "san-pham", "[slug]", "page.tsx"],
] as const;

function readSource(...segments: string[]): Promise<string> {
  return readFile(path.join(repoRoot, ...segments), "utf8");
}

async function exists(...segments: string[]): Promise<boolean> {
  try {
    await stat(path.join(repoRoot, ...segments));
    return true;
  } catch {
    return false;
  }
}

/** Multi-variant demo product: three bag sizes, three tier bands each. */
function multiVariantProduct() {
  const product = demoCatalog.findDemoCatalogProduct("bot-gao-lut-xay-min");
  assert.ok(product, "demo fixture must still expose bot-gao-lut-xay-min");
  return product;
}

/** Product carrying an unavailable variant, so unavailable states stay designable. */
function partlyUnavailableProduct() {
  const product = demoCatalog.findDemoCatalogProduct("nuoc-mam-cot-pha-loang");
  assert.ok(product, "demo fixture must still expose nuoc-mam-cot-pha-loang");
  return product;
}

function buildView(product: unknown, related: readonly unknown[] = []) {
  return detailView.buildProductDetailView({ product, related } as never);
}

// ---------------------------------------------------------------------------
// 1. View model: breadcrumb, identity, gallery
// ---------------------------------------------------------------------------

test("the view model builds a home → catalog → category → product breadcrumb", () => {
  const product = multiVariantProduct();
  const view = buildView(product);

  assert.deepEqual(view.breadcrumb.map((crumb: { label: string }) => crumb.label), [
    "Trang chủ",
    "Sản phẩm",
    "Bột và nguyên liệu khô",
    "Bột gạo lứt xay mịn",
  ]);
  assert.equal(view.breadcrumb[0].href, "/");
  assert.equal(view.breadcrumb[1].href, "/san-pham/");
  assert.equal(
    view.breadcrumb[2].href,
    "/san-pham/?category=bot-nguyen-lieu-kho",
    "the category crumb must return to the filtered catalog",
  );
  assert.equal(view.breadcrumb.at(-1).href, null, "the current product is not a link");
});

test("the view model carries the category, title, SKU and unit for the info column", () => {
  const product = multiVariantProduct();
  const view = buildView(product);

  assert.equal(view.name, "Bột gạo lứt xay mịn");
  assert.equal(view.categoryLabel, "Bột và nguyên liệu khô");
  assert.equal(view.sku, product.sku);
  assert.equal(view.slug, "bot-gao-lut-xay-min");
  assert.ok(view.description.length > 0, "detail must show the product description");
  assert.equal(view.unitLabel, "bao", "the unit comes from the variant, not from prose");
});

test("the view model keeps the catalog starting price for non-interactive contexts", () => {
  const view = buildView(multiVariantProduct());

  assert.match(view.priceLabel, /71\.000/, "starting price is the lowest available tier price");
  assert.match(view.priceLabel, /₫|VND/, "price is formatted as VND");
});

test("the purchase panel presents the unit price for the selected quantity, not the catalog starting price", async () => {
  const panel = await readSource("src", "components", "catalog", "ProductPurchasePanel.tsx");
  const shell = await readSource("src", "components", "catalog", "ProductDetailPage.tsx");

  assert.match(panel, /Đơn giá hiện tại/, "the current-price label must sit beside the active selection");
  assert.match(panel, /pricing\.unitPriceLabel/, "the displayed price must follow the selected variant and quantity tier");
  assert.doesNotMatch(shell, /view\.priceLabel/, "the static lowest price must not appear above an active selection");
});

test("availability is derived from the variants, never hard-coded", () => {
  const available = buildView(multiVariantProduct());
  assert.match(available.availabilityLabel, /có sẵn|còn hàng/i);
  assert.equal(available.isAvailable, true);

  const partly = buildView(partlyUnavailableProduct());
  assert.equal(partly.isAvailable, true, "one usable variant keeps the product orderable");

  const soldOut = buildView({
    ...partlyUnavailableProduct(),
    availableVariantCount: 0,
    variants: partlyUnavailableProduct().variants.map((variant: object) => ({ ...variant, isAvailable: false })),
  });
  assert.equal(soldOut.isAvailable, false);
  assert.match(soldOut.availabilityLabel, /hết hàng/i);
});

test("the gallery gives a thumbnail rail and never a gray placeholder", () => {
  const view = buildView(multiVariantProduct());

  assert.ok(view.gallery.length >= 3, "a thumbnail rail needs several images");
  for (const image of view.gallery) {
    assert.match(image.url, /^\/images\/products\/[a-z0-9-]+\.png$/, "gallery falls back to local demo packshots");
    assert.ok(image.alt.trim().length > 0, "every gallery image needs alt text");
  }
  assert.equal(
    new Set(view.gallery.map((image: { url: string }) => image.url)).size,
    view.gallery.length,
    "the rail must not repeat one image",
  );
});

test("a real product image leads the gallery when the catalog supplies one", () => {
  const product = { ...multiVariantProduct(), imageUrl: "https://cdn.example.test/bot-gao-lut.jpg" };
  const view = buildView(product);

  assert.equal(view.gallery[0].url, "https://cdn.example.test/bot-gao-lut.jpg");
  assert.ok(view.gallery.length >= 3, "demo packshots still fill the rail behind a real image");
});

// ---------------------------------------------------------------------------
// 2. View model: variants, tier prices, quantity
// ---------------------------------------------------------------------------

test("variant selection stays single-axis and keeps the catalog's option label", () => {
  const product = multiVariantProduct();
  const view = buildView(product);

  assert.equal(view.variantAxisLabel, "Quy cách");
  assert.deepEqual(
    view.variantChoices.map((choice: { label: string }) => choice.label),
    ["Bao 5 kg", "Bao 10 kg", "Bao 25 kg"],
  );
  for (const choice of view.variantChoices) {
    assert.equal(typeof choice.sku, "string");
    assert.equal(typeof choice.isAvailable, "boolean");
  }
});

test("an unavailable variant is offered but marked, never silently dropped", () => {
  const view = buildView(partlyUnavailableProduct());

  assert.equal(view.variantChoices.length, 2);
  const unavailable = view.variantChoices.find((choice: { isAvailable: boolean }) => !choice.isAvailable);
  assert.ok(unavailable, "the unavailable variant must still be visible");
  assert.equal(view.defaultVariantSku, view.variantChoices[0].sku, "selection defaults to a usable variant");
  assert.notEqual(view.defaultVariantSku, unavailable.sku);
});

test("each variant publishes MOQ, step and its tier bands with savings", () => {
  const view = buildView(multiVariantProduct());
  const variant = view.variants.find((item: { sku: string }) => item.sku.endsWith("BGL-05"));
  assert.ok(variant, "the 5 kg variant must be part of the view model");

  assert.equal(variant.minimumOrderQuantity, 25);
  assert.equal(variant.quantityStep, 5);
  assert.equal(variant.unit, "bao");

  const priced = variant.tierRows.filter((row: { price: number | null }) => row.price !== null);
  assert.deepEqual(priced.map((row: { minQuantity: number }) => row.minQuantity), [25, 100, 250]);
  assert.equal(priced[0].savingPercent, null, "the first band is the baseline, so it saves nothing");
  assert.equal(priced[1].savingPercent, 4, "74.500 against 78.000 is a 4% saving");
  assert.equal(priced[2].savingPercent, 9, "71.000 against 78.000 is a 9% saving");
  for (const row of priced) {
    assert.match(row.priceLabel, /₫|VND/, "tier prices are formatted VND");
  }
});

test("the tier table ends with the contact band instead of inventing a price", () => {
  const view = buildView(multiVariantProduct());
  const variant = view.variants[0];
  const last = variant.tierRows.at(-1);

  assert.equal(last.price, null, "the contact band carries no price");
  assert.equal(last.savingPercent, null);
  assert.match(last.priceLabel, /liên hệ/i);
  assert.equal(last.minQuantity, variant.contactFromQuantity);
});

test("tier savings use a positive benefit label", async () => {
  const table = await readSource("src", "components", "catalog", "TierPriceTable.tsx");

  assert.match(table, />Ưu đãi</, "the table must name the benefit, not a deduction");
  assert.match(table, /Giảm \{row\.savingPercent\}%/, "a saving must be written as a positive reduction");
  assert.doesNotMatch(table, /Tiết kiệm/, "the ambiguous savings heading must be removed");
});

test("quantity pricing clamps to MOQ, moves by step and switches to contact", () => {
  const view = buildView(multiVariantProduct());
  const variant = view.variants.find((item: { sku: string }) => item.sku.endsWith("BGL-05"));

  const atMoq = detailView.resolveQuantityPricing(variant, 25);
  assert.equal(atMoq.quantity, 25);
  assert.equal(atMoq.unitPrice, 78_000);
  assert.equal(atMoq.subtotal, 25 * 78_000);
  assert.equal(atMoq.needsContact, false);

  assert.equal(detailView.resolveQuantityPricing(variant, 1).quantity, 25, "below MOQ clamps up");
  assert.equal(detailView.resolveQuantityPricing(variant, 27).quantity, 30, "off-step rounds up to the step");
  assert.equal(detailView.resolveQuantityPricing(variant, Number.NaN).quantity, 25, "unparsable falls back to MOQ");

  const band = detailView.resolveQuantityPricing(variant, 100);
  assert.equal(band.unitPrice, 74_500, "the tier band applies at its minimum quantity");
  assert.equal(band.subtotal, 100 * 74_500);

  const contact = detailView.resolveQuantityPricing(variant, 500);
  assert.equal(contact.needsContact, true, "at the contact threshold no price is shown");
  assert.equal(contact.unitPrice, null);
  assert.equal(contact.subtotal, null);
  assert.match(contact.subtotalLabel, /liên hệ/i);
});

// ---------------------------------------------------------------------------
// 3. View model: actions and related products
// ---------------------------------------------------------------------------

test("the detail actions are add-to-request-cart plus the consultation request", () => {
  const view = buildView(multiVariantProduct());

  assert.equal(view.addToCartLabel, "Thêm vào giỏ yêu cầu");
  assert.equal(view.requestLabel, "Yêu cầu báo giá");
  assert.equal(view.requestHref, "/gui-yeu-cau/", "the secondary action continues to the only cart route");
  assert.doesNotMatch(JSON.stringify(view), /lien-he\/\?/, "detail no longer routes the CTA to the contact page");
});

test("the detail surface keeps production messaging and request actions unambiguous", async () => {
  const shell = await readSource("src", "components", "catalog", "ProductDetailPage.tsx");
  const panel = await readSource("src", "components", "catalog", "ProductPurchasePanel.tsx");
  const view = await readSource("src", "lib", "product-detail-view.ts");

  assert.match(shell, /Thông tin đặt hàng/, "the right rail describes ordering information");
  assert.match(view, /Danh mục/, "the right rail keeps category context");
  assert.doesNotMatch(shell, /Dữ liệu demo tạm thời|demoNotice/, "customer UI must not expose a demo banner");
  assert.match(panel, /view\.requestLabel/, "the direct request CTA is a quotation request");
  assert.doesNotMatch(panel, /Mua ngay/, "direct payment language is outside the request-only flow");
});

test("related products are compact cards with no social proof and no invented variant", () => {
  const product = multiVariantProduct();
  const related = demoCatalog.demoCatalogProductsByCategory("bot-nguyen-lieu-kho")
    .filter((item: { slug: string }) => item.slug !== product.slug);
  const view = buildView(product, related);

  assert.ok(view.relatedProducts.length >= 2, "the rail needs several related products");
  for (const card of view.relatedProducts) {
    assert.equal(card.detailHref, `/san-pham/${card.slug}/`);
    assert.notEqual(card.slug, product.slug, "a product is never related to itself");
    assert.match(card.priceLabel, /₫|VND/);
    assert.ok(card.imageUrl, "related cards fall back to a demo packshot rather than a gray box");
    assert.deepEqual(
      Object.keys(card).filter((key) => SOCIAL_PROOF_PATTERN.test(key)),
      [],
      "related cards carry no rating or favorite field",
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Demo fallback stays out of production
// ---------------------------------------------------------------------------

test("the demo detail fallback is refused in production", () => {
  assert.equal(demoPolicy.demoCatalogFallbackAllowed({ NODE_ENV: "production" }), false);
  assert.equal(demoPolicy.demoCatalogFallbackAllowed({ NODE_ENV: "development" }), true);
  assert.equal(demoPolicy.demoCatalogFallbackAllowed({ NODE_ENV: "test" }), true);
  assert.equal(
    demoPolicy.demoCatalogFallbackAllowed({ NODE_ENV: "production", CATALOG_DEMO_FALLBACK: "1" }),
    false,
    "no environment flag may re-enable demo data in production",
  );
});

test("the demo fallback is labelled so it can never read as production data", async () => {
  const source = await readSource("src", "lib", "catalog-detail-source.ts");

  assert.match(source, /demoCatalogFallbackAllowed/, "the source must consult the shared gate");
  assert.match(source, /isDemo/, "the loader must report whether it served demo data");
  const shell = await readSource("src", "components", "catalog", "ProductDetailPage.tsx");
  assert.doesNotMatch(shell, /Dữ liệu demo tạm thời|demoNotice/, "the production surface must not show a demo banner");
});

test("the Bagisto adapter stays unaware of the demo fixture", async () => {
  const adapter = await readSource("src", "lib", "bagisto-catalog.ts");
  assert.doesNotMatch(adapter, /demo-catalog|DEMO_CATALOG|catalog-detail-source/i);
});

// ---------------------------------------------------------------------------
// 5. Presentation: layout, gallery, tier table, targets
// ---------------------------------------------------------------------------

test("every detail source file exists", async () => {
  for (const segments of DETAIL_SOURCES) {
    assert.ok(await exists(...segments), `${segments.join("/")} must exist`);
  }
});

test("the detail page owns its stylesheet and leaves the catalog module alone", async () => {
  const shell = await readSource("src", "components", "catalog", "ProductDetailPage.tsx");

  assert.match(shell, /product-detail\.module\.css/, "detail must use its own stylesheet");
  assert.doesNotMatch(shell, /catalog\.module\.css/, "detail must not restyle through the shared catalog module");

  const page = await readSource("src", "app", "(storefront)", "san-pham", "[slug]", "page.tsx");
  assert.match(page, /ProductDetailPage/, "the route must render the new detail page");
  assert.doesNotMatch(page, /CatalogDetail\b/, "the route must no longer render the old detail shell");
});

test("the direct-detail frame keeps the captured header visible and content below it", async () => {
  const frame = await readSource("src", "components", "site", "CapturedStorefrontTabFrame.tsx");
  const css = await readSource("src", "components", "site", "CapturedStorefrontTabFrame.module.css");

  assert.match(frame, /CapturedStorefrontTabFrame\.module\.css/, "direct routes own their header correction");
  assert.match(frame, /className=\{styles\.detailMain\}/, "the correction is scoped to direct-route content");
  assert.match(frame, /data-storefront-detail-main/, "browser QA can locate the corrected detail frame");
  assert.match(css, /\.detailMain\s*\{[^}]*margin-top:\s*0\s*!important/, "captured negative page offset is neutralised");
  assert.match(css, /\.detailMain::before\s*\{[^}]*background:\s*#5aa400/, "the transparent captured header receives its green surface");
  assert.match(css, /\.detailMain::before\s*\{[^}]*height:\s*75px/, "the surface covers the measured desktop header");
  assert.doesNotMatch(css, /gradient/, "the header correction stays a flat brand surface");
});

test("desktop is two columns with the gallery left and commercial info right", async () => {
  const css = await readSource("src", "components", "catalog", "product-detail.module.css");

  assert.match(css, /\.hero\s*\{[^}]*display:\s*grid/, "the hero must be a grid");
  assert.match(
    css,
    /@media\s*\(min-width:\s*10\d\dpx\)[^@]*\.hero\s*\{[^}]*grid-template-columns/,
    "the two-column hero appears at desktop width",
  );
  assert.match(css, /\.gallery\b/, "the gallery column must be styled");
  assert.match(css, /\.commercial\b/, "the commercial column must be styled");
});

test("mobile stacks gallery above commercial info and keeps 44px targets", async () => {
  const css = await readSource("src", "components", "catalog", "product-detail.module.css");

  assert.match(
    css,
    /\.hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    "the mobile-first hero is a single column, so the gallery stacks above the info",
  );
  // One token drives every control, so a 44px target cannot be lost in one rule.
  assert.match(css, /--detail-target:\s*44px/, "the touch-target token must be the measured 44px");
  for (const control of ["thumb", "variantOption", "stepButton", "quantityInput", "primaryAction", "secondaryAction"]) {
    assert.match(
      css,
      new RegExp(`\\.${control}\\s*\\{[^}]*min-height:\\s*var\\(--detail-target\\)`),
      `.${control} must size itself from the 44px target token`,
    );
  }
  // Any pixel target written out by hand must still clear 44px.
  for (const [, value] of css.matchAll(/min-height:\s*(\d+)px/g)) {
    assert.ok(Number(value) >= 44, `every px target must clear 44px, found ${value}px`);
  }
});

test("the tier table reflows on mobile instead of scrolling horizontally", async () => {
  const css = await readSource("src", "components", "catalog", "product-detail.module.css");
  const table = await readSource("src", "components", "catalog", "TierPriceTable.tsx");

  assert.doesNotMatch(css, /overflow-x:\s*(auto|scroll)/, "the tier table must not scroll horizontally");
  assert.match(
    css,
    /@media\s*\(max-width:[^)]+\)[^@]*\.tierTable[^@]*display:\s*block/,
    "at mobile width the tier rows must reflow to stacked blocks",
  );
  assert.match(table, /<caption/, "the tier table needs an accessible caption");
  assert.match(table, /scope="col"/, "tier headers must be scoped");
  assert.match(table, /data-label=/, "reflowed rows must keep their column labels");
});

test("the gallery swaps the main image without layout shift", async () => {
  const gallery = await readSource("src", "components", "catalog", "ProductGallery.tsx");

  assert.match(gallery, /^"use client"/m, "thumbnail selection is client behaviour");
  assert.match(gallery, /aspect-ratio|aspectRatio|\.mainImage/, "the main image area must be size-reserved");
  assert.match(gallery, /aria-current|aria-pressed/, "the active thumbnail must be announced");
  assert.match(gallery, /alt=/, "gallery images need alt text");

  const css = await readSource("src", "components", "catalog", "product-detail.module.css");
  assert.match(css, /\.mainImage\s*\{[^}]*aspect-ratio/, "the main image reserves its box before load");
  assert.match(css, /\.thumbRail\b/, "the thumbnail rail must be a single styled row");
});

test("the purchase panel wires the CTA to the existing request cart", async () => {
  const panel = await readSource("src", "components", "catalog", "ProductPurchasePanel.tsx");

  assert.match(panel, /^"use client"/m);
  assert.match(panel, /request-cart-storage/, "the CTA must use the locked storage contract");
  assert.match(panel, /upsertRequestCartLine/, "adding a line goes through the storage contract");
  assert.match(panel, /writeRequestCart/);
  assert.match(panel, /view\.requestLabel/, "the selected variant can continue directly to a quotation request");
  assert.match(panel, /router\.push\("\/gui-yeu-cau\/"\)/, "buy now keeps the user on the one request route");
  assert.doesNotMatch(panel, /unitPrice:|subtotal:|price:/, "no price is ever written into the cart");
  assert.match(
    await readSource("src", "lib", "product-detail-view.ts"),
    /REQUEST_ROUTE = "\/gui-yeu-cau\/"/,
    "the request route is defined once, as the only cart route",
  );
  assert.match(panel, /aria-live/, "adding to the cart confirms in a non-colour-only way");
  assert.match(panel, /clampCommerceQuantity|resolveQuantityPricing/, "quantity reuses the shared rule");
});

test("no gradient, no social proof and no forbidden surface reaches the detail page", async () => {
  for (const segments of DETAIL_SOURCES) {
    const source = await readSource(...segments);
    const label = segments.join("/");

    assert.doesNotMatch(source, /linear-gradient|radial-gradient|conic-gradient|bg-gradient/i, `${label} must not use a gradient`);
    assert.doesNotMatch(source, SOCIAL_PROOF_PATTERN, `${label} must not carry stars, hearts or review counts`);
    assert.doesNotMatch(source, FORBIDDEN_SURFACE_PATTERN, `${label} must not name a forbidden V1 surface`);
  }
});

test("the reviewed runtime dependency baseline and reserved ports stay locked", async () => {
  const manifest = JSON.parse(await readSource("package.json")) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };

  assert.deepEqual(
    Object.keys(manifest.dependencies).sort(),
    [
      "@base-ui/react",
      "class-variance-authority",
      "clsx",
      "jose",
      "lucide-react",
      "next",
      "react",
      "react-dom",
      "shadcn",
      "tailwind-merge",
      "tw-animate-css",
    ],
    "runtime dependencies must stay on the reviewed allowlist",
  );
  assert.match(manifest.scripts["test:detail"] ?? "", /product-detail\.test\.mts/, "the detail suite must be runnable");

  for (const segments of DETAIL_SOURCES) {
    const source = await readSource(...segments);
    assert.doesNotMatch(source, /\b(?:127\.0\.0\.1|localhost):(?:3000|8000|8001)\b/, `${segments.join("/")} must not touch a reserved port`);
  }
});

test("editing a cart line reopens the product configurator and replaces that line", async () => {
  const route = await readSource("src", "app", "(storefront)", "san-pham", "[slug]", "page.tsx");
  const detail = await readSource("src", "components", "catalog", "ProductDetailPage.tsx");
  const panel = await readSource("src", "components", "catalog", "ProductPurchasePanel.tsx");

  assert.match(route, /editCart/, "The detail route must read the cart-edit marker.");
  assert.match(detail, /editingCartVariantSku/, "The product detail must carry the edit marker into the configurator.");
  assert.match(panel, /removeRequestCartLine/, "Updating a configured product must replace the old cart line instead of adding a duplicate.");
});
