// Contract for the commerce shell chrome: header, product mega-menu, mobile
// navigation, floating contact cluster and the B2B support strip.
//
// Node cannot import `.tsx`, so the components are asserted as source text —
// the same approach `commerce-foundation.test.mts` already uses. The navigation
// data module has no framework import, so it is exercised as a real module and
// its derivation is tested as behaviour rather than as text.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { CatalogCategory, CatalogProductParent } from "../src/types/catalog.ts";

const repoRoot = path.join(import.meta.dirname, "..");

const nav = await import("../src/components/commerce/commerce-navigation" + ".ts");
const channels = await import("../src/lib/request-cart-channels" + ".ts");

function readSource(...segments: string[]): Promise<string> {
  return readFile(path.join(repoRoot, ...segments), "utf8");
}

function chromeSource(name: string): Promise<string> {
  return readSource("src", "components", "commerce", name);
}

/**
 * Surfaces the master plan drops. Checked against every file this feature adds,
 * comments included, so the chrome cannot grow one by accident.
 */
const FORBIDDEN_SURFACE_PATTERN =
  /\b(rating|review|favorite|wishlist|checkout|payment|shipping|thanh-toan|gio-hang|tai-khoan)\b/i;

/** Every file this feature owns. */
const CHROME_FILES = [
  "CommerceHeader.tsx",
  "CommerceTabHeader.tsx",
  "ScopedCommerceHeader.tsx",
  "CommerceFooter.tsx",
  "ProductMegaMenu.tsx",
  "MobileCommerceNav.tsx",
  "CommerceFloatingContacts.tsx",
  "CommerceSupportStrip.tsx",
  "CommerceRequestBadge.tsx",
  "commerce-navigation.ts",
];

// ---------------------------------------------------------------------------
// 1. Navigation data: single source for links, hotline and contact channels
// ---------------------------------------------------------------------------

test("the hotline is the approved number in one place", () => {
  assert.equal(nav.COMMERCE_HOTLINE, "0868408115");
  assert.equal(nav.COMMERCE_HOTLINE_HREF, "tel:0868408115");
});

test("header navigation is the locked six actions and every target resolves", () => {
  const items = nav.COMMERCE_NAV_ITEMS;

  assert.equal(items.length, 6, "the header carries six navigation actions");
  assert.deepEqual(
    items.map((item: { label: string }) => item.label),
    ["Trang chủ", "Mua hàng", "Thuê gia công", "Về Giacong.vn", "Tin tức", "Liên hệ"],
    "the five labels locked by qa:services, plus the reference's sixth action",
  );

  for (const item of items) {
    assert.match(item.href, /^\/[a-z0-9/-]*$/, `${item.label} must target a local route`);
    assert.ok(item.href.endsWith("/"), `${item.label} must keep the trailing-slash route form`);
  }

  const product = items.find((item: { label: string }) => item.label === "Mua hàng");
  assert.ok(product, "the product action must exist");
  assert.equal(product.href, "/san-pham/", "the product action must link to the catalog");
  assert.equal(product.hasMegaMenu, true, "the product action is the mega-menu trigger");
  assert.equal(
    items.filter((item: { hasMegaMenu?: boolean }) => item.hasMegaMenu).length,
    1,
    "only the product action opens a mega-menu",
  );
});

test("the quote action and request badge share the one request route", () => {
  assert.equal(nav.COMMERCE_REQUEST_HREF, "/gui-yeu-cau/");
  assert.equal(nav.COMMERCE_QUOTE_LABEL, "Gửi yêu cầu");
});

test("floating contact channels carry the approved four targets", () => {
  const contacts = nav.COMMERCE_CONTACT_CHANNELS;

  assert.deepEqual(
    contacts.map((channel: { kind: string }) => channel.kind),
    ["hotline", "zalo", "messenger", "email"],
  );

  const hrefFor = (kind: string): string | undefined =>
    contacts.find((channel: { kind: string }) => channel.kind === kind)?.href;

  assert.equal(hrefFor("hotline"), "tel:0868408115");
  assert.equal(hrefFor("zalo"), "https://zalo.me/06408115");
  assert.equal(hrefFor("messenger"), "https://m.me/qtudepdai");
  assert.equal(hrefFor("email"), "mailto:qtu1053@gmail.com");

  for (const channel of contacts) {
    assert.ok(channel.label.trim().length > 0, `${channel.kind} must carry a visible label`);
    assert.ok(channel.contact.trim().length > 0, `${channel.kind} must show the reference itself`);
  }
});

// The accepted-request handoff already publishes these values. Mirrored rather
// than imported so the chrome has no dependency on the cart module, and asserted
// equal here so the two can never drift.
test("contact channels agree with the locked request-cart channel list", () => {
  const canonical = new Map(
    channels.REQUEST_CART_CHANNELS.map((channel: { id: string; href: string }) => [channel.id, channel.href]),
  );

  for (const channel of nav.COMMERCE_CONTACT_CHANNELS) {
    assert.equal(
      channel.href,
      canonical.get(channel.kind),
      `${channel.kind} must match the request-cart channel target`,
    );
  }
});

test("the two B2B callouts are real local routes with copy", () => {
  const callouts = nav.COMMERCE_B2B_CALLOUTS;

  assert.equal(callouts.length, 2, "the panel bottom carries exactly two callouts");
  for (const callout of callouts) {
    assert.ok(callout.title.trim().length > 0, "a callout must carry a title");
    assert.ok(callout.description.trim().length > 0, "a callout must carry supporting copy");
    assert.match(callout.href, /^\/[a-z0-9/-]*$/, "a callout must target a local route");
  }
});

// ---------------------------------------------------------------------------
// 2. Mega-menu derivation
// ---------------------------------------------------------------------------

const categoryFixture: CatalogCategory[] = [
  { id: 1, name: "Bột và nguyên liệu khô", slug: "bot-nguyen-lieu-kho" },
  { id: 2, name: "Trà và thảo mộc sấy", slug: "tra-thao-moc-say" },
];

function productFixture(slug: string, categoryIndex: number, price: number): CatalogProductParent {
  return {
    availableVariantCount: 2,
    category: categoryFixture[categoryIndex],
    description: "",
    id: price,
    imageUrl: null,
    name: `Sản phẩm ${slug}`,
    shortDescription: "Quy cách 25kg",
    sku: `SKU-${slug}`,
    slug,
    startingPrice: { currency: "VND", price },
    type: "configurable",
    variantCount: 2,
  };
}

test("the menu groups products under their category and marks the active one", () => {
  const menu = nav.buildCommerceMegaMenu({
    activeCategorySlug: "tra-thao-moc-say",
    categories: categoryFixture,
    products: [
      productFixture("bot-a", 0, 120_000),
      productFixture("tra-b", 1, 90_000),
      productFixture("tra-c", 1, 80_000),
    ],
  });

  assert.deepEqual(
    menu.categories.map((category: { slug: string; isActive: boolean }) => [category.slug, category.isActive]),
    [["bot-nguyen-lieu-kho", false], ["tra-thao-moc-say", true]],
  );
  assert.deepEqual(
    menu.categories.map((category: { subcategories: unknown[] }) => category.subcategories.length),
    [1, 2],
    "each category lists only its own products as subcategory rows",
  );
  assert.equal(menu.categories[1].subcategories[0].productSlug, "tra-b");
  assert.equal(menu.categories[0].count, 1, "a category reports how many products it holds");
});

test("with no active category the first one leads, so the panel is never blank", () => {
  const menu = nav.buildCommerceMegaMenu({
    activeCategorySlug: "",
    categories: categoryFixture,
    products: [productFixture("bot-a", 0, 120_000)],
  });

  assert.equal(menu.categories[0].isActive, true);
  assert.equal(menu.categories.filter((category: { isActive: boolean }) => category.isActive).length, 1);
});

test("an unknown active category does not orphan the panel", () => {
  const menu = nav.buildCommerceMegaMenu({
    activeCategorySlug: "khong-ton-tai",
    categories: categoryFixture,
    products: [],
  });

  assert.equal(menu.categories[0].isActive, true, "selection falls back to the first category");
});

test("the featured column stays at three cards drawn from the active category", () => {
  const menu = nav.buildCommerceMegaMenu({
    activeCategorySlug: "tra-thao-moc-say",
    categories: categoryFixture,
    products: [
      productFixture("bot-a", 0, 500_000),
      productFixture("tra-b", 1, 90_000),
      productFixture("tra-c", 1, 80_000),
      productFixture("tra-d", 1, 70_000),
      productFixture("tra-e", 1, 60_000),
    ],
  });

  assert.equal(menu.featured.length, 3, "the reference panel shows three compact cards");
  for (const item of menu.featured) {
    assert.equal(item.categorySlug, "tra-thao-moc-say", "featured cards follow the active category");
    assert.equal(typeof item.price, "number", "the card carries a numeric price for the shared formatter");
    assert.ok(item.productSlug.length > 0, "a featured card must address a real product");
  }
});

// The menu is chrome, not page content: an empty or unavailable feed must leave a
// usable panel rather than an error.
test("an empty feed degrades to an empty panel instead of throwing", () => {
  const menu = nav.buildCommerceMegaMenu({ activeCategorySlug: "", categories: [], products: [] });

  assert.deepEqual(menu.categories, []);
  assert.deepEqual(menu.featured, []);
  assert.equal(menu.callouts.length, 2, "the B2B callouts are static and survive an empty feed");
});

test("the menu never invents a variant key for its featured cards", () => {
  const menu = nav.buildCommerceMegaMenu({
    activeCategorySlug: "tra-thao-moc-say",
    categories: categoryFixture,
    products: [productFixture("tra-b", 1, 90_000)],
  });

  assert.equal(
    Object.hasOwn(menu.featured[0], "variantSku"),
    false,
    "list data carries no SKU, so a featured card must route to detail instead",
  );
});

// ---------------------------------------------------------------------------
// 3. Header: geometry, density and the actions the reference shows
// ---------------------------------------------------------------------------

test("the header shares the storefront green tone and desktop rhythm on the content rail", async () => {
  const header = await chromeSource("CommerceHeader.tsx");

  assert.match(header, /export function CommerceHeader/);
  assert.match(header, /bg-commerce-brand\b/, "the band uses the live giacong.vn green from the commerce palette");
  assert.match(header, /h-commerce-header\b/, "desktop uses the shared storefront-height rhythm");
  assert.match(header, /h-commerce-header-compact/, "390/320 keeps the compact band so the header never overflows");
  assert.match(header, /CommerceRail/, "the header content sits on the shared 1390px rail");
  assert.match(header, /sticky/, "the header is sticky per the interaction model");
  assert.match(header, /flex h-commerce-header-compact/, "the structure follows the storefront header's simple horizontal rail");
});

test("the desktop header carries the 4326 source hierarchy without importing its logo asset", async () => {
  const header = await chromeSource("CommerceHeader.tsx");

  assert.match(header, /lg:grid-cols-\[1fr_auto_1fr\]/, "desktop navigation balances around a centred wordmark");
  assert.match(header, /justify-self-center/, "the wordmark stays centred independently of side actions");
  assert.match(header, /sourceLeftNavItems/, "the source's left navigation group is explicit");
  assert.match(header, /item\.label === "Về Giacong\.vn"/, "the about tab stays in the desktop left navigation");
  assert.match(header, /sourceRightNavItems/, "the source's right navigation group is explicit");
});

test("the wordmark is set as text, so no third-party logo asset ships", async () => {
  const header = await chromeSource("CommerceHeader.tsx");

  assert.doesNotMatch(header, /<img|next\/image|\.svg|\.png|\.webp/i, "the logo must not be an image asset");
  assert.match(header, /Giacong/, "the wordmark is rendered as text");
});

test("the header carries the hotline, quote action and request badge, and no account", async () => {
  const header = await chromeSource("CommerceHeader.tsx");

  assert.match(header, /COMMERCE_HOTLINE/, "the hotline comes from the navigation module");
  assert.match(header, /COMMERCE_QUOTE_LABEL/, "the quote action is present");
  assert.match(header, /CommerceRequestBadge/, "the request badge is mounted");
  assert.doesNotMatch(header, /Đăng nhập|Đăng ký|account/i, "V1 has no customer account surface");
});

test("the quote button matches the outlined-white control in the reference", async () => {
  const header = await chromeSource("CommerceHeader.tsx");

  assert.match(header, /border/, "the quote control is outlined rather than filled");
  assert.match(header, /rounded-commerce-control/, "controls use the measured control radius");
  assert.match(header, /COMMERCE_REQUEST_HREF/, "the quote control targets the one request route");
});

test("the full nav collapses below the compact breakpoint and the menu trigger takes over", async () => {
  const header = await chromeSource("CommerceHeader.tsx");

  assert.match(header, /max-lg:hidden|lg:flex|hidden lg:/, "the full nav is desktop-only");
  assert.match(header, /MobileCommerceNav/, "the compact header mounts the drawer trigger");
  assert.match(header, /ProductMegaMenu/, "the desktop header mounts the mega-menu");
});

test("the request badge reads the locked storage contract and links to the request route", async () => {
  const badge = await chromeSource("CommerceRequestBadge.tsx");

  assert.match(badge, /^"use client";/m, "the badge reacts to local storage, so it is a client component");
  assert.match(badge, /REQUEST_CART_STORAGE_KEY/, "the badge listens on the locked storage key");
  assert.match(badge, /addEventListener\("storage"/, "the badge reacts to storage events");
  assert.match(badge, /COMMERCE_REQUEST_HREF/, "the badge links to the request route");
  assert.match(badge, /aria-live/, "the count is announced when it changes");
  assert.doesNotMatch(badge, /unitPrice|subtotal/i, "no money reaches the chrome");
});

// ---------------------------------------------------------------------------
// 4. Mega-menu: geometry, three zones, callouts and keyboard behaviour
// ---------------------------------------------------------------------------

test("the panel is a white overlay below the header, on the rail", async () => {
  const menu = await chromeSource("ProductMegaMenu.tsx");

  assert.match(menu, /^"use client";/m, "the panel owns disclosure state");
  assert.match(menu, /export function ProductMegaMenu/);
  assert.match(menu, /commerce-panel-surface/, "the panel uses the shared white panel surface");
  assert.match(menu, /top-full|top-commerce-header/, "the panel starts directly below the header band");
});

test("the panel has the three reference zones and the two B2B callouts", async () => {
  const menu = await chromeSource("ProductMegaMenu.tsx");

  assert.match(menu, /menu\.callouts/, "the callout rows are rendered from the menu model");
  assert.ok(menu.includes("Danh mục"), "the panel must label its category column");
  assert.ok(menu.includes("Sản phẩm nổi bật"), "the panel must label its featured column");
  assert.match(menu, /grid-cols-\[/, "the panel is an explicit three-column grid");
});

test("the active category uses the pale surface and a green leading edge", async () => {
  const menu = await chromeSource("ProductMegaMenu.tsx");

  assert.match(menu, /bg-commerce-active-surface/, "the active row uses the pale green token");
  assert.match(menu, /border-l-/, "the active row carries a green leading edge");
});

test("the trigger exposes its disclosure state and the panel is labelled", async () => {
  const menu = await chromeSource("ProductMegaMenu.tsx");

  assert.match(menu, /aria-expanded=\{/, "the trigger publishes its state");
  assert.match(menu, /aria-controls=/, "the trigger points at the panel it owns");
  assert.match(menu, /aria-labelledby=|aria-label=/, "the panel carries an accessible name");
});

test("hover previews the panel and click pins it", async () => {
  const menu = await chromeSource("ProductMegaMenu.tsx");

  assert.match(menu, /onPointerEnter/, "hover previews the panel on desktop");
  assert.match(menu, /onPointerLeave/, "leaving an unpinned preview closes it");
  assert.match(menu, /onClick=/, "click pins the panel open");
});

test("Escape closes the panel, returns focus, and an outside press closes it", async () => {
  const menu = await chromeSource("ProductMegaMenu.tsx");

  assert.match(menu, /"Escape"/, "Escape closes the panel");
  assert.match(menu, /triggerRef\.current\?\.focus\(\)/, "focus returns to the trigger");
  assert.match(menu, /pointerdown/, "an outside pointer press closes the panel");
});

test("the panel search filters labels and never navigates", async () => {
  const menu = await chromeSource("ProductMegaMenu.tsx");

  assert.match(menu, /sr-only/, "the search field has a real label for assistive technology");
  assert.doesNotMatch(menu, /<form/, "the search must not submit or navigate");
  assert.match(menu, /toLowerCase\(\)/, "the search filters labels client-side");
});

test("featured cards route to detail and show no forbidden control", async () => {
  const menu = await chromeSource("ProductMegaMenu.tsx");

  assert.match(menu, /formatVnd/, "prices use the shared VND formatter");
  assert.match(menu, /text-commerce-price/, "prices use the measured red price token");
  assert.doesNotMatch(menu, /Heart|Star\b/, "no favourite or rating iconography");
});

// ---------------------------------------------------------------------------
// 5. Mobile drawer
// ---------------------------------------------------------------------------

test("the drawer is a modal with category disclosures and 44px targets", async () => {
  const drawer = await chromeSource("MobileCommerceNav.tsx");

  assert.match(drawer, /^"use client";/m);
  assert.match(drawer, /export function MobileCommerceNav/);
  assert.match(drawer, /<dialog/, "the drawer is a native modal, so backdrop and inert come for free");
  assert.match(drawer, /aria-expanded=\{/, "each category group publishes its disclosure state");
  assert.match(drawer, /commerce-target|min-h-11|size-11/, "touch targets clear 44px");
  assert.match(drawer, /lg:hidden/, "the drawer trigger is compact-only");
});

test("the drawer closes on Escape, on the backdrop and on the close control", async () => {
  const drawer = await chromeSource("MobileCommerceNav.tsx");

  assert.match(drawer, /onCancel/, "Escape closes the native dialog");
  assert.match(drawer, /showModal\(\)/, "the drawer opens modally so the page behind is inert");
  assert.match(drawer, /\.close\(\)/, "the drawer has a real close path");
  assert.match(drawer, /focus\(\)/, "focus is managed across open and close");
});

// ---------------------------------------------------------------------------
// 6. Floating contacts and the B2B support strip
// ---------------------------------------------------------------------------

test("floating contacts publish all four channels as real links", async () => {
  const contacts = await chromeSource("CommerceFloatingContacts.tsx");

  assert.match(contacts, /export function CommerceFloatingContacts/);
  assert.match(contacts, /COMMERCE_CONTACT_CHANNELS/, "channels come from the navigation module");
  assert.match(contacts, /<a\b/, "each channel is an anchor, not a scripted button");
  assert.match(contacts, /noreferrer/, "external chat targets are opened safely");
  assert.match(contacts, /isExternal/, "only the external channels get a new browsing context");
});

test("floating contacts never cover primary content", async () => {
  const contacts = await chromeSource("CommerceFloatingContacts.tsx");
  const strip = await chromeSource("CommerceSupportStrip.tsx");

  assert.match(contacts, /fixed/, "the cluster is pinned to the viewport");
  assert.doesNotMatch(contacts, /inset-0/, "the cluster must not span the viewport");
  assert.match(contacts, /pointer-events-none/, "the container must not swallow clicks on the page");
  assert.match(contacts, /pointer-events-auto/, "the links themselves stay clickable");
  assert.match(
    contacts,
    /hidden[^"]*min-\[1440px\]:flex/,
    "the fixed cluster must only appear when the outer gutter can contain it",
  );
  assert.match(contacts, /right-0/, "the fixed cluster stays inside the outer gutter");
  assert.match(contacts, /className="sr-only"/, "gutter links stay icon-only instead of covering the last card");
  assert.match(
    strip,
    /COMMERCE_CONTACT_CHANNELS/,
    "all contact channels remain available in normal flow when the fixed cluster is hidden",
  );
});

test("the navigation feed uses the isolated demo catalog only outside production", async () => {
  const source = await readSource("src", "lib", "commerce-nav.ts");

  assert.match(source, /DEMO_CATALOG_CATEGORIES/, "the demo preview keeps the category column populated");
  assert.match(source, /DEMO_CATALOG_LIST/, "the demo preview uses the canonical list projection");
  assert.match(source, /demoProductImage/, "demo menu cards reuse the approved local packshots instead of blank panels");
  assert.match(source, /demoCatalogFallbackAllowed/, "production uses the shared fail-closed demo policy");
});

test("the support strip is the pale B2B band and carries the hotline", async () => {
  const strip = await chromeSource("CommerceSupportStrip.tsx");

  assert.match(strip, /export function CommerceSupportStrip/);
  assert.match(strip, /bg-commerce-support-strip/, "the strip uses the measured pale band token");
  assert.match(strip, /COMMERCE_CONTACT_CHANNELS/, "the strip repeats the hotline and the other approved channels");
  assert.match(strip, /CommerceRail/, "the strip sits on the shared rail");
});

// ---------------------------------------------------------------------------
// 6b. Footer
//
// Rebuilt in Tailwind from the four-column footer the captured pages carry, so
// the product and service routes close the same way the rest of the site does
// without importing the captured cascade. The contact block reads the shared
// navigation data rather than the captured markup: those captured values are the
// real business's own phone, mail and addresses, and the master plan publishes a
// separate demo set for the request handoff.
// ---------------------------------------------------------------------------

test("the footer owns the landmark and rebuilds the four captured columns", async () => {
  const footer = await chromeSource("CommerceFooter.tsx");

  assert.match(footer, /export function CommerceFooter/);
  assert.match(footer, /<footer\b/, "the footer element lives here, not in the shell");
  assert.match(footer, /CommerceRail/, "the footer sits on the shared rail");
  assert.match(footer, /Các dịch vụ chính/, "the service column keeps its captured heading");
  assert.match(footer, /Chính sách chung/, "the policy column keeps its captured heading");
  assert.match(footer, /chinh-sach-bao-mat/, "the one policy page that exists is linked");
});

test("the footer reads its contact values from the shared navigation data", async () => {
  const footer = await chromeSource("CommerceFooter.tsx");

  assert.match(footer, /COMMERCE_CONTACT_CHANNELS/, "the contact block reuses the approved channels");
  // The captured footer's own hotline, mail and two site addresses belong to the
  // real business. Asserted as absent so they cannot be copied back in later.
  for (const captured of ["0947142999", "info@giacong.vn", "Trần Hưng Đạo", "Đồng Văn"]) {
    assert.doesNotMatch(
      footer,
      new RegExp(captured.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `the footer must not carry the captured value ${captured}`,
    );
  }
  // The badge and social markup, not the prose explaining why they were dropped.
  assert.doesNotMatch(footer, /images\.dmca\.com|www\.dmca\.com/i, "no third-party badge asset is bundled");
  assert.doesNotMatch(footer, /href="#"|href="http:\/\/url"/, "no dead link is rebuilt");
});

// ---------------------------------------------------------------------------
// 7. Wiring and guard rails
// ---------------------------------------------------------------------------

test("the commerce layout mounts the new chrome instead of the captured header", async () => {
  const layout = await readSource("src", "app", "(commerce)", "layout.tsx");

  assert.match(layout, /ScopedCommerceHeader/, "the layout mounts the route-scoped commerce header");
  assert.doesNotMatch(layout, /StorefrontHeader/, "the captured storefront header is no longer reused here");
  assert.match(layout, /CommerceShell/, "the clean shell still owns the landmarks");
  assert.match(layout, /CommerceFloatingContacts/, "the shell support slot carries the floating contacts");
  assert.match(layout, /CommerceFooter/, "the shell footer slot carries the rebuilt footer");
});

test("the captured floating rail places a live request cart above the phone action", async () => {
  const [capturedPage, cartButton, cartStyles] = await Promise.all([
    readSource("src", "components", "CapturedPage.tsx"),
    readSource("src", "components", "request-cart", "CapturedRequestCartButton.tsx"),
    readSource("src", "components", "request-cart", "CapturedRequestCartButton.module.css"),
  ]);

  assert.ok(
    capturedPage.indexOf("<CapturedRequestCartButton") < capturedPage.indexOf('className="phonering-alo-alo"'),
    "the cart action must be the first item in the captured floating rail",
  );
  assert.match(cartButton, /href="\/gui-yeu-cau\/"/, "the action opens the only request-cart route");
  assert.match(cartButton, /countRequestCartLines/, "the badge reads the locked cart count");
  assert.match(cartButton, /REQUEST_CART_UPDATED_EVENT/, "same-tab cart writes refresh the badge");
  assert.match(cartButton, /aria-label=.*Giỏ hàng/, "the icon-only action has an accessible name");
  assert.match(cartButton, /CapturedRequestCartButton\.module\.css/, "the captured cascade is isolated behind a CSS module");
  assert.match(cartStyles, /height:\s*45px/, "the cart action matches the contact buttons");
  assert.match(cartStyles, /background-color:\s*#5aa400/, "the cart action uses the storefront green");
});

test("only the catalog and service tabs switch to the reference-aligned header", async () => {
  const scopedHeader = await chromeSource("ScopedCommerceHeader.tsx");

  assert.match(scopedHeader, /^"use client";/m, "the pathname switch runs after navigation");
  assert.match(scopedHeader, /usePathname/, "the switch reads the current app route");
  assert.match(scopedHeader, /pathname\.startsWith\("\/san-pham"\)/, "the catalog tab owns the new header");
  assert.match(scopedHeader, /pathname\.startsWith\("\/thue-gia-cong"\)/, "the service tab owns the new header");
  assert.match(scopedHeader, /CommerceHeader/, "all other commerce routes retain their existing header");
  assert.match(scopedHeader, /CommerceTabHeader/, "the two approved tabs render the scoped header");
});

test("the scoped tab header mirrors the home and contact navigation hierarchy", async () => {
  const header = await chromeSource("CommerceTabHeader.tsx");
  const capturedHome = await readSource("src", "data", "pages", "home.json");

  for (const label of ["Home", "Về Giacong.vn", "Sản Phẩm", "Dịch vụ", "Tin tức", "Liên hệ"]) {
    assert.ok(capturedHome.includes(label), `the captured ${label} tab is present`);
  }
  assert.match(header, /capturedHomeHeader/, "the two tabs render the captured navigation hierarchy");
  assert.match(header, /thue-gia-cong/, "the service tab receives the app's real route");
});

test("the scoped tab header reuses the captured home chrome rather than redrawing it", async () => {
  const header = await chromeSource("CommerceTabHeader.tsx");

  assert.match(header, /data\/pages\/home\.json/, "the source is the captured home header");
  assert.match(header, /dangerouslySetInnerHTML/, "the captured header markup is rendered without redrawing it");
  assert.match(header, /CommerceTabHeader\.module\.css/, "the captured CSS stays scoped to the two approved tabs");
});

test("the two index tabs reuse the complete captured News frame before inserting their content", async () => {
  const frame = await readSource("src", "components", "CapturedNewsFrame.tsx");
  const shell = await readSource("src", "components", "site", "CapturedStorefrontShell.tsx");
  const storefrontLayout = await readSource("src", "app", "(storefront)", "layout.tsx");
  const catalogPage = await readSource("src", "app", "(storefront)", "san-pham", "page.tsx");
  const servicePage = await readSource("src", "app", "(storefront)", "thue-gia-cong", "page.tsx");

  assert.match(frame, /CapturedStorefrontShell/, "the archive content delegates chrome to the shared shell");
  assert.match(shell, /data\/pages\/tin-tuc\.json/, "the complete frame is sourced from the News capture");
  assert.match(shell, /layerCapturedStyles/, "the News page-level stylesheet is retained");
  assert.match(shell, /normalizeCapturedMarkup/, "the same captured markup normalization is retained");
  assert.match(shell, /GiacongInteractions/, "the News interactions are retained");
  assert.match(shell, /current-menu-item\|current_page_item\|current-menu-parent\|active/, "the News active state is cleared");
  assert.match(shell, /active current-menu-item/, "the current product or service tab receives the source active state");
  assert.match(storefrontLayout, /captured-layers\.css/, "the two routes inherit the exact News stylesheet cascade");
  assert.match(catalogPage, /<CapturedNewsFrame activePath="\/san-pham" title="Sản phẩm"/, "the product content is inserted into the News frame");
  assert.match(servicePage, /<CapturedNewsFrame activePath="\/thue-gia-cong" title="Thuê gia công"/, "the service content is inserted into the News frame");
});

test("the approved index tabs derive their captured Header and Footer from one shared shell", async () => {
  const frame = await readSource("src", "components", "CapturedNewsFrame.tsx");
  const shell = await readSource("src", "components", "site", "CapturedStorefrontShell.tsx");
  const navigation = await readSource("src", "components", "site", "storefront-navigation.ts");
  const catalogPage = await readSource("src", "app", "(storefront)", "san-pham", "page.tsx");
  const servicePage = await readSource("src", "app", "(storefront)", "thue-gia-cong", "page.tsx");

  assert.match(frame, /CapturedStorefrontShell/, "the archive frame delegates its site chrome to the shared shell");
  assert.match(frame, /getStorefrontNavigationForPath/, "the active tab is resolved from the route path");
  assert.match(shell, /data\/pages\/tin-tuc\.json/, "the shared shell retains the approved News capture");
  assert.match(shell, /<header|capturedHeader/, "the shared shell owns the Header markup");
  assert.match(shell, /<footer|capturedFooter/, "the shared shell owns the Footer markup");
  assert.match(navigation, /\/san-pham/, "the one navigation contract includes the product tab");
  assert.match(navigation, /\/thue-gia-cong/, "the one navigation contract includes the service tab");
  assert.match(navigation, /menu-item-1742/, "the product active state has one source");
  assert.match(navigation, /menu-item-5166/, "the service active state has one source");
  assert.match(catalogPage, /activePath="\/san-pham"/, "the product route supplies its canonical path");
  assert.match(servicePage, /activePath="\/thue-gia-cong"/, "the service route supplies its canonical path");
});

test("the shell exposes the footer as a slot and still declares no footer itself", async () => {
  const shell = await readSource("src", "components", "commerce", "CommerceShell.tsx");

  assert.match(shell, /footer\?: ReactNode/, "the shell takes the footer as a slot");
  assert.doesNotMatch(shell, /<footer/i, "the footer element stays out of the shell");
});

test("every direct page under the two approved tabs uses the one News storefront shell", async () => {
  const commerceService = path.join(repoRoot, "src", "app", "(commerce)", "thue-gia-cong");
  const capturedService = path.join(repoRoot, "src", "app", "(storefront)", "thue-gia-cong");
  const commerceCatalog = path.join(repoRoot, "src", "app", "(commerce)", "san-pham");
  const capturedCatalog = path.join(repoRoot, "src", "app", "(storefront)", "san-pham");

  assert.equal(
    await readFile(path.join(capturedService, "page.tsx"), "utf8").then(() => true, () => false),
    true,
    "the service index must inherit the complete News frame",
  );
  assert.equal(
    await readFile(path.join(commerceService, "page.tsx"), "utf8").then(() => true, () => false),
    false,
    "the service index must not also render the commerce chrome",
  );
  assert.equal(
    await readFile(path.join(capturedService, "[family]", "page.tsx"), "utf8").then(() => true, () => false),
    true,
    "service detail pages use the shared captured shell",
  );
  assert.equal(
    await readFile(path.join(capturedCatalog, "[slug]", "page.tsx"), "utf8").then(() => true, () => false),
    true,
    "product detail pages use the shared captured shell",
  );
  assert.equal(
    await readFile(path.join(commerceService, "[family]", "page.tsx"), "utf8").then(() => true, () => false),
    false,
    "a service detail page must not keep the old commerce chrome",
  );
  assert.equal(
    await readFile(path.join(commerceCatalog, "[slug]", "page.tsx"), "utf8").then(() => true, () => false),
    false,
    "a product detail page must not keep the old commerce chrome",
  );
});

test("the chrome declares no forbidden V1 surface, gradient or reserved port", async () => {
  for (const file of CHROME_FILES) {
    const source = await chromeSource(file);
    assert.doesNotMatch(source, FORBIDDEN_SURFACE_PATTERN, `${file} must not name a forbidden V1 surface`);
    assert.doesNotMatch(source, /gradient/i, `${file} must not use a gradient`);
    assert.doesNotMatch(source, /:3000|:8000|:8001/, `${file} must not reference a reserved port`);
  }
});

test("the chrome adds no dependency and no third-party brand asset", async () => {
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
      "lucide-react",
      "next",
      "react",
      "react-dom",
      "shadcn",
      "tailwind-merge",
      "tw-animate-css",
    ],
    "the chrome must not add a runtime dependency",
  );
  assert.equal(
    manifest.scripts["test:header"],
    "node --no-warnings --experimental-strip-types --test scripts/commerce-header.test.mts",
    "the chrome contract runs as its own focused suite",
  );

  for (const file of CHROME_FILES) {
    const source = await chromeSource(file);
    assert.doesNotMatch(
      source,
      /zalo\.svg|facebook|messenger\.svg|\.png|\.webp|logo\.svg/i,
      `${file} must not ship a third-party brand asset`,
    );
  }
});
