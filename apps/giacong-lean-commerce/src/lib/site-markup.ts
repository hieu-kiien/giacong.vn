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

  result = replaceFirstElementText(result, /<h1\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h1>/i, settings.hero_title);
  result = replaceFirstElementText(result, /<h3\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h3>/i, settings.hero_eyebrow);
  // The captured eyebrow is an h3 under an h1; promote it so the document
  // outline never skips a level (h1 → h3). First entry-title h3 only.
  result = result.replace(
    /<h3\b([^>]*class=(["'])[^"']*\bentry-title\b[^"']*\2[^>]*)>([\s\S]*?)<\/h3>/i,
    "<h2$1>$3</h2>",
  );
  result = replaceFirstElementText(result, /<h2\b[^>]*class=(["'])[^"']*\bentry-title\b[^"']*\1[^>]*>[\s\S]*?<\/h2>/i, settings.about_title);
  result = replaceHeroImage(result, settings.hero_image_url);
  result = replaceLogo(result, settings.logo_url);

  return result;
}

export function siteBrandStyles(settings: PublishedSiteSettings): string {
  const primary = safeColor(settings.primary_color, "#6cbe45");
  const accent = safeColor(settings.accent_color, "#bde875");
  return `:root{--giacong-primary:${primary};--giacong-accent:${accent}}.button.primary,.button.bg-primary{background-color:${primary}!important;border-color:${primary}!important}.button.primary:hover,.button.bg-primary:hover{filter:brightness(.92)}.button.is-outline:hover{background-color:${primary}!important;border-color:${primary}!important}.button.primary:focus-visible,.button.bg-primary:focus-visible,.button.is-outline:focus-visible{outline:2px solid ${primary};outline-offset:2px}.text-primary,.has-text-color{color:${primary}}`;
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