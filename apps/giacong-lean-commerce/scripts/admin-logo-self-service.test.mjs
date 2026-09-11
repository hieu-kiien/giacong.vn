import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { applySiteSettingsToMarkup } = await import("../src/lib/site-markup.ts");

const settings = {
  about_description: "About",
  about_title: "About",
  accent_color: "#bde875",
  brand_name: "Giacong.vn",
  brand_tagline: "Tagline",
  contact_address: "Address",
  contact_email: "info@giacong.vn",
  contact_messenger_url: "",
  contact_phone: "0947142999",
  contact_zalo_url: "",
  favicon_url: "",
  footer_copyright: "Copyright",
  footer_description: "Footer",
  hero_description: "Hero",
  hero_eyebrow: "Eyebrow",
  hero_image_url: "",
  hero_primary_cta_label: "Primary",
  hero_primary_cta_url: "/",
  hero_secondary_cta_label: "Secondary",
  hero_secondary_cta_url: "/",
  hero_title: "Hero",
  logo_url: "",
  logo_dark_url: "",
  primary_color: "#6cbe45",
  site_description: "Description",
  site_title: "Title",
};

const markup = `
  <header>
    <div id="logo"><a href="/"><img class="header_logo header-logo" src="/legacy-light.png"><img class="header-logo-dark" src="/legacy-dark.png"></a></div>
  </header>
  <footer><section class="section footer-section"><div class="icon-box featured-box"><div class="icon-box-img"><img class="attachment-medium size-medium" src="https://giacong.vn/wp-content/uploads/2024/10/logo-gia-cong-new-300x85.png" srcset="https://giacong.vn/wp-content/uploads/2024/10/logo-gia-cong-new-300x85.png 300w, https://giacong.vn/wp-content/uploads/2024/10/logo-gia-cong-new.png 481w"></div></div></section></footer>
`;

test("published light/dark logos replace their own header targets and light logo replaces footer", () => {
  const result = applySiteSettingsToMarkup(markup, {
    ...settings,
    logo_url: "https://media.example.test/logo-light.png",
    logo_dark_url: "https://media.example.test/logo-dark.png",
  });

  assert.match(result, /class="header_logo header-logo" src="https:\/\/media\.example\.test\/logo-light\.png"/);
  assert.match(result, /class="header-logo-dark" src="https:\/\/media\.example\.test\/logo-dark\.png"/);
  assert.match(result, /icon-box-img[\s\S]*src="https:\/\/media\.example\.test\/logo-light\.png"/);
  assert.doesNotMatch(result, /logo-gia-cong-new/);
  assert.doesNotMatch(result, /srcset=/);
});

test("empty dark logo falls back to the published light logo, while favicon stays separate", () => {
  const result = applySiteSettingsToMarkup(markup, {
    ...settings,
    favicon_url: "https://media.example.test/favicon.ico",
    logo_url: "https://media.example.test/logo-light.png",
    logo_dark_url: "",
  });

  assert.equal((result.match(/src="https:\/\/media\.example\.test\/logo-light\.png"/g) ?? []).length, 3);
  assert.doesNotMatch(result, /favicon\.ico/);
});

test("empty logo setting preserves the captured header and footer defaults", () => {
  const result = applySiteSettingsToMarkup(markup, settings);

  assert.match(result, /src="\/legacy-light\.png"/);
  assert.match(result, /src="\/legacy-dark\.png"/);
  assert.match(result, /logo-gia-cong-new-300x85\.png/);
});

test("admin image settings expose an aspect-preserving preview and keep logo/favicon distinct", async () => {
  const page = await readFile(new URL("../src/app/admin/noi-dung/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles/admin.css", import.meta.url), "utf8");
  const settingsSource = await readFile(new URL("../src/lib/site-settings.ts", import.meta.url), "utf8");
  const mediaRoute = await readFile(new URL("../src/app/api/admin/site-settings/media/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/0020_site_setting_dark_logo.sql", import.meta.url), "utf8");

  assert.match(page, /setting-preview-\$\{setting\.key\}/);
  assert.match(page, /admin-setting-image-preview/);
  assert.match(styles, /\.admin-setting-image-preview[\s\S]*object-fit:\s*contain/);
  assert.match(settingsSource, /key: "logo_url"[\s\S]*label: "Logo sáng"/);
  assert.match(settingsSource, /key: "logo_dark_url"[\s\S]*label: "Logo tối"/);
  assert.match(settingsSource, /key: "favicon_url"[\s\S]*label: "Favicon"/);
  assert.match(mediaRoute, /logo_dark_url/);
  assert.match(migration, /'logo_dark_url'/);
});
