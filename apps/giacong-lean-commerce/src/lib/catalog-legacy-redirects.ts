interface LegacyProductRedirect {
  parentSlug: string;
  variantSku: string;
}

export const legacyProductRedirects: Readonly<Record<string, LegacyProductRedirect>> = {
};

/**
 * Demo catalog parents were removed from the current D1 feed. Keep their old
 * URLs recoverable by redirecting them to the live catalog, never to a
 * fabricated parent/variant page that ends in a 404.
 */
export const retiredLegacyProductSlugs: ReadonlySet<string> = new Set([
  "b2b-demo-bot-dinh-duong",
  "b2b-demo-bot-dinh-duong-vi-vani",
  "b2b-demo-bot-dinh-duong-vi-it-ngot",
  "b2b-demo-thuc-uong-dinh-duong",
  "b2b-demo-thuc-uong-dinh-duong-lua-mach",
  "b2b-demo-sua-hat-pha-san",
  "b2b-demo-ngu-coc-dinh-duong",
  "b2b-demo-ngu-coc-dinh-duong-hat",
  "b2b-demo-bot-yen-mach-hoa-tan",
]);

export function getRetiredLegacyProductRedirect(url: URL): string | null {
  const match = /^\/san-pham\/([^/]+)\/?$/.exec(url.pathname);
  if (!match?.[1]) return null;

  let slug: string;
  try {
    slug = decodeURIComponent(match[1]).trim();
  } catch {
    return null;
  }

  return retiredLegacyProductSlugs.has(slug)
    ? new URL("/san-pham/", url).toString()
    : null;
}
