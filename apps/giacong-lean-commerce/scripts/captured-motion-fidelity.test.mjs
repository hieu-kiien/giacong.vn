import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { layerCapturedStyles, normalizeCapturedMarkup } = await import("../src/lib/captured-markup" + ".ts");
const { transformPage } = await import("./capture-giacong.mjs");
const { applySiteSettingsToMarkup } = await import("../src/lib/site-markup" + ".ts");
const { applyNavigationToMarkup } = await import("../src/lib/site-navigation" + ".ts");
const interactions = await readFile(new URL("../src/components/GiacongInteractions.tsx", import.meta.url), "utf8");
const capturedMotion = await readFile(new URL("../src/components/captured-motion.ts", import.meta.url), "utf8");
const mobileNavigation = await readFile(new URL("../src/components/mobile-navigation.ts", import.meta.url), "utf8");
const capturedPage = await readFile(new URL("../src/components/CapturedPage.tsx", import.meta.url), "utf8");
const capturedMarkupSource = await readFile(new URL("../src/lib/captured-markup.ts", import.meta.url), "utf8");
const globals = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const uxAuditPilot = await readFile(new URL("./ux-audit-pilot.mjs", import.meta.url), "utf8");
const contactForm = await readFile(new URL("../src/components/contact-form.ts", import.meta.url), "utf8");
const capturedHome = await readFile(new URL("../src/components/site/CapturedHomePage.tsx", import.meta.url), "utf8");
const motionSource = `${interactions}\n${capturedMotion}`;

const desktopAndMobileMenu = `
<ul class="header-nav-main">
  <li class="menu-item menu-item-design-container-width menu-item-has-block has-dropdown" id="menu-item-1742">
    <a href="/san-pham/">Sản Phẩm<i class="icon-angle-down"></i></a>
    <div class="sub-menu nav-dropdown"><div class="row"><a href="https://giacong.vn/gia-cong-sua/">Gia công sữa</a></div></div>
  </li>
  <li class="menu-item menu-item-design-container-width menu-item-has-block has-dropdown" id="menu-item-5166">
    <a href="#">Dịch vụ<i class="icon-angle-down"></i></a>
    <div class="sub-menu nav-dropdown"><div class="row"><a href="/dich-vu-say/">Dịch vụ sấy</a></div></div>
  </li>
</ul>
<ul class="nav-sidebar">
  <li class="menu-item menu-item-has-children" id="menu-item-5466">
    <a href="#">Dịch Vụ Gia Công</a>
    <ul class="sub-menu nav-sidebar-ul children"><li><a href="/dich-vu-say/">Dịch Vụ Sấy</a></li></ul>
  </li>
</ul>`;

const settings = {
  about_title: "Giới thiệu mới",
  brand_name: "Giacong.vn",
  contact_email: "info@giacong.vn",
  contact_phone: "0947142999",
  contact_zalo_url: "",
  contact_messenger_url: "",
  hero_eyebrow: "Năng lực gia công",
  hero_image_url: "",
  hero_title: "Hero mới",
  logo_url: "",
  site_description: "",
  site_title: "Giacong.vn",
};

test("normalizes captured navigation into a direct product route and grouped services", () => {
  const result = normalizeCapturedMarkup(desktopAndMobileMenu);
  const productMenuStart = result.indexOf('id="menu-item-1742"');
  const serviceMenuStart = result.indexOf('id="menu-item-5166"');
  const productMenu = result.slice(productMenuStart, serviceMenuStart);
  const serviceMenu = result.slice(serviceMenuStart);

  assert.equal((result.match(/class="sub-menu nav-dropdown"/g) ?? []).length, 1);
  assert.match(productMenu, /href="\/san-pham\/"/);
  assert.match(productMenu, /Mua hàng/);
  assert.doesNotMatch(productMenu, /nav-dropdown|icon-angle-down/);
  assert.match(result, /Thuê gia công<i class="icon-angle-down"><\/i>/);
  assert.match(serviceMenu, /id="menu-item-5166"[\s\S]*?href="\/thue-gia-cong\/"/);
  assert.match(serviceMenu, /Thực phẩm và nguyên liệu/);
  assert.match(serviceMenu, /Gia công sốt chấm/);
  assert.match(serviceMenu, /Dịch vụ sấy/);
  assert.match(serviceMenu, /Sấy và đóng gói/);
  assert.match(serviceMenu, /Xem tất cả dịch vụ/);
  assert.match(serviceMenu, /Gia công sữa bột/);
  assert.match(serviceMenu, /Sấy hồng ngoại/);
  assert.match(result, /id="menu-item-5466"[\s\S]*?href="\/thue-gia-cong\/"/);
  assert.match(result, /id="menu-item-5467"[\s\S]*?href="\/san-pham\/"[\s\S]*?Mua hàng/);
});

test("removes top-level charset declarations before captured CSS enters a layer", () => {
  const result = layerCapturedStyles('@charset "UTF-8"; .captured { color: green; }');

  assert.doesNotMatch(result, /@charset/i);
  assert.match(result, /@layer captured/);
  assert.match(result, /\.captured \{ color: green; \}/);
});

test("keeps mobile Mua hàng direct and reserves accordions for service groups", () => {
  assert.doesNotMatch(mobileNavigation, /createMobileProductItem|clone-mobile-product/);
  assert.match(capturedMarkupSource, /function mobileProductMenu\(\)/);
  assert.match(capturedMarkupSource, /id="menu-item-5467"[\s\S]*href="\/san-pham\/"[\s\S]*Mua hàng/);
  assert.match(capturedMarkupSource, /function mobileServiceMenu\(\)/);
  assert.match(mobileNavigation, /li\.menu-item-has-children, li\.has-dropdown/);
  assert.match(mobileNavigation, /aria-hidden.*String\(!expanded\)/);
});

test("maps legacy mega-menu hrefs to safe parent routes", () => {
  const result = normalizeCapturedMarkup(desktopAndMobileMenu);
  const productMenuStart = result.indexOf('id="menu-item-1742"');
  const serviceMenuStart = result.indexOf('id="menu-item-5166"');
  const productMenu = result.slice(productMenuStart, serviceMenuStart);
  const serviceMenu = result.slice(serviceMenuStart);

  assert.match(productMenu, /href="\/san-pham\/"/);
  assert.doesNotMatch(productMenu, /href="(?:#|\/|\/Hoa quả sấy)"/);
  assert.doesNotMatch(productMenu, /nav-dropdown|icon-angle-down/);
  assert.doesNotMatch(serviceMenu, /href="(?:#|\/|\/Hoa quả sấy)"/);
  assert.match(serviceMenu, /href="\/gia-cong-sot-cham\/"/);
  assert.match(serviceMenu, /href="\/dich-vu-say\/"/);
  assert.match(serviceMenu, /href="\/gia-cong-dong-goi\/"/);
  assert.match(serviceMenu, /href="\/gia-cong-sua-bot\/"/);
  assert.match(serviceMenu, /href="\/say-thang-hoa\/"/);
});

test("renames legacy menu labels even when the dropdown icon carries extra attributes", () => {
  const variantMenu = desktopAndMobileMenu
    .replaceAll('<i class="icon-angle-down"></i>', '<i class="icon-angle-down" aria-hidden="true" ></i>');
  const result = normalizeCapturedMarkup(variantMenu);

  assert.match(result, /Mua hàng/);
  assert.match(result, /Thuê gia công/);
  assert.doesNotMatch(result, /Sản Phẩm<i/);
});

test("keeps one top-level main landmark, names captured frames and gives footer headings a valid level", () => {
  const markup = '<main id="main"><div id="content" role="main"><section><h1>Liên hệ</h1></section></div></main><footer><h3>Thông tin công ty</h3></footer><iframe src="https://www.google.com/maps/embed"></iframe>';
  const result = normalizeCapturedMarkup(markup);

  assert.match(result, /<div id="content">/);
  assert.doesNotMatch(result, /id="content"[^>]*role="main"/);
  assert.match(result, /<footer><h2>Thông tin công ty<\/h2><\/footer>/);
  assert.match(result, /<iframe[^>]*title="Bản đồ vị trí Giacong\.vn"/);
});

test("promotes the captured contact section heading to follow its page title", () => {
  const markup = '<main id="main"><div id="content"><h1>Liên hệ</h1><section><h3>Thông tin công ty</h3></section></div></main>';
  const result = normalizeCapturedMarkup(markup);

  assert.match(result, /<h2>Thông tin công ty<\/h2>/);
  assert.doesNotMatch(result, /<h3>Thông tin công ty<\/h3>/);
});

test("keeps invalid contact submissions on the client", () => {
  assert.match(
    contactForm,
    /event\.preventDefault\(\);[\s\S]*if \(!form\.checkValidity\(\)\)[\s\S]*return;/,
  );
});

test("published navigation keeps Mua hàng direct while updating the service parent", () => {
  const normalized = normalizeCapturedMarkup(desktopAndMobileMenu);
  const result = applyNavigationToMarkup(normalized, [
    {
      id: "products",
      capturedMenuId: "menu-item-1742",
      href: "/san-pham/",
      isActive: true,
      label: "Mua hàng",
      menuKey: "primary",
      sortOrder: 30,
    },
    {
      id: "services",
      capturedMenuId: "menu-item-5166",
      href: "/published-services/",
      isActive: true,
      label: "Dịch vụ đã phát hành",
      menuKey: "primary",
      sortOrder: 40,
    },
  ], "menu-item-1742");

  assert.match(result, /id="menu-item-1742"[\s\S]*?href="\/san-pham\/"[\s\S]*?Mua hàng/);
  assert.doesNotMatch(result.slice(result.indexOf('id="menu-item-1742"'), result.indexOf('id="menu-item-5166"')), /nav-dropdown|icon-angle-down/);
  assert.match(result, /id="menu-item-5466"[\s\S]*?href="\/published-services\/"[\s\S]*?Dịch vụ đã phát hành/);
  assert.match(result, /Thực phẩm và nguyên liệu/);
  assert.match(result, /Xem tất cả dịch vụ/);
});

test("published navigation owns parents while service hub choices remain source-owned", () => {
  assert.match(capturedMarkupSource, /D1 site_navigation_items owns top-level parent labels and hrefs/);
  assert.match(capturedMarkupSource, /data-navigation-id/);
  assert.match(capturedMarkupSource, /const serviceMegaMenuColumns/);
  assert.match(capturedMarkupSource, /function mobileProductMenu\(\)/);
  assert.match(capturedMarkupSource, /function mobileServiceMenu\(\)/);
  assert.doesNotMatch(capturedMarkupSource, /productMegaMenuColumns|mobileServiceMenuLinks/);
});

test("desktop UX audit checks the direct product link and service mega-menu", () => {
  assert.match(
    uxAuditPilot,
    /#header li#menu-item-1742(?:\.menu-item-design-container-width)?/,
  );
  assert.match(uxAuditPilot, /href="\/san-pham\/"|\/san-pham/);
  assert.match(uxAuditPilot, /#header li#menu-item-5166\.menu-item-design-container-width\.has-dropdown/);
  assert.doesNotMatch(uxAuditPilot, /filter\(\{ hasText: "Mua hàng" \}\)/);
});

test("keeps the hero eyebrow as h3 and applies the about title to the real h2", () => {
  const markup = '<section class="section01"><h3 class="entry-title">Old eyebrow</h3><h1 class="entry-title">Old hero</h1></section><section><h2 class="entry-title">Old about</h2></section>';
  const result = applySiteSettingsToMarkup(markup, settings);

  assert.match(result, /<h3 class="entry-title">Năng lực gia công<\/h3>/);
  assert.match(result, /<h1 class="entry-title">Hero mới<\/h1>/);
  assert.match(result, /<h2 class="entry-title">Giới thiệu mới<\/h2>/);
  assert.doesNotMatch(result, /<h2 class="entry-title">Năng lực gia công<\/h2>/);
});

test("keeps the injected floating contact off mobile when captured bottom contact owns that surface", () => {
  assert.match(
    capturedPage,
    /className="echbay-sms-messenger style-for-position-br max-\[549px\]:!hidden"/,
  );
  assert.match(capturedPage, /aria-label="Liên hệ nhanh" role="region"/);
});

test("keeps the quick-contact rail in a safe side lane at tablet widths", () => {
  assert.match(
    globals,
    /@media \(min-width: 550px\) and \(max-width: 1199px\)[\s\S]*?\.echbay-sms-messenger \{[\s\S]*?right: 0 !important;[\s\S]*?width: 38px !important;/,
  );
  assert.match(globals, /\.echbay-sms-messenger > div:not\(\.phonering-alo-cart\)[\s\S]*?height: 38px/);
  assert.match(globals, /\.echbay-sms-messenger > div:not\(\.phonering-alo-cart\)[\s\S]*?background-clip: content-box/);
  assert.match(globals, /\.echbay-sms-messenger > div:not\(\.phonering-alo-cart\) > a[\s\S]*?position: absolute/);
  assert.match(globals, /\.echbay-sms-messenger \.phonering-alo-cart \.icon[\s\S]*?height: 22px/);
});

test("capture transform does not bake data-animated=true into generated markup", () => {
  const captured = transformPage(
    '<html class="no-js"><head><title>Test</title></head><body><main><div data-animate="fadeInLeft"></div></main></body></html>',
    "/",
  );

  assert.match(captured.markup, /data-animate="fadeInLeft"/);
  assert.doesNotMatch(captured.markup, /data-animated=/);
  assert.doesNotMatch(normalizeCapturedMarkup(captured.markup), /data-animated=/);
  assert.match(motionSource, /IntersectionObserver/);
  assert.match(motionSource, /clone-slider-ready/);
  assert.match(motionSource, /data-animated/);
  assert.match(globals, /data-animate=fadeInLeft|data-animate\s*\]/);
  assert.match(globals, /clone-menu-slide-in/);
  assert.doesNotMatch(globals, /clone-product-menu[\s\S]*transform: translateY\(/);
  assert.doesNotMatch(globals, /clone-service-menu[\s\S]*transition: opacity \.25s ease-out, transform/);
  assert.doesNotMatch(interactions, /slide\.hidden\s*=\s*slideIndex\s*!==\s*current/);
  assert.match(globals, /\.clone-slider-ready/);
  assert.match(globals, /\.clone-menu-backdrop[\s\S]*transition:\s*opacity\s+\.3s/);
  assert.doesNotMatch(globals, /giacong-page-orbit|giacong-background-drift/);
});

test("keeps slider pagination as a native list instead of an incomplete tablist", () => {
  assert.doesNotMatch(capturedMotion, /dots\.setAttribute\("role", "tablist"\)/);
  assert.match(capturedMotion, /dots\.setAttribute\("aria-label", "Chuyển nội dung"\)/);
});

test("clips translated slider slides so mobile pages cannot grow horizontally", () => {
  assert.match(globals, /\.slider\.clone-slider-ready\s*\{[\s\S]*?overflow:\s*hidden\s*!important;/);
});

test("keeps captured storefront content inside the viewport during motion", () => {
  assert.match(globals, /#main\s*\{[\s\S]*?overflow-x:\s*clip;/);
});

test("raises the captured testimonial metadata to a readable contrast", () => {
  assert.match(
    globals,
    /#main \.section07 \.icon-box-text\.last-reset > p\s*\{[\s\S]*?color:\s*#5f6b61\s*!important;/,
  );
});

test("does not publish unverified homepage proof claims from the captured source", () => {
  assert.match(capturedHome, /removeUnverifiedHomepageProof/);
  assert.match(capturedHome, /section_300790898/);
  assert.match(capturedHome, /section_777974837/);
  assert.match(capturedHome, /section_1385300469/);
});

test("uses text-safe brand overrides for captured white surfaces", () => {
  assert.match(globals, /#main #content \.subtitle > span[\s\S]*color: #327600 !important/);
  assert.match(globals, /#main #content \.wpcf7-form \.wpcf7-submit[\s\S]*background-color: #327600 !important/);
  assert.match(globals, /#main \.giacong-news-search button[\s\S]*background: #327600 !important/);
  assert.match(globals, /\.giacong-news-search button[\s\S]*background: #327600/);
  assert.match(globals, /\.subtitle > span[\s\S]*color: #327600 !important/);
  assert.match(globals, /\.wpcf7-submit[\s\S]*background-color: #327600 !important/);
});

test("settles page motion before collecting the accessibility snapshot", () => {
  assert.match(uxAuditPilot, /async function waitForSettled\(page\)[\s\S]*page\.waitForTimeout\(1400\)/);
  assert.match(uxAuditPilot, /await waitForSettled\(page\);\s*await collectPageInspection\(page, result\);/);
});

test("the contact audit blocks only the local API mutation", () => {
  assert.match(uxAuditPilot, /const localContactOrigin = new URL\(baseUrl\)\.origin/);
  assert.match(uxAuditPilot, /request\.url\(\)[\s\S]*\/api\/contact/);
  assert.match(uxAuditPilot, /pass:\s*invalidCount > 0 && !blockedContactMutation/);
});

test("adds an independent page reveal layer for custom storefront surfaces", () => {
  assert.match(motionSource, /connectPageReveals/);
  assert.match(motionSource, /data-page-reveal/);
  assert.match(motionSource, /data-catalog-grid/);
  assert.match(motionSource, /rootMargin:\s*["']0px 0px -6% 0px["']/);
  assert.match(globals, /\.page-reveal-ready[\s\S]*data-page-reveal/);
  assert.match(globals, /data-page-revealed/);
});

test("primes page reveals before enabling their transition", () => {
  assert.match(motionSource, /page-reveal-motion/);
  assert.match(motionSource, /requestAnimationFrame/);
  assert.match(
    motionSource,
    /elements\.forEach\(\(element\) => \{\s*element\.getBoundingClientRect\(\);\s*\}\);/,
  );
  assert.match(
    motionSource,
    /enableMotionFrame(?:\s*:\s*number \| undefined)? = window\.requestAnimationFrame\(\(\) => \{\s*enableMotionFrame = window\.requestAnimationFrame/,
  );
  assert.match(globals, /\.page-reveal-ready \[data-page-reveal\][\s\S]*transition:\s*none/);
  assert.match(globals, /\.page-reveal-motion \[data-page-reveal\][\s\S]*transition:/);
  assert.match(
    globals,
    /\.page-reveal-ready \[data-page-reveal="scale"\][\s\S]*transform:\s*translate3d\(0, 26px, 0\) scale\(\.94\)/,
  );
});

test("keeps desktop mega menus reachable during the pointer handoff", () => {
  assert.match(
    globals,
    /#header li\.menu-item-design-container-width\.has-dropdown > \.nav-dropdown[\s\S]*?transition: none !important;/,
  );
  assert.match(
    globals,
    /#header li\.menu-item-design-container-width\.has-dropdown::after[\s\S]*?height: 14px;[\s\S]*?pointer-events: auto;/,
  );
  assert.match(
    globals,
    /#header li\.menu-item-design-container-width\.has-dropdown:hover > \.nav-dropdown[\s\S]*?transition: none !important;/,
  );
});

test("closes a sibling desktop mega menu immediately on handoff", () => {
  assert.match(
    globals,
    /#header:has\(li\.has-dropdown:hover\)[\s\S]*?li\.menu-item-design-container-width\.has-dropdown:not\(:hover\) > \.nav-dropdown[\s\S]*?transition: none !important;/,
  );
});

test("keeps the desktop service mega-menu content static like the source", () => {
  assert.match(
    globals,
    /#header li\.menu-item-design-container-width\.has-dropdown > \.nav-dropdown[\s\S]*?transition: none !important;/,
  );
  assert.match(
    globals,
    /#header li\.menu-item-design-container-width\.has-dropdown:hover > \.nav-dropdown[\s\S]*?transition: none !important;/,
  );
});

test("matches the source mobile interaction contract", () => {
  assert.match(interactions, /const focusable = \[\s*menuClose,\s*\.\.\.Array\.from\(/);
  assert.match(interactions, /if \(event\.shiftKey && document\.activeElement === first\)/);
  assert.match(interactions, /getComputedStyle\(element\)\.visibility !== "hidden"/);
  assert.match(mobileNavigation, /expanded \? "Đóng menu con" : "Mở menu con"/);
  assert.match(mobileNavigation, /aria-hidden.*String\(!expanded\)/);
  assert.match(globals, /header-wrapper\.stuck[\s\S]*box-shadow: 1px 1px 10px rgba\(0,0,0,\.15\)/);
  assert.match(globals, /\.clone-menu-backdrop[\s\S]*width: 100vw/);
  assert.match(globals, /nav-sidebar li\.clone-submenu-open > \.sub-menu[\s\S]*max-height: min\(80vh, 760px\)/);
  assert.match(globals, /prefers-reduced-motion: reduce[\s\S]*clone-menu-open[\s\S]*transition: none/);
});

test("strips script elements from normalized captured markup", () => {
  const hostile =
    '<div><p>Giới thiệu</p><script>alert("xss")</script><SCRIPT src="https://evil.example/x.js"></SCRIPT></div>';
  const result = normalizeCapturedMarkup(hostile);

  assert.doesNotMatch(result, /<script/i);
  assert.doesNotMatch(result, /evil\.example/);
  assert.match(result, /Giới thiệu/);
});

test("replaces captured placeholder CTAs and removes placeholder social/footer links", () => {
  const markup = '<a class="nut-xem-them1" href="#"><span>Xem thêm</span><i aria-hidden="true"></i></a><div class="social-icons"><a aria-label="Follow on Facebook" href="http://url"><i class="icon-facebook"></i></a><a aria-label="Follow on LinkedIn" href="#"><i class="icon-linkedin"></i></a></div><footer><ul><li><a href="#">Chính sách thanh toán</a></li><li><a href="/chinh-sach-bao-mat/">Chính sách bảo mật</a></li><li>Thanh toán</li></ul></footer>';
  const result = normalizeCapturedMarkup(markup);

  assert.match(result, /href="\/thue-gia-cong\/"/);
  assert.doesNotMatch(result, /href="http:\/\/url"/i);
  assert.doesNotMatch(result, /Follow on Facebook/);
  assert.doesNotMatch(result, /Follow on LinkedIn/);
  assert.doesNotMatch(result, /Chính sách thanh toán/);
  assert.doesNotMatch(result, /Thanh toán/);
  assert.match(result, /Chính sách bảo mật/);
});
