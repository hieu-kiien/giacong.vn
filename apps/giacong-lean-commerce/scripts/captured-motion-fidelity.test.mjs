import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const { layerCapturedStyles, normalizeCapturedMarkup } = await import("../src/lib/captured-markup" + ".ts");
const { transformPage } = await import("./capture-giacong.mjs");
const { applyHomepageSiteSettingsToMarkup } = await import("../src/lib/site-markup" + ".ts");
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
const productDetail = await readFile(new URL("../src/components/catalog/ProductDetailPage.tsx", import.meta.url), "utf8");
const requestCart = await readFile(new URL("../src/components/request-cart/RequestCartView.tsx", import.meta.url), "utf8");
const policyPage = await readFile(new URL("../src/components/site/PolicyPage.tsx", import.meta.url), "utf8");
const serviceDirectory = await readFile(new URL("../src/components/services/ServiceDirectory.tsx", import.meta.url), "utf8");
const serviceFamilyDetail = await readFile(new URL("../src/components/services/ServiceFamilyDetail.tsx", import.meta.url), "utf8");
const serviceLanding = await readFile(new URL("../src/components/services/ServiceLanding.tsx", import.meta.url), "utf8");
const contactCapture = JSON.parse(await readFile(new URL("../src/data/pages/lien-he.json", import.meta.url), "utf8"));
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

test("defers optional form and motion modules out of the initial interaction chunk", () => {
  assert.doesNotMatch(interactions, /import\s*{\s*connectContactForms\s*}\s*from/);
  assert.doesNotMatch(interactions, /import\s*{\s*connectCapturedMotion\s*}\s*from/);
  assert.doesNotMatch(interactions, /Promise\.all\(\[\s*import\("\.\/contact-form"\)/);
  assert.match(interactions, /import\("\.\/contact-form"\)/);
  assert.match(interactions, /import\("\.\/captured-motion"\)/);
  assert.match(interactions, /import\("\.\/contact-form"\)[\s\S]*?\.then\(\(contactForm\)/);
  assert.match(interactions, /import\("\.\/captured-motion"\)[\s\S]*?\.then\(\(capturedMotion\)/);
});

test("keeps contact form loading route-scoped and defers mobile motion until idle", () => {
  assert.match(interactions, /const contactForms = document\.querySelectorAll<HTMLFormElement>\("\.wpcf7-form"\)/);
  assert.match(interactions, /if \(contactForms\.length > 0\) \{[\s\S]*?import\("\.\/contact-form"\)/);
  assert.match(interactions, /scheduleAfterPaint\([\s\S]*?requestIdleCallback/);
  assert.match(interactions, /matchMedia\?\.\("\(max-width: 849px\)"\)\.matches/);
});

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
  assert.match(result, /<iframe[^>]*title="Bản đồ vị trí Kienhieu"/);
});

test("removes unverified captured ratings and third-party DMCA badges", () => {
  const markup = '<main><div class="kk-star-ratings"><div class="kksr-legend">5/5 - (1 bình chọn)</div></div></main><footer><div class="footer-copy"><br/><a class="dmca-badge" href="//www.dmca.com/Protection/Status.aspx?ID=test"><img alt="DMCA.com Protection Status" src="https://images.dmca.com/badge.png"/></a><a href="https://www.dmca.com/compliance/giacong.vn"><img alt="DMCA compliant image" src="https://www.dmca.com/compliant.png"/></a></div></footer>';
  const result = normalizeCapturedMarkup(markup);

  assert.match(result, /<footer>/);
  assert.doesNotMatch(result, /kk-star-ratings|kksr-legend|5\/5|bình chọn/i);
  assert.doesNotMatch(result, /dmca\.com|dmca-badge/i);
});

test("removes legacy proof widgets from the real contact capture", () => {
  const result = normalizeCapturedMarkup(contactCapture.markup);

  assert.doesNotMatch(result, /kk-star-ratings|kksr-legend|5\/5|bình chọn|dmca\.com|dmca-badge/i);
});

test("promotes the captured contact section heading to follow its page title", () => {
  const markup = '<main id="main"><div id="content"><h1>Liên hệ</h1><section><h3>Thông tin công ty</h3></section></div></main>';
  const result = normalizeCapturedMarkup(markup);

  assert.match(result, /<h2>Thông tin công ty<\/h2>/);
  assert.doesNotMatch(result, /<h3>Thông tin công ty<\/h3>/);
});

test("repairs known spacing and spelling errors in captured copy", () => {
  const result = normalizeCapturedMarkup(
    '<p>Kiếm tra chất lượng</p><p>Kiếm tra và bảo quản</p><p>doanh nghiệp.Bao gồm</p><p>doanh nghiệp,tiến hành</p>',
  );

  assert.match(result, /Kiểm tra chất lượng/);
  assert.match(result, /Kiểm tra và bảo quản/);
  assert.match(result, /doanh nghiệp\. Bao gồm/);
  assert.match(result, /doanh nghiệp, tiến hành/);
  assert.doesNotMatch(result, /Kiếm tra|doanh nghiệp\.Bao|doanh nghiệp,tiến/);
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
  const result = applyHomepageSiteSettingsToMarkup(markup, settings);

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
  assert.match(globals, /\.clone-slider-ready/);
  assert.match(globals, /\.loading-spin[\s\S]*display:\s*none\s*!important/);
  assert.match(capturedMotion, /loading-spin/);
  assert.doesNotMatch(
    normalizeCapturedMarkup('<div class="slider-wrapper"><div class="slider"></div><div class="loading-spin dark large centered"></div></div>'),
    /loading-spin/,
  );
  assert.match(globals, /\.clone-menu-backdrop[\s\S]*transition:\s*opacity\s+\.3s/);
  assert.doesNotMatch(globals, /giacong-page-orbit|giacong-background-drift/);
});

test("keeps captured reveals visible without JavaScript and reduced motion", () => {
  assert.match(capturedMotion, /data-motion-reduced/);
  assert.match(capturedMotion, /const reducedMotion = prefersReducedMotion\(\)/);
  assert.match(capturedMotion, /setAttribute\("data-motion-reduced", "true"\)/);
  assert.match(globals, /\[data-animate\]\[data-motion-reduced\]/);
  assert.match(globals, /html:not\(\.captured-motion-enabled\)\s+\[data-animate\][\s\S]*?opacity:\s*1 !important/);
  assert.match(capturedMotion, /captured-motion-enabled/);
  assert.match(capturedMotion, /documentElement\.classList\.add\("captured-motion-enabled"\)/);
  const reducedRule = globals.match(/\[data-animate\]\[data-motion-reduced\]\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "";
  assert.match(reducedRule, /opacity:\s*1 !important/);
  assert.doesNotMatch(reducedRule, /opacity:\s*0 !important/);
});

test("keeps the captured hero visible without JS and restores its entrance motion after paint", () => {
  assert.match(capturedMotion, /data-captured-hero-motion-ready/);
  assert.match(capturedMotion, /heroElements/);
  assert.match(capturedMotion, /heroMotionFrame/);
  assert.match(capturedMotion, /min-width: 1024px/);
  assert.match(capturedMotion, /data-captured-hero-motion-play/);
  assert.match(capturedMotion, /void hero\.offsetWidth/);
  assert.match(capturedMotion, /hero\.setAttribute\("data-captured-hero-motion-play", "true"\)/);
  assert.match(globals, /#section_250108065\[data-captured-hero-motion-ready\]/);
  assert.match(globals, /#section_250108065\[data-captured-hero-motion-ready\][\s\S]*?opacity: 1 !important/);
  assert.match(globals, /#section_250108065 \[data-animate\][\s\S]*?opacity: 1 !important/);
  assert.match(globals, /data-captured-hero-motion-play\][\s\S]*?transition:\s*transform 620ms/);
});

test("inlines homepage hero visibility before captured CSS settles", () => {
  assert.match(capturedHome, /const HOMEPAGE_CRITICAL_MOTION_STYLES = `@layer captured\{#section_250108065 \[data-animate\]\{[^`]*opacity:1 !important;[^`]*transform:none !important/);
  assert.match(capturedHome, /siteBrandStyles\(settings\)\}\\n\$\{HOMEPAGE_CRITICAL_MOTION_STYLES\}/);
});

test("gives the desktop service mega-menu a compact and accessible visual system", () => {
  assert.match(globals, /width:\s*min\(1080px,\s*calc\(100vw - 48px\)\)/);
  assert.match(globals, /border-radius:\s*14px/);
  assert.match(globals, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(globals, /clone-service-menu::before/);
  assert.match(globals, /ux-menu-link__link:hover[\s\S]*?transform:\s*translate3d\(2px,\s*0,\s*0\)/);
  assert.match(globals, /transition:\s*opacity 160ms ease,\s*transform 160ms ease/);
  assert.match(globals, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("keeps news card metadata and actions at text-safe contrast", () => {
  assert.match(globals, /\.giacong-news-card time\s*\{[^}]*color:\s*#5f6b61/);
  assert.match(globals, /\.giacong-news-card__link\s*\{[^}]*color:\s*#327600/);
});

test("covers app-owned storefront surfaces outside the captured homepage", () => {
  assert.match(capturedMotion, /\[data-motion-section\]/);
  assert.match(capturedMotion, /\[data-service-group\]/);
  assert.match(capturedMotion, /\.giacong-news-detail > article/);
  assert.match(productDetail, /data-motion-section/);
  assert.match(requestCart, /data-motion-section/);
  assert.match(policyPage, /data-motion-section/);
  assert.match(serviceDirectory, /data-motion-section/);
  assert.match(serviceFamilyDetail, /data-motion-section/);
  assert.match(serviceLanding, /data-motion-section/);
});

test("keeps mobile page reveals visible but restrained", () => {
  assert.match(globals, /@media \(max-width: 549px\) and \(prefers-reduced-motion: no-preference\)/);
  assert.match(globals, /translate3d\(0, 18px, 0\)/);
  assert.match(globals, /translate3d\(-24px, 0, 0\)/);
  assert.match(globals, /translate3d\(24px, 0, 0\)/);
});

test("small mobile viewports skip decorative reveal and parallax observers", () => {
  assert.match(capturedMotion, /const smallViewport = window\.matchMedia\?\.\("\(max-width: 549px\)"\)\.matches \?\? false/);
  assert.match(capturedMotion, /smallViewport \? \[\] : \[connectCapturedReveals\(root\), connectPageReveals\(root\)\]/);
  assert.match(capturedMotion, /connectCapturedSliders\(root\)/);
  assert.match(capturedMotion, /smallViewport \? \[\] : \[connectCapturedParallax\(root\)\]/);
});

test("keeps slider pagination as a native list instead of an incomplete tablist", () => {
  assert.doesNotMatch(capturedMotion, /dots\.setAttribute\("role", "tablist"\)/);
  assert.match(capturedMotion, /dots\.setAttribute\("aria-label", "Chuyển nội dung"\)/);
});

test("defers captured slider layout work until the slider nears the viewport", () => {
  assert.match(capturedMotion, /const sliders = Array\.from\(root\.querySelectorAll<HTMLElement>\("\.slider"\)\)/);
  assert.match(capturedMotion, /new IntersectionObserver/);
  assert.match(capturedMotion, /rootMargin: "400px 0px"/);
  assert.match(capturedMotion, /observer\.observe\(slider\)/);
  assert.match(capturedMotion, /connectCapturedSlider\(slider\)/);
  assert.match(capturedMotion, /observer\.unobserve\(slider\)/);
});


test("clips translated slider slides so mobile pages cannot grow horizontally", () => {
  assert.match(globals, /\.slider\.clone-slider-ready\s*\{[\s\S]*?overflow:\s*hidden\s*!important;/);
});

test("fades mobile slider content without exposing adjacent slides during motion", () => {
  assert.match(capturedMotion, /const mobileViewport = window\.matchMedia\?\.\("\(max-width: 549px\)"\)/);
  assert.match(capturedMotion, /data-clone-slider-mode/);
  assert.match(capturedMotion, /slide\.style\.opacity = isMobile \? \(selected \? "1" : "0"\) : ""/);
  assert.match(capturedMotion, /mobileViewport\?\.addEventListener\("change", onViewportChange\)/);
});

test("automatically rotates testimonials off mobile with pause on interaction", () => {
  assert.match(capturedMotion, /const autoRotate = !\(mobileViewport\?\.matches \?\? false\)/);
  assert.match(capturedMotion, /const timer = reducedMotion \|\| !autoRotate/);
  assert.match(capturedMotion, /onMouseEnter = \(\) => \{\s*paused = true;/);
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

test("restores the exact second testimonial image instead of a placeholder", async () => {
  const result = normalizeCapturedMarkup(
    '<img src="https://giacong.vn/wp-content/uploads/2024/09/Screenshot-2024-09-06-004009-298x300.png" srcset="https://giacong.vn/wp-content/uploads/2024/09/Screenshot-2024-09-06-004009-100x100.png 100w"/>',
  );
  assert.match(result, /\/images\/captured-legacy\/source\/Screenshot-2024-09-06-004009\.png/);
  assert.doesNotMatch(result, /captured-asset-placeholder\.svg/);
  await stat(new URL("../public/images/captured-legacy/source/Screenshot-2024-09-06-004009.png", import.meta.url));
});

test("keeps the exact legacy homepage partner showcase while filtering only the proof block", () => {
  assert.match(capturedHome, /removeUnverifiedHomepageProof/);
  assert.match(capturedHome, /section_300790898/);
  assert.doesNotMatch(capturedHome, /const UNVERIFIED_HOMEPAGE_PROOF_SECTION_IDS = \[[\s\S]*?section_777974837/);
  assert.doesNotMatch(capturedHome, /const UNVERIFIED_HOMEPAGE_PROOF_SECTION_IDS = \[[\s\S]*?section_1385300469/);
});

test("preloads the local desktop homepage background when it is the LCP surface", () => {
  assert.match(capturedHome, /rel="preload"\s+href="\/images\/home-captured\/img-b\.webp"\s+as="image"/);
  assert.match(capturedHome, /media="\(min-width: 850px\)"/);
  assert.match(capturedHome, /fetchPriority="high"/);
  assert.match(capturedHome, /!settings\.hero_image_url/);
});

test("preloads the first mobile hero tile when it is the LCP surface", () => {
  assert.match(
    capturedHome,
    /rel="preload"\s+href="\/images\/home-hero\/hero-1\.avif"\s+as="image"\s+type="image\/avif"\s+media="\(max-width: 849px\)"\s+fetchPriority="high"/,
  );
});

test("mobile homepage defers below-fold section rendering without touching the hero", () => {
  assert.match(capturedHome, /const HOMEPAGE_MOBILE_RENDER_STYLES = `@media \(max-width:549px\)/);
  assert.match(capturedHome, /#section_220139106[^}]*content-visibility:auto/);
  assert.match(capturedHome, /contain-intrinsic-size:auto 2400px/);
  assert.match(capturedHome, /#section_294752369\{contain-intrinsic-size:auto 900px;\}/);
  assert.doesNotMatch(capturedHome, /#section_250108065[^}]*content-visibility:auto/);
  assert.doesNotMatch(capturedHome, /#section_1437980462[^}]*content-visibility:auto/);
});


test("keeps the bold font preload off the mobile critical path", () => {
  assert.match(capturedHome, /href="\/styles\/fonts\/SFProDisplay-Bold\.woff2"[^>]*media="\(min-width: 850px\)"/);
  assert.match(capturedPage, /href="\/styles\/fonts\/SFProDisplay-Bold\.woff2"[^>]*media="\(min-width: 850px\)"/);
});

test("uses text-safe brand overrides for captured white surfaces", () => {
  assert.match(globals, /#main #content \.subtitle > span[\s\S]*color: #327600 !important/);
  assert.match(globals, /#main #content \.wpcf7-form \.wpcf7-submit[\s\S]*background-color: #327600 !important/);
  assert.match(globals, /#main \.giacong-news-search button[\s\S]*background: #327600 !important/);
  assert.match(globals, /\.giacong-news-search button[\s\S]*background: #327600/);
  assert.match(globals, /\.subtitle > span[\s\S]*color: #327600 !important/);
  assert.match(globals, /\.wpcf7-submit[\s\S]*background-color: #327600 !important/);
});

test("keeps captured service CTA text readable on the dark green surface", () => {
  assert.match(globals, /#main #content \.primary\.nut-xem-them1[\s\S]*color: #fff !important/);
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
    /#header li\.menu-item-design-container-width\.has-dropdown > \.nav-dropdown[\s\S]*?transition: opacity 160ms ease, transform 160ms ease, visibility 0s linear 160ms !important;/,
  );
  assert.match(
    globals,
    /#header li\.menu-item-design-container-width\.has-dropdown::after[\s\S]*?height: 16px;[\s\S]*?pointer-events: auto;/,
  );
  assert.match(
    globals,
    /#header li\.has-dropdown:hover > \.nav-dropdown[\s\S]*?transition: opacity 160ms ease, transform 160ms ease !important;/,
  );
});

test("closes a sibling desktop mega menu immediately on handoff", () => {
  assert.match(
    globals,
    /#header:has\(li\.has-dropdown:hover\)[\s\S]*?li\.menu-item-design-container-width\.has-dropdown:not\(:hover\) > \.nav-dropdown[\s\S]*?pointer-events: none !important;/,
  );
});

test("keeps the desktop service mega-menu content static like the source", () => {
  assert.match(
    globals,
    /#header li\.menu-item-design-container-width\.has-dropdown > \.nav-dropdown[\s\S]*?overflow-y: auto;/,
  );
  assert.match(
    globals,
    /#header \.clone-service-menu \.ux-menu-link__link[\s\S]*?transition: background-color 140ms ease, color 140ms ease, transform 140ms ease !important;/,
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

test("removes the legacy template-sale CTA from captured service pages", () => {
  const markup = '<main><a class="devvn_buy_now devvn_buy_now_style" href="#"><strong>Đặt mua mẫu web này</strong><span></span></a><p>Thông tin dịch vụ vẫn được giữ lại.</p></main>';
  const result = normalizeCapturedMarkup(markup);

  assert.doesNotMatch(result, /Đặt mua mẫu web này/i);
  assert.match(result, /Thông tin dịch vụ vẫn được giữ lại/);
});
