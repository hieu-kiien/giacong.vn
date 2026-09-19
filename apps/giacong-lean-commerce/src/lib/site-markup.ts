import type { PublishedSiteSettings } from "./site-settings";
import { PUBLIC_SITE_ORIGIN } from "./seo.ts";

interface SiteMarkupOptions {
  /** Apply fields that belong only to the captured homepage hero. */
  applyHomepageContent?: boolean;
}

export function applySiteSettingsToMarkup(
  markup: string,
  settings: PublishedSiteSettings,
  options: SiteMarkupOptions = {},
): string {
  let   result = markup;
  const brandName = escapeHtml(settings.brand_name);
  const email = escapeHtml(settings.contact_email);
  const phone = escapeHtml(settings.contact_phone);
  const phoneHref = escapeAttr(`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`);
  const zalo = escapeAttr(settings.contact_zalo_url);
  const messenger = escapeAttr(settings.contact_messenger_url);

  // Empty settings never erase captured content; the sanitizer falls back to
  // defaults, but an explicitly cleared value must still keep the old text.
  if (email) {
    result = result.replace(/(?:info@giacong\.vn|qtu1053@gmail\.com)/gi, email);
    result = result.replace(/href=(["'])mailto:[^"']*\1/gi, `href="${
      escapeAttr(`mailto:${settings.contact_email}`)
    }"`);
  }
  if (phone) {
    result = result.replace(/href=(["'])tel:[^"']*\1/gi, `href="${phoneHref}"`);
    result = result.replace(/0947142999/g, phone);
  }
  if (settings.contact_zalo_url) result = result.replace(/https:\/\/zalo\.me\/[^"' ]+/gi, zalo);
  if (settings.contact_messenger_url) result = result.replace(/https:\/\/m\.me\/[^"' ]+/gi, messenger);
  result = replaceFooterDescription(result, settings.footer_description);
  result = replaceFooterAddress(result, settings.contact_address);
  result = replaceFooterCopyright(result, settings.footer_copyright);
  result = replaceContactInfo(result, settings);
  if (brandName) result = replaceLegacyBrandTokens(result, brandName);

  if (options.applyHomepageContent === true) {
    result = replaceFirstElementText(result, /<h1\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h1>/i, settings.hero_title);
    result = replaceFirstElementText(result, /<h3\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h3>/i, settings.hero_eyebrow);
    result = replaceFirstElementText(result, /<h2\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h2>/i, settings.about_title);
    // The captured eyebrow is an h3 under an h1; promote it so the document
    // outline never skips a level (h1 → h3). First entry-title h3 only.
    result = promoteHeroEyebrowAfterHeroTitle(result);
    result = replaceHeroImage(result, settings.hero_image_url);
    result = replaceHeroCta(result, "nut-xem-them1", settings.hero_primary_cta_label, settings.hero_primary_cta_url);
    result = replaceHeroCta(result, "nut-xem-them2", settings.hero_secondary_cta_label, settings.hero_secondary_cta_url);
  }
  result = replaceLogo(result, settings.logo_url, settings.logo_dark_url, brandName);
  result = replaceBrandTagline(result, settings.brand_tagline);

  return result;
}

/**
 * Applies the homepage-only fields to the captured homepage. Keeping these
 * selectors here, behind an explicit homepage adapter, prevents a generic
 * captured route from treating its first paragraph or section heading as the
 * homepage content.
 */
export function applyHomepageSiteSettingsToMarkup(markup: string, settings: PublishedSiteSettings): string {
  let result = applySiteSettingsToMarkup(markup, settings, { applyHomepageContent: true });
  result = replaceHomepageSectionElementText(result, "section01", "p", settings.hero_description, escapeTextWithBreaks);
  result = replaceHomepageSectionElementText(result, "section02", "h2", settings.about_title, escapeHtml);
  result = replaceHomepageSectionElementText(result, "section02", "p", settings.about_description, escapeTextWithBreaks);
  return result;
}

function replaceBrandTagline(markup: string, value: string): string {
  const tagline = typeof value === "string" ? value.trim() : "";
  if (!tagline) return markup;

  const logoPattern = /(<div\b[^>]*\bid=(['"])logo\2[^>]*>[\s\S]*?<\/a>)(\s*<\/div>)/i;
  return markup.replace(
    logoPattern,
    (_match, opening: string, _quote: string, closing: string) =>
      `${opening}<span class="giacong-brand-tagline" data-site-setting="brand_tagline">${escapeHtml(tagline)}</span>${closing}`,
  );
}

function replaceHomepageSectionElementText(
  markup: string,
  sectionClass: string,
  element: "h2" | "p",
  value: string,
  format: (value: string) => string,
): string {
  const nextValue = typeof value === "string" ? value.trim() : "";
  if (!nextValue) return markup;

  const sectionPattern = new RegExp(
    `(<section\\b(?=[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escapeRegExp(sectionClass)}\\b[^"']*["'])[^>]*>)([\\s\\S]*?)(</section>)`,
    "i",
  );
  return markup.replace(sectionPattern, (_match, opening: string, content: string, closing: string) => {
    const elementPattern = new RegExp(`(<${element}\\b[^>]*>)[\\s\\S]*?(</${element}>)`, "i");
    const updatedContent = content.replace(
      elementPattern,
      (_elementMatch, elementOpening: string, elementClosing: string) =>
        `${elementOpening}${format(nextValue)}${elementClosing}`,
    );
    return `${opening}${updatedContent}${closing}`;
  });
}

function replaceHeroCta(markup: string, className: string, label: string, href: string): string {
  const ctaPattern = new RegExp(
    `<a\\b(?=[^>]*\\bclass=(['"])[^'"]*\\b${escapeRegExp(className)}\\b[^'"]*\\1)[^>]*>[\\s\\S]*?<\\/a>`,
    "i",
  );
  const match = ctaPattern.exec(markup);
  if (!match || match.index === undefined) return markup;

  const nextLabel = typeof label === "string" ? label.trim() : "";
  const nextHref = typeof href === "string" ? href.trim() : "";
  let updated = match[0];
  if (nextHref) {
    updated = updated.replace(/\bhref=(['"])[^'"]*\1/i, `href="${escapeAttr(nextHref)}"`);
  }
  if (nextLabel) {
    updated = updated.replace(
      /(<span\b[^>]*>)[\s\S]*?(<\/span>)/i,
      (_match, opening: string, closing: string) => `${opening}${escapeHtml(nextLabel)}${closing}`,
    );
  }

  return `${markup.slice(0, match.index)}${updated}${markup.slice(match.index + match[0].length)}`;
}

function promoteHeroEyebrowAfterHeroTitle(markup: string): string {
  const hero = /<h1\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h1>/i.exec(markup);
  const eyebrow = /<h3\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h3>/i.exec(markup);
  if (!hero || !eyebrow || hero.index === undefined || eyebrow.index === undefined || eyebrow.index < hero.index) {
    return markup;
  }

  const original = eyebrow[0];
  const openingEnd = original.indexOf(">");
  const closingStart = original.lastIndexOf("</");
  if (openingEnd < 0 || closingStart <= openingEnd) return markup;
  const promoted = "<h2" + original.slice(3, openingEnd) + ">" +
    original.slice(openingEnd + 1, closingStart) + "</h2>";
  return markup.slice(0, eyebrow.index) + promoted + markup.slice(eyebrow.index + original.length);
}

export function siteBrandStyles(settings: PublishedSiteSettings): string {
  const primary = safeColor(settings.primary_color, "#6cbe45");
  const accent = safeColor(settings.accent_color, "#bde875");
  return `:root{--giacong-primary:${primary};--giacong-accent:${accent}}.button.primary,.button.bg-primary{background-color:${primary}!important;border-color:${primary}!important}.button.primary:hover,.button.bg-primary:hover{filter:brightness(.92)}.button.is-outline:hover{background-color:${primary}!important;border-color:${primary}!important}.button.primary:focus-visible,.button.bg-primary:focus-visible,.button.is-outline:focus-visible{outline:2px solid ${primary};outline-offset:2px}.text-primary,.has-text-color{color:${primary}}.giacong-brand-tagline{display:block;max-width:260px;margin:3px auto 0;color:inherit;font-size:10px;font-weight:500;letter-spacing:.06em;line-height:1.2;overflow-wrap:anywhere;text-align:center;text-transform:none}`;
}

function replaceFirstElementText(markup: string, pattern: RegExp, value: string): string {
  const match = pattern.exec(markup);
  if (!match || match.index === undefined) return markup;
  const original = match[0];
  const openingEnd = original.indexOf(">") + 1;
  const closingStart = original.lastIndexOf("</");
  if (openingEnd <= 0 || closingStart < openingEnd) return markup;
  return `${markup.slice(0, match.index)}${original.slice(0, openingEnd)}${escapeHtml(value)}${original.slice(closingStart)}${markup.slice(match.index + original.length)}`;
}

function replaceHeroImage(markup: string, imageUrl: string): string {
  if (!imageUrl) return markup;
  const safe = escapeAttr(imageUrl);
  const heroImage = /<img\b[^>]*\b(?:gia-cong-thuc-pham|hero)[^>]*>/i;
  const match = heroImage.exec(markup);
  if (!match) return markup;
  // The captured hero <img> carries src, srcset and sizes; the browser prefers
  // srcset, so all responsive attributes must go when a custom image is set.
  const updated = match[0]
    .replace(/\ssrcset=(["'])[^"']*\1/gi, "")
    .replace(/\ssizes=(["'])[^"']*\1/gi, "")
    .replace(/\ssrc=(["'])[^"']*\1/i, ` src="${safe}"`);
  return `${markup.slice(0, match.index)}${updated}${markup.slice(match.index + match[0].length)}`;
}

function replaceLogo(markup: string, logoUrl: string, darkLogoUrl: string, brandName: string): string {
  const light = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const dark = (typeof darkLogoUrl === "string" ? darkLogoUrl.trim() : "") || light;
  if (!light && !dark) return markup;
  let result = markup;
  if (light) {
    result = result.replace(/<img\b[^>]*class=(['"])[^"']*\bheader_logo\b[^"']*\1[^>]*>/gi, (image) => replaceManagedImageSource(image, escapeAttr(light), brandName));
  }
  if (dark) {
    result = result.replace(/<img\b[^>]*class=(['"])[^"']*\bheader-logo-dark\b[^"']*\1[^>]*>/gi, (image) => replaceManagedImageSource(image, escapeAttr(dark), brandName));
  }

  // The captured footer has a dedicated logo image inside `.icon-box-img`,
  // separate from the header's light/dark pair. Keep it on the same canonical
  // logo setting so desktop, mobile, header and footer cannot drift apart.
  return light ? result.replace(
    /(<footer\b[\s\S]*?<[^>]*class=(['"])[^"']*\bfooter-section\b[^"']*\2[\s\S]*?<[^>]*class=(['"])[^"']*\bicon-box\b[^"']*\3[\s\S]*?<[^>]*class=(['"])[^"']*\bicon-box-img\b[^"']*\4[\s\S]*?)(<img\b[^>]*>)/i,
    (_match, before: string, _footerQuote: string, _iconQuote: string, _imageBoxQuote: string, image: string) => `${before}${replaceManagedImageSource(image, escapeAttr(light), brandName)}`,
  ) : result;
}

function replaceManagedImageSource(image: string, safeUrl: string, safeAlt: string): string {
  let result = image
    .replace(/\s(?:srcset|sizes)=(['"])[^"']*\1/gi, "")
    .replace(/\ssrc=(['"])[^"']*\1/i, ` src="${safeUrl}"`);
  if (!/\ssrc=/i.test(result)) result = result.replace(/<img\b/i, `<img src="${safeUrl}"`);
  if (safeAlt) {
    result = /\salt=(['"])[^"']*\1/i.test(result)
      ? result.replace(/\salt=(['"])[^"']*\1/i, ` alt="${safeAlt}"`)
      : result.replace(/<img\b/i, `<img alt="${safeAlt}"`);
  }
  return result;
}

function replaceLegacyBrandTokens(markup: string, safeBrandName: string): string {
  const protectedUrls: string[] = [];
  const withCurrentOrigin = markup.replace(/(?:https?:)?\/\/(?:www\.)?giacong\.vn[^\s"'<>)]*/gi, (url) => {
    if (/(?:https?:)?\/\/(?:www\.)?giacong\.vn$/i.test(url)) return PUBLIC_SITE_ORIGIN;
    const token = `__legacy_brand_url_${protectedUrls.length}__`;
    protectedUrls.push(url);
    return token;
  });
  let replaced = withCurrentOrigin.replace(/\bgiacong\.vn\b/gi, safeBrandName);
  replaced = replaced
    .replace(/Zalo:\s*\/giacong\b/gi, () => `Zalo: ${safeBrandName}`)
    .replace(/\bgiacong\.page\b/gi, () => `${safeBrandName} Fanpage`)
    .replace(/\bgiacong\.tele\b/gi, () => `${safeBrandName} Telegram`);
  return protectedUrls.reduce(
    (result, url, index) => result.replace(`__legacy_brand_url_${index}__`, url),
    replaced,
  );
}

function replaceFooterDescription(markup: string, value: string): string {
  if (!value) return markup;
  const pattern = /(<footer\b[\s\S]*?<[^>]*class=["'][^"']*\bfooter-section\b[^"']*["'][\s\S]*?<[^>]*class=["'][^"']*\bicon-box-text\b[^"']*["'][\s\S]*?<p\b[^>]*>)[\s\S]*?(<\/p>)/i;
  return markup.replace(pattern, (_match, opening: string, closing: string) => `${opening}${escapeTextWithBreaks(value)}${closing}`);
}

function replaceFooterAddress(markup: string, value: string): string {
  if (!value) return markup;
  const address = value.replace(/^\s*VP\s*Hà\s*Nội\s*:\s*/i, "").trim();
  if (!address) return markup;
  const pattern = /(<footer\b[\s\S]*?<ul\b[^>]*class=["'][^"']*\btext-info\b[^"']*["'][\s\S]*?<li\b[^>]*>[\s\S]*?<strong>VP\s*Hà\s*Nội:\s*<\/strong>)[\s\S]*?(<\/li>)/i;
  return markup.replace(pattern, (_match, opening: string, closing: string) => `${opening} ${escapeHtml(address)}${closing}`);
}

function replaceFooterCopyright(markup: string, value: string): string {
  if (!value) return markup;
  const pattern = /(<div\b[^>]*class=["'][^"']*\bcopyright-footer\b[^"']*["'][^>]*>)[\s\S]*?(<\/div>)/i;
  return markup.replace(pattern, (_match, opening: string, closing: string) => `${opening}${escapeHtml(value)}${closing}`);
}

/**
 * Applies the managed contact address/phone to legacy company-info blocks
 * (e.g. the lien-he "Thông tin công ty" section) that live outside <footer>.
 * The old captured strings exist only in the legacy capture, so pages without
 * them are returned byte-identical. Empty settings never erase content.
 */
function replaceContactInfo(markup: string, settings: PublishedSiteSettings): string {
  let result = markup;
  const address = typeof settings.contact_address === "string"
    ? settings.contact_address.replace(/^\s*VP\s*Hà\s*Nội\s*:\s*/i, "").trim()
    : "";
  if (address) {
    result = result.split("108 Lê Duẩn – Đống Đa – Hà Nội").join(escapeHtml(address));
  }
  const phone = typeof settings.contact_phone === "string" ? settings.contact_phone.trim() : "";
  if (phone) {
    result = result.split("0938.591.444").join(escapeHtml(phone));
  }
  return result;
}

function escapeTextWithBreaks(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
