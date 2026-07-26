// Foundation contract for the commerce UI: route/CSS isolation, shared design
// primitives, demo catalog data and the shell/menu/card/detail/request-cart
// contracts. Source text is asserted for the pieces Node cannot import (`.tsx`
// and CSS); everything else is exercised as a module.
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.join(import.meta.dirname, "..");
const appDir = path.join(repoRoot, "src", "app");
const commerceGroupDir = path.join(appDir, "(commerce)");
const storefrontGroupDir = path.join(appDir, "(storefront)");
const commerceComponentsDir = path.join(repoRoot, "src", "components", "commerce");

const commerceUi = await import("../src/lib/commerce-ui" + ".ts");
const commerceTokens = await import("../src/components/commerce/tokens" + ".ts");
const commerceTypography = await import("../src/components/commerce/typography" + ".ts");
const demoCatalog = await import("../src/data/demo-catalog" + ".ts");

const FORBIDDEN_SURFACE_PATTERN =
  /\b(rating|review|favorite|wishlist|checkout|payment|shipping|thanh-toan|gio-hang)\b/i;

function readSource(...segments: string[]): Promise<string> {
  return readFile(path.join(repoRoot, ...segments), "utf8");
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:tsx?|css)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

// ---------------------------------------------------------------------------
// 1. Commerce routes are isolated from the captured Flatsome cascade and footer
// ---------------------------------------------------------------------------

test("commerce routes live in their own route group with a clean layout", async () => {
  assert.ok(await exists(commerceGroupDir), "src/app/(commerce) must exist");

  for (const route of [
    path.join("san-pham", "page.tsx"),
    path.join("san-pham", "[slug]", "page.tsx"),
    path.join("san-pham", "[...path]", "page.tsx"),
    path.join("san-pham", "error.tsx"),
    path.join("san-pham", "not-found.tsx"),
    path.join("gui-yeu-cau", "page.tsx"),
  ]) {
    assert.ok(
      await exists(path.join(commerceGroupDir, route)),
      `${route} must be served from the (commerce) group`,
    );
    assert.equal(
      await exists(path.join(storefrontGroupDir, route)),
      false,
      `${route} must no longer be served from the captured (storefront) group`,
    );
  }

  assert.ok(
    await exists(path.join(commerceGroupDir, "layout.tsx")),
    "(commerce) must own a layout so commerce routes stop inheriting captured chrome",
  );
});

test("the commerce layout imports no captured stylesheet and renders no captured footer", async () => {
  const layout = await readSource("src", "app", "(commerce)", "layout.tsx");

  // Import specifiers only. The layout's own doc comment explains what it is
  // detached from and names those files; that prose is the point, not a violation.
  assert.doesNotMatch(
    layout,
    /import\s+["'][^"']*(?:captured-layers|public\/styles\/|flatsome|woocommerce)/i,
    "commerce layout must not import the captured cascade",
  );
  assert.doesNotMatch(layout, /CatalogChrome|catalog-chrome/, "commerce layout must not reuse the captured chrome");
  assert.doesNotMatch(layout, /footerMarkup|<footer/i, "commerce routes must not render the captured footer");
  assert.match(layout, /CommerceShell/, "commerce layout must mount the clean commerce shell");
});

test("captured stylesheets stay confined to the captured route group", async () => {
  // Matches an actual import specifier, not prose: `globals.css` and this suite both
  // discuss the captured cascade in comments without pulling any of it in.
  const capturedImport = /@?import\s+["'][^"']*(?:captured-layers|public\/styles\/)/;
  const capturedImporters: string[] = [];
  for (const file of await sourceFiles(appDir)) {
    const source = await readFile(file, "utf8");
    if (capturedImport.test(source)) {
      capturedImporters.push(path.relative(repoRoot, file).replaceAll("\\", "/"));
    }
  }

  assert.deepEqual(
    capturedImporters.sort(),
    ["src/app/(storefront)/captured-layers.css", "src/app/(storefront)/layout.tsx"],
    "only the captured route group may pull in captured stylesheets",
  );
});

test("no commerce source reaches for the captured footer or global captured CSS", async () => {
  for (const file of [...await sourceFiles(commerceGroupDir), ...await sourceFiles(commerceComponentsDir)]) {
    const source = await readFile(file, "utf8");
    const label = path.relative(repoRoot, file).replaceAll("\\", "/");
    assert.doesNotMatch(source, /ContentFooterSections|footerMarkup/, `${label} must not render captured footer markup`);
    assert.doesNotMatch(source, /flatsome|woocommerce|wpcf7/i, `${label} must not depend on captured CSS`);
    assert.doesNotMatch(source, /screen-reader-text|skip-link/, `${label} must not rely on captured utility classes`);
  }
});

// ---------------------------------------------------------------------------
// 2. Shared tokens, typography, container and icon primitives
// ---------------------------------------------------------------------------

test("design tokens carry the measured commerce geometry", () => {
  const { COMMERCE_GEOMETRY } = commerceTokens;

  assert.equal(COMMERCE_GEOMETRY.headerHeightDesktop, 65);
  assert.equal(COMMERCE_GEOMETRY.railMaxWidth, 1390);
  assert.equal(COMMERCE_GEOMETRY.minimumTouchTarget, 44);
  assert.equal(COMMERCE_GEOMETRY.productImageAspectRatio, "5 / 4");
  assert.deepEqual(COMMERCE_GEOMETRY.railPadding, { desktop: 24, mobile: 12, tablet: 16 });
});

test("commerce colour tokens match the approved specification", () => {
  const { COMMERCE_COLORS } = commerceTokens;

  assert.equal(COMMERCE_COLORS.brand, "#2f9e0b");
  assert.equal(COMMERCE_COLORS.brandDark, "#237a08");
  assert.equal(COMMERCE_COLORS.activeSurface, "#f1f8ec");
  assert.equal(COMMERCE_COLORS.supportStrip, "#f4faea");
  assert.equal(COMMERCE_COLORS.price, "#ef1726");
  assert.equal(COMMERCE_COLORS.body, "#191919");
  assert.equal(COMMERCE_COLORS.secondary, "#6f7177");
  assert.equal(COMMERCE_COLORS.border, "#dfe3df");
});

test("the CSS foundation publishes those tokens as Tailwind theme variables", async () => {
  const css = await readSource("src", "styles", "commerce-foundation.css");
  const { COMMERCE_COLORS } = commerceTokens;

  assert.match(css, /@theme\b/, "commerce tokens must register in the Tailwind theme");
  for (const [name, value] of Object.entries(COMMERCE_COLORS) as Array<[string, string]>) {
    assert.match(
      css,
      new RegExp(`--color-commerce-[a-z-]+:\\s*${value}`, "i"),
      `token ${name} (${value}) must exist as a commerce theme colour`,
    );
  }
  assert.match(css, /@utility\s+commerce-focus-ring/, "a shared focus-ring utility is part of the foundation");
  assert.match(css, /@utility\s+commerce-card-surface/, "a shared card-surface utility is part of the foundation");

  const globals = await readSource("src", "app", "globals.css");
  assert.match(globals, /commerce-foundation\.css/, "the foundation must load from the global stylesheet");
});

test("typography tokens cover every text level in the specification", () => {
  const { COMMERCE_TYPOGRAPHY } = commerceTypography;

  assert.deepEqual(
    Object.keys(COMMERCE_TYPOGRAPHY).sort(),
    ["body", "metadata", "pageTitle", "price", "productTitle", "sectionTitle"],
    "typography tokens must be the locked set of text levels",
  );
  for (const [level, className] of Object.entries(COMMERCE_TYPOGRAPHY) as Array<[string, string]>) {
    assert.equal(typeof className, "string");
    assert.ok(className.trim().length > 0, `typography token ${level} must carry classes`);
    assert.doesNotMatch(className, /style=|;/, `typography token ${level} must be utility classes only`);
  }
  assert.match(COMMERCE_TYPOGRAPHY.price, /text-commerce-price/, "price typography must use the price colour token");
});

test("the container primitive implements the responsive content rail", async () => {
  const rail = await readSource("src", "components", "commerce", "CommerceRail.tsx");

  assert.match(rail, /export function CommerceRail/);
  assert.match(rail, /mx-auto/, "the rail must centre its content");
  assert.match(rail, /1390px/, "the rail must cap at the measured 1390px content rail");
  assert.match(rail, /px-3\b/, "12px mobile padding");
  assert.match(rail, /sm:px-4\b/, "16px tablet padding");
  assert.match(rail, /lg:px-6\b/, "24px desktop padding");
});

test("the icon primitive is decorative by default and sized from tokens", async () => {
  const icon = await readSource("src", "components", "commerce", "CommerceIcon.tsx");

  assert.match(icon, /export function CommerceIcon/);
  assert.match(icon, /aria-hidden/, "icons are decorative unless labelled");
  assert.match(icon, /lucide-react/, "icons come from the dependency already in the project");
  assert.doesNotMatch(icon, /Star|Heart/, "no rating or favorite iconography");
});

test("the shell primitive gives commerce routes a header slot, main region and no footer", async () => {
  const shell = await readSource("src", "components", "commerce", "CommerceShell.tsx");

  assert.match(shell, /export function CommerceShell/);
  assert.match(shell, /<main\b/, "the shell must own the main landmark");
  assert.match(shell, /sr-only/, "the skip link must use Tailwind's own screen-reader utility");
  assert.doesNotMatch(shell, /<footer/i, "commerce routes ship without the captured footer");
});

test("no commerce primitive re-declares a forbidden V1 surface", async () => {
  for (const file of await sourceFiles(commerceComponentsDir)) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      FORBIDDEN_SURFACE_PATTERN,
      `${path.relative(repoRoot, file).replaceAll("\\", "/")} must not name a forbidden V1 surface`,
    );
  }
});

// ---------------------------------------------------------------------------
// 3. Demo catalog data, isolated from the Bagisto adapter
// ---------------------------------------------------------------------------

test("demo catalog data is flagged as demo and spans several groups", () => {
  const { DEMO_CATALOG_CATEGORIES, DEMO_CATALOG_PRODUCTS, IS_DEMO_CATALOG_DATA } = demoCatalog;

  assert.equal(IS_DEMO_CATALOG_DATA, true, "demo data must announce itself as demo data");
  assert.ok(DEMO_CATALOG_CATEGORIES.length >= 3, "demo data needs several product groups");
  assert.ok(DEMO_CATALOG_PRODUCTS.length >= 8, "demo data needs enough products to fill a grid");

  const categorySlugs = new Set(DEMO_CATALOG_CATEGORIES.map((category: { slug: string }) => category.slug));
  assert.equal(categorySlugs.size, DEMO_CATALOG_CATEGORIES.length, "category slugs must be unique");

  const usedCategories = new Set(
    DEMO_CATALOG_PRODUCTS.map((product: { category: { slug: string } | null }) => product.category?.slug),
  );
  assert.ok(usedCategories.size >= 3, "demo products must spread across the demo groups");
  for (const slug of usedCategories) {
    assert.ok(categorySlugs.has(slug as string), `product category ${String(slug)} must be a declared demo group`);
  }
});

test("demo products carry single-axis variants and ascending tier prices", () => {
  const { DEMO_CATALOG_PRODUCTS } = demoCatalog;

  const slugs = new Set<string>();
  const skus = new Set<string>();
  let multiVariantProducts = 0;
  let singleVariantProducts = 0;

  for (const product of DEMO_CATALOG_PRODUCTS) {
    assert.equal(slugs.has(product.slug), false, `duplicate demo slug ${product.slug}`);
    slugs.add(product.slug);
    assert.equal(product.type, "configurable");
    assert.ok(product.variants.length >= 1, `${product.slug} must expose at least one variant`);
    assert.ok(product.optionGroups.length <= 1, `${product.slug} must stay single-axis`);

    if (product.variants.length > 1) multiVariantProducts += 1;
    else singleVariantProducts += 1;

    for (const variant of product.variants) {
      assert.equal(skus.has(variant.sku), false, `duplicate demo SKU ${variant.sku}`);
      skus.add(variant.sku);
      assert.ok(variant.unit.length > 0, `${variant.sku} must declare a unit`);
      assert.ok(variant.minimumOrderQuantity >= 1, `${variant.sku} must declare a MOQ`);
      assert.ok(variant.quantityStep >= 1, `${variant.sku} must declare a quantity step`);
      assert.ok(
        variant.contactFromQuantity > variant.minimumOrderQuantity,
        `${variant.sku} must leave room below the contact threshold`,
      );
      assert.ok(variant.tierPrices.length >= 2, `${variant.sku} must show a tier-price band`);

      let previousMin = 0;
      let previousPrice = Number.POSITIVE_INFINITY;
      for (const tier of variant.tierPrices) {
        assert.ok(tier.minQuantity > previousMin, `${variant.sku} tier minimums must ascend`);
        assert.ok(tier.price < previousPrice, `${variant.sku} tier prices must fall as quantity grows`);
        previousMin = tier.minQuantity;
        previousPrice = tier.price;
      }
    }
  }

  assert.ok(multiVariantProducts >= 2, "demo data must include products needing variant selection");
  assert.ok(singleVariantProducts >= 2, "demo data must include products addable with a unique variant");
});

test("demo catalog data and the Bagisto adapter stay independent", async () => {
  const demoSource = await readSource("src", "data", "demo-catalog.ts");
  const adapterSource = await readSource("src", "lib", "bagisto-catalog.ts");

  assert.doesNotMatch(demoSource, /bagisto/i, "demo data must not import or mention the Bagisto adapter");
  assert.doesNotMatch(adapterSource, /demo-catalog|DEMO_CATALOG/, "the Bagisto adapter must not read demo data");
  assert.doesNotMatch(demoSource, FORBIDDEN_SURFACE_PATTERN, "demo data must not model a forbidden V1 surface");
});

// ---------------------------------------------------------------------------
// 4. Shared shell/menu/card/detail/request-cart contracts
// ---------------------------------------------------------------------------

test("the card action contract has exactly the three specified outcomes", () => {
  assert.deepEqual(
    [...commerceUi.COMMERCE_CARD_ACTION_KINDS].sort(),
    ["add-to-request-cart", "select-variant", "unavailable"],
  );
});

// Compared whole rather than field by field: that is what proves `variantSku` is
// *absent* from the actions that must not carry one, instead of merely undefined.
test("a product with one usable variant resolves to a direct request-cart add", () => {
  const { DEMO_CATALOG_PRODUCTS } = demoCatalog;
  const product = DEMO_CATALOG_PRODUCTS.find(
    (item: { variants: unknown[] }) => item.variants.length === 1,
  );
  assert.ok(product, "demo data must contain a single-variant product");

  assert.deepEqual(commerceUi.resolveCommerceCardAction(product), {
    defaultQuantity: product.variants[0].minimumOrderQuantity,
    kind: "add-to-request-cart",
    label: "Thêm vào giỏ yêu cầu",
    variantSku: product.variants[0].sku,
  });
});

test("a product needing a choice asks for the variant instead of inventing one", () => {
  const { DEMO_CATALOG_PRODUCTS } = demoCatalog;
  const product = DEMO_CATALOG_PRODUCTS.find(
    (item: { variants: unknown[] }) => item.variants.length > 1,
  );
  assert.ok(product, "demo data must contain a multi-variant product");

  assert.deepEqual(commerceUi.resolveCommerceCardAction(product), {
    href: `/san-pham/${product.slug}/`,
    kind: "select-variant",
    label: "Chọn quy cách",
  });
});

test("a product with no usable variant is reported unavailable", () => {
  assert.deepEqual(
    commerceUi.resolveCommerceCardAction({
      slug: "demo-het-hang",
      variants: [{ isAvailable: false, minimumOrderQuantity: 10, sku: "DEMO-OOS" }],
    }),
    { kind: "unavailable", label: "Tạm hết hàng" },
  );
});

test("only the available variants decide the card action", () => {
  assert.deepEqual(
    commerceUi.resolveCommerceCardAction({
      slug: "demo-mot-quy-cach",
      variants: [
        { isAvailable: false, minimumOrderQuantity: 5, sku: "DEMO-A" },
        { isAvailable: true, minimumOrderQuantity: 25, sku: "DEMO-B" },
      ],
    }),
    {
      defaultQuantity: 25,
      kind: "add-to-request-cart",
      label: "Thêm vào giỏ yêu cầu",
      variantSku: "DEMO-B",
    },
  );
});

test("quantity clamps to MOQ and moves on the declared step", () => {
  const rule = { minimumOrderQuantity: 10, quantityStep: 5 };

  assert.equal(commerceUi.clampCommerceQuantity(0, rule), 10, "below MOQ clamps up to MOQ");
  assert.equal(commerceUi.clampCommerceQuantity(10, rule), 10);
  assert.equal(commerceUi.clampCommerceQuantity(12, rule), 15, "off-step rounds up to the next step");
  assert.equal(commerceUi.clampCommerceQuantity(15, rule), 15);
  assert.equal(commerceUi.clampCommerceQuantity(Number.NaN, rule), 10, "unparsable input falls back to MOQ");
  assert.equal(commerceUi.clampCommerceQuantity(7.5, rule), 10);
  assert.equal(
    commerceUi.clampCommerceQuantity(2_000_000, rule),
    commerceUi.COMMERCE_MAX_QUANTITY,
    "quantity is capped by the storage contract",
  );
});

test("stepping quantity respects MOQ as the floor", () => {
  const rule = { minimumOrderQuantity: 10, quantityStep: 5 };

  assert.equal(commerceUi.stepCommerceQuantity(10, 1, rule), 15);
  assert.equal(commerceUi.stepCommerceQuantity(15, -1, rule), 10);
  assert.equal(commerceUi.stepCommerceQuantity(10, -1, rule), 10, "stepping down never breaches MOQ");
});

test("the shared contracts describe every commerce surface without a forbidden field", async () => {
  const source = await readSource("src", "types", "commerce-ui.ts");

  for (const contract of [
    "CommerceShellViewModel",
    "CommerceMegaMenuViewModel",
    "CommerceProductCardViewModel",
    "CommerceProductDetailViewModel",
    "CommerceRequestCartViewModel",
  ]) {
    assert.match(source, new RegExp(`export interface ${contract}\\b`), `${contract} must be part of the contract`);
  }

  assert.match(source, /ResolvedRequestCart\b/, "the cart view model must reuse the locked resolved-cart contract");
  assert.doesNotMatch(source, FORBIDDEN_SURFACE_PATTERN, "contracts must not model a forbidden V1 surface");
});

test("the request-cart, webhook and Sheet contracts are untouched by the foundation", async () => {
  const storage = await import("../src/lib/request-cart-storage" + ".ts");

  assert.equal(storage.REQUEST_CART_STORAGE_KEY, "giacong.request-cart.v1");
  assert.equal(storage.REQUEST_CART_SCHEMA_VERSION, 1);
  assert.equal(storage.REQUEST_CART_MAX_LINES, 20);
  assert.equal(storage.REQUEST_CART_MAX_BYTES, 32_768);
  assert.equal(commerceUi.COMMERCE_MAX_QUANTITY, storage.REQUEST_CART_MAX_QUANTITY);

  assert.ok(await exists(path.join(repoRoot, "src", "lib", "contact-webhook.ts")), "the webhook must stay in place");
  assert.ok(
    await exists(path.join(appDir, "api", "gui-yeu-cau", "xac-thuc", "route.ts")),
    "the cart revalidation route must stay in place",
  );
  assert.ok(await exists(path.join(appDir, "api", "contact", "route.ts")), "the contact route must stay in place");
});

test("the foundation adds no dependency and no forbidden route", async () => {
  const manifest = JSON.parse(await readSource("package.json")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  assert.deepEqual(
    Object.keys(manifest.dependencies).sort(),
    [
      "@base-ui/react",
      "class-variance-authority",
      "clsx",
      "lucide-react",
      "next",
      "react",
      "react-dom",
      "shadcn",
      "tailwind-merge",
      "tw-animate-css",
    ],
    "the foundation must not add a runtime dependency",
  );

  for (const forbidden of ["gio-hang", "thanh-toan", "tai-khoan", "dat-hang"]) {
    assert.equal(
      await exists(path.join(commerceGroupDir, forbidden)),
      false,
      `/${forbidden} must not exist in the commerce group`,
    );
  }
  assert.equal(
    await exists(path.join(commerceGroupDir, "quan-tri")),
    false,
    "the commerce group must not host an admin surface",
  );
});
