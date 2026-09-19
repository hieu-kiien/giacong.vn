import assert from "node:assert/strict";
import test from "node:test";

const { applyHomepageSiteSettingsToMarkup, applySiteSettingsToMarkup } = await import("../src/lib/site-markup" + ".ts");
const { optimizeHomepageResponsiveImages } = await import("../src/lib/homepage-image-optimization" + ".ts");

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
  const result = applyHomepageSiteSettingsToMarkup(heroMarkup, settings("https://media.example.test/hero-new.jpg"));

  assert.match(result, /src="https:\/\/media\.example\.test\/hero-new\.jpg"/);
  assert.doesNotMatch(result, /srcset=/, "stale srcset would win over src in the browser");
  assert.doesNotMatch(result, /giacong\.vn\/wp-content/, "legacy origin must be gone from the hero image");
  assert.match(result, /alt="Gia c[^"]*ng th[^"]*c ph[^"]*m"/);
});

test("keeps the original hero markup untouched when no custom image is set", () => {
  const result = applyHomepageSiteSettingsToMarkup(heroMarkup, settings(""));

  assert.match(result, /srcset="https:\/\/giacong\.vn/);
});

test("serves captured homepage images with viewport-sized local candidates", () => {
  const markup = `
    <img class="header_logo header-logo" src="/images/home-captured/header-logo.webp" width="1020" height="290" />
    <img class="header-logo-dark" src="/images/home-captured/header-logo.webp" width="1020" height="290" />
    <img class="lazy-load" src="/images/home-captured/img-sp-1.webp" srcset="/images/home-captured/img-sp-1.webp 728w" />
    <img class="lazy-load" src="/images/home-captured/IMG.webp" srcset="/images/home-captured/IMG.webp 863w" />
  `;

  const result = optimizeHomepageResponsiveImages(markup);

  assert.match(result, /src="\/images\/home-captured\/header-logo-350\.webp"/);
  assert.match(result, /srcset="\/images\/home-captured\/header-logo-200\.webp 200w, \/images\/home-captured\/header-logo-350\.webp 350w, \/images\/home-captured\/header-logo\.webp 512w"/);
  assert.match(result, /sizes="\(max-width: 849px\) 200px, 350px"/);
  assert.match(result, /srcset="\/images\/home-captured\/img-sp-1-300x185\.webp 300w, \/images\/home-captured\/img-sp-1-400x247\.webp 400w, \/images\/home-captured\/img-sp-1-510x315\.webp 510w, \/images\/home-captured\/img-sp-1-600x371\.webp 600w, \/images\/home-captured\/img-sp-1-640x395\.webp 640w, \/images\/home-captured\/img-sp-1\.webp 728w"/);
  assert.match(result, /srcset="\/images\/home-captured\/IMG-300x255\.webp 300w, \/images\/home-captured\/IMG-400x340\.webp 400w, \/images\/home-captured\/IMG-510x433\.webp 510w, \/images\/home-captured\/IMG-680x578\.webp 680w, \/images\/home-captured\/IMG-768x652\.webp 768w, \/images\/home-captured\/IMG\.webp 863w"/);
  assert.match(result, /sizes="\(max-width: 549px\) calc\(100vw - 36px\), \(max-width: 849px\) 400px, calc\(50vw - 90px\)"/);
});

test("does not rewrite unrelated captured images", () => {
  const markup = '<img src="/images/home-captured/news.webp" alt="Tin tức" />';

  assert.equal(optimizeHomepageResponsiveImages(markup), markup);
});

test("keeps a published custom logo intact", () => {
  const markup = '<img class="header_logo header-logo" src="https://cdn.example.test/custom-logo.webp" alt="Custom logo" />';

  assert.equal(optimizeHomepageResponsiveImages(markup), markup);
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

test("switches the captured brand and every managed logo surface together", () => {
  const markup = `
    <header><div class="flex-col logo" id="logo"><a href="/" title="Giacong.vn trang chủ">
      <img class="header_logo" src="/legacy-light.png" alt="Giacong.vn" />
      <img class="header-logo-dark" src="/legacy-dark.png" alt="GIACONG.VN" />
    </a></div></header>
    <main><h1>Giacong.vn cung cấp</h1><p>Giacong.vn giúp doanh nghiệp.</p>
      <iframe title="Bản đồ vị trí Giacong.vn"></iframe>
      <a href="mailto:info@giacong.vn">info@giacong.vn</a>
      <p>qtu1053@gmail.com</p><p>Website: https://giacong.vn</p>
    </main>
    <footer><section class="footer-section"><div class="icon-box"><div class="icon-box-img"><img src="/legacy-footer.png" alt="Giacong.vn" /></div><div class="icon-box-text"><p>Cũ</p></div></div></section></footer>`;
  const result = applySiteSettingsToMarkup(markup, {
    ...settings(""),
    brand_name: "kienhieu",
    contact_email: "contact@kienhieu.id.vn",
    logo_url: "/images/brand/kienhieu-logo.svg",
    logo_dark_url: "/images/brand/kienhieu-logo-dark.svg",
  });

  assert.match(result, /src="\/images\/brand\/kienhieu-logo\.svg"[^>]*alt="kienhieu"/);
  assert.match(result, /src="\/images\/brand\/kienhieu-logo-dark\.svg"[^>]*alt="kienhieu"/);
  assert.match(result, /footer-section[\s\S]*src="\/images\/brand\/kienhieu-logo\.svg"[^>]*alt="kienhieu"/);
  assert.match(result, /title="kienhieu trang chủ"/);
  assert.match(result, /Bản đồ vị trí kienhieu/);
  assert.match(result, /mailto:contact@kienhieu\.id\.vn/);
  assert.match(result, /contact@kienhieu\.id\.vn/);
  assert.match(result, /Website: https:\/\/kienhieu\.id\.vn/);
  assert.doesNotMatch(result, /Giacong\.vn|GIACONG\.VN|info@giacong\.vn|qtu1053@gmail\.com/);
});

test("applies published hero CTA labels and URLs safely", () => {
  const result = applyHomepageSiteSettingsToMarkup(heroCtaMarkup, {
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
  const heroThenEyebrowResult = applyHomepageSiteSettingsToMarkup(heroThenEyebrow, settings(""));

  assert.match(heroThenEyebrowResult, /<h1 class="entry-title">Tiêu đề<\/h1>/);
  assert.match(heroThenEyebrowResult, /<h2 class="entry-title">Eyebrow<\/h2>/);
  assert.match(heroThenEyebrowResult, /<h2 class="entry-title">Giới thiệu<\/h2>/);
  assert.doesNotMatch(heroThenEyebrowResult, /<h3 class="entry-title">/);

  const sourceOrder = '<h3 class="entry-title">Old eyebrow</h3><h1 class="entry-title">Old hero</h1><h2 class="entry-title">Old about</h2>';
  const sourceOrderResult = applyHomepageSiteSettingsToMarkup(sourceOrder, settings(""));

  assert.match(sourceOrderResult, /<h3 class="entry-title">Eyebrow<\/h3>/);
  assert.match(sourceOrderResult, /<h1 class="entry-title">Tiêu đề<\/h1>/);
  assert.match(sourceOrderResult, /<h2 class="entry-title">Giới thiệu<\/h2>/);
  assert.doesNotMatch(sourceOrderResult, /<h2 class="entry-title">Eyebrow<\/h2>/);
});

test("applies managed contact address and phone to the legacy company-info block", () => {
  const contactMarkup = '<h3>Thông tin công ty</h3><ul><li>Địa chỉ: 108 Lê Duẩn – Đống Đa – Hà Nội</li><li>Điện thoại: 0938.591.444</li><li>Email: info@giacong.vn</li></ul>';
  const result = applySiteSettingsToMarkup(contactMarkup, {
    ...settings(""),
    contact_address: "VP Hà Nội: 108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội",
    contact_phone: "0900000001",
  });

  assert.doesNotMatch(result, /Lê Duẩn/);
  assert.doesNotMatch(result, /0938\.591\.444/);
  assert.match(result, /Địa chỉ: 108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội/);
  assert.match(result, /Điện thoại: 0900000001/);
});

test("keeps legacy company-info block untouched when contact settings are empty", () => {
  const contactMarkup = '<h3>Thông tin công ty</h3><ul><li>Địa chỉ: 108 Lê Duẩn – Đống Đa – Hà Nội</li><li>Điện thoại: 0938.591.444</li></ul>';
  const result = applySiteSettingsToMarkup(contactMarkup, {
    ...settings(""),
    contact_address: "",
    contact_phone: "",
  });

  assert.match(result, /Lê Duẩn/);
  assert.match(result, /0938\.591\.444/);
});

test("does not apply homepage hero settings to a captured service page", () => {
  const result = applySiteSettingsToMarkup(
    '<h1 class="entry-title">Gia Công Sốt Bơ Đậu Phộng</h1><p>Nội dung dịch vụ.</p>',
    settings(""),
  );

  assert.match(result, /<h1 class="entry-title">Gia Công Sốt Bơ Đậu Phộng<\/h1>/);
  assert.doesNotMatch(result, /Tiêu đề/);
});
