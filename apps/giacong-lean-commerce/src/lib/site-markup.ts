import type { PublishedSiteSettings } from "./site-settings";

export function applySiteSettingsToMarkup(markup: string, settings: PublishedSiteSettings): string {
  let result = markup;
  const brandName = escapeHtml(settings.brand_name);
  const email = escapeHtml(settings.contact_email);
  const phone = escapeHtml(settings.contact_phone);
  const phoneHref = escapeAttr(`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`);
  const zalo = escapeAttr(settings.contact_zalo_url);
  const messenger = escapeAttr(settings.contact_messenger_url);

  result = result.replace(/Giacong\.vn/g, brandName);
  result = result.replace(/info@giacong\.vn/gi, email);
  result = result.replace(/href=(["'])mailto:[^"']*\1/gi, `href="${
    escapeAttr(`mailto:${settings.contact_email}`)
  }"`);
  result = result.replace(/href=(["'])tel:[^"']*\1/gi, `href="${phoneHref}"`);
  result = result.replace(/0947142999/g, phone);
  if (settings.contact_zalo_url) result = result.replace(/https:\/\/zalo\.me\/[^"' ]+/gi, zalo);
  if (settings.contact_messenger_url) result = result.replace(/https:\/\/m\.me\/[^"' ]+/gi, messenger);
  result = replaceFooterDescription(result, settings.footer_description);
  result = replaceFooterAddress(result, settings.contact_address);
  result = replaceFooterCopyright(result, settings.footer_copyright);

  result = replaceFirstElementText(result, /<h1\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h1>/i, settings.hero_title);
  result = replaceFirstElementText(result, /<h3\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h3>/i, settings.hero_eyebrow);
  result = replaceFirstElementText(result, /<h2\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h2>/i, settings.about_title);
  // The captured eyebrow is an h3 under an h1; promote it so the document
  // outline never skips a level (h1 → h3). First entry-title h3 only.
  result = promoteHeroEyebrowAfterHeroTitle(result);
  result = replaceHeroImage(result, settings.hero_image_url);
  result = replaceLogo(result, settings.logo_url);
  result = replaceBrandTagline(result, settings.brand_tagline);

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

function replaceLogo(markup: string, logoUrl: string): string {
  if (!logoUrl) return markup;
  const safe = escapeAttr(logoUrl);
  return markup
    .replace(/(<img\b[^>]*class=(["'])[^"']*header_logo[^"']*\2[^>]*\s)src=(["'])[^"']*\3/gi, `$1src="${
      safe
    }"`)
    .replace(/\ssrcset=(["'])https:\/\/giacong\.vn\/[^"']*\1/gi, ` srcset="${safe}"`);
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

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
