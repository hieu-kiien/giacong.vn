import assert from "node:assert/strict";
import test from "node:test";

const { applyHomepageSiteSettingsToMarkup, applySiteSettingsToMarkup } = await import("../src/lib/site-markup" + ".ts");

const heroMarkup = `<img
  class="hero-img"
  src="https://giacong.vn/wp-content/uploads/2024/gia-cong-thuc-pham.jpg"
  srcset="https://giacong.vn/wp-content/uploads/2024/gia-cong-thuc-pham.jpg 1024w, https://giacong.vn/wp-content/uploads/2024/hero-300x200.jpg 300w"
  sizes="(max-width: 600px) 300px, 1024px"
  alt="Gia công thực phẩm">`;

const footerMarkup = `<footer id="footer"><section class="section footer-section"><div class="icon-box-text last-reset"><p>Nội dung footer cũ.</p></div><ul class="text-info"><li><i class="fas fa-map-marker-alt"></i><strong>VP Hà Nội:</strong> 109 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội</li></ul></section><div class="copyright-footer">Copyright cũ</div></footer>`;
const headerMarkup = `<header><div class="flex-col logo" id="logo"><a href="/" rel="home"><img alt="Giacong.vn" class="header_logo" src="/logo.png" /></a></div></header>`;
const heroCtaMarkup = `<h3 class="entry-title">Eyebrow</h3><h1 class="entry-title">Hero</h1><a class="button primary nut-xem-them1" href="#"><span>Về chúng tôi</span></a><a class="button white nut-xem-them2" href="#"><span>Liên hệ ngay</span></a>`;
const homepageMarkup = `<section class="section section01" id="hero"><div><h3 class="entry-title">Old eyebrow</h3><h1 class="entry-title">Old hero</h1><p>Old hero description.</p><p>Captured secondary paragraph.</p></div></section><section class="section section02" id="about"><h2><span style="color: #5aa400;">Old about</span> title</h2><p>Old about description.</p><p>Captured closing paragraph.</p></section><section class="section section02" id="other"><h2>Do not change</h2><p>Do not change.</p></section>`;

const settings = (heroImageUrl) => ({
  about_title: "Giới thiệu",
  brand_name: "Giacong.vn",
  contact_email: "info@giacong.vn",
  contact_phone: "0947142999",
  contact_zalo_url: "",
  contact_messenger_url: "",
  contact_address: "VP Hà Nội: 108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội",
  footer_description: "Mô tả footer mặc định.",
  footer_copyright: "Copyright mặc định",
  hero_eyebrow: "Eyebrow",
  hero_description: "Hero description mặc định.",
  hero_image_url: heroImageUrl,
  hero_title: "Tiêu đề",
  logo_url: "",
  site_description: "",
  site_title: "Giacong.vn",
  about_description: "About description mặc định.",
});

test("replaces the hero src AND strips legacy srcset so the new image actually renders", () => {
  const result = applySiteSettingsToMarkup(heroMarkup, settings("https://media.example.test/hero-new.jpg"));

  assert.match(result, /src="https:\/\/media\.example\.test\/hero-new\.jpg"/);
  assert.doesNotMatch(result, /srcset=/, "stale srcset would win over src in the browser");
  assert.doesNotMatch(result, /giacong\.vn\/wp-content/, "legacy origin must be gone from the hero image");
  assert.match(result, /alt="Gia c[^"]*ng th[^"]*c ph[^"]*m"/);
});

test("keeps the original hero markup untouched when no custom image is set", () => {
  const result = applySiteSettingsToMarkup(heroMarkup, settings(""));

  assert.match(result, /srcset="https:\/\/giacong\.vn/);
});

test("applies published footer description, address and copyright without allowing markup injection", () => {
  const result = applySiteSettingsToMarkup(footerMarkup, {
    ...settings(""),
    contact_address: "VP Hà Nội: 108 Trần Hưng Đạo & <script>",
    footer_copyright: "Copyright <2026> & partners",
    footer_description: "Mô tả mới\nDòng thứ hai",
  });

  assert.match(result, /Mô tả mới<br \/>Dòng thứ hai/);
  assert.match(result, /<strong>VP Hà Nội:<\/strong> 108 Trần Hưng Đạo &amp; &lt;script&gt;/);
  assert.match(result, /Copyright &lt;2026&gt; &amp; partners/);
  assert.doesNotMatch(result, /<script>/);
});

test("applies the published brand tagline beside the captured logo safely", () => {
  const result = applySiteSettingsToMarkup(headerMarkup, {
    ...settings(""),
    brand_tagline: "Khẩu hiệu <QA>",
  });

  assert.match(result, /data-site-setting="brand_tagline"/);
  assert.match(result, /Khẩu hiệu &lt;QA&gt;/);
  assert.doesNotMatch(result, /<QA>/);
});

test("applies published hero CTA labels and URLs safely", () => {
  const result = applySiteSettingsToMarkup(heroCtaMarkup, {
    ...settings(""),
    hero_primary_cta_label: "Xem thêm <QA>",
    hero_primary_cta_url: "/gioi-thieu?from=<qa>",
    hero_secondary_cta_label: "Liên hệ & tư vấn",
    hero_secondary_cta_url: "https://example.test/contact?source=qa&x=1",
  });

  assert.match(result, /href="\/gioi-thieu\?from=&lt;qa&gt;"/);
  assert.match(result, /<span>Xem thêm &lt;QA&gt;<\/span>/);
  assert.match(result, /href="https:\/\/example\.test\/contact\?source=qa&amp;x=1"/);
  assert.match(result, /<span>Liên hệ &amp; tư vấn<\/span>/);
  assert.doesNotMatch(result, /<QA>/);
});

test("applies homepage-only descriptions and the real captured about heading", () => {
  const result = applyHomepageSiteSettingsToMarkup(homepageMarkup, {
    ...settings(""),
    about_title: "About <QA>",
    about_description: "About description & <QA>\nDòng hai",
    hero_description: "Hero description <QA>\nDòng hai",
  });

  assert.match(result, /<section class="section section01"[\s\S]*?<p>Hero description &lt;QA&gt;<br \/>Dòng hai<\/p>/);
  assert.match(result, /<p>Captured secondary paragraph\.<\/p>/);
  assert.match(result, /<section class="section section02" id="about"><h2>About &lt;QA&gt;<\/h2><p>About description &amp; &lt;QA&gt;<br \/>Dòng hai<\/p>/);
  assert.match(result, /<section class="section section02" id="other"><h2>Do not change<\/h2><p>Do not change\.<\/p><\/section>/);
  assert.doesNotMatch(result, /<QA>/);
});

test("keeps the hero heading hierarchy without misapplying the about title", () => {
  const heroThenEyebrow = '<h1 class="entry-title">Old hero</h1><h3 class="entry-title">Old eyebrow</h3><h2 class="entry-title">Old about</h2>';
  const heroThenEyebrowResult = applySiteSettingsToMarkup(heroThenEyebrow, settings(""));

  assert.match(heroThenEyebrowResult, /<h1 class="entry-title">Tiêu đề<\/h1>/);
  assert.match(heroThenEyebrowResult, /<h2 class="entry-title">Eyebrow<\/h2>/);
  assert.match(heroThenEyebrowResult, /<h2 class="entry-title">Giới thiệu<\/h2>/);
  assert.doesNotMatch(heroThenEyebrowResult, /<h3 class="entry-title">/);

  const sourceOrder = '<h3 class="entry-title">Old eyebrow</h3><h1 class="entry-title">Old hero</h1><h2 class="entry-title">Old about</h2>';
  const sourceOrderResult = applySiteSettingsToMarkup(sourceOrder, settings(""));

  assert.match(sourceOrderResult, /<h3 class="entry-title">Eyebrow<\/h3>/);
  assert.match(sourceOrderResult, /<h1 class="entry-title">Tiêu đề<\/h1>/);
  assert.match(sourceOrderResult, /<h2 class="entry-title">Giới thiệu<\/h2>/);
  assert.doesNotMatch(sourceOrderResult, /<h2 class="entry-title">Eyebrow<\/h2>/);
});
