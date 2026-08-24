import assert from "node:assert/strict";
import test from "node:test";

const { applySiteSettingsToMarkup } = await import("../src/lib/site-markup" + ".ts");

const heroMarkup = `<img
  class="hero-img"
  src="https://giacong.vn/wp-content/uploads/2024/gia-cong-thuc-pham.jpg"
  srcset="https://giacong.vn/wp-content/uploads/2024/gia-cong-thuc-pham.jpg 1024w, https://giacong.vn/wp-content/uploads/2024/hero-300x200.jpg 300w"
  sizes="(max-width: 600px) 300px, 1024px"
  alt="Gia công thực phẩm">`;

const settings = (heroImageUrl) => ({
  about_title: "Giới thiệu",
  brand_name: "Giacong.vn",
  contact_email: "info@giacong.vn",
  contact_phone: "0947142999",
  contact_zalo_url: "",
  contact_messenger_url: "",
  hero_eyebrow: "Eyebrow",
  hero_image_url: heroImageUrl,
  hero_title: "Tiêu đề",
  logo_url: "",
  site_description: "",
  site_title: "Giacong.vn",
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
