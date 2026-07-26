import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import { getCatalogCategories } from "@/lib/bagisto-catalog";
import { normalizeCapturedMarkup } from "@/lib/captured-markup";
import type { CapturedPageData } from "@/types/captured-page";
import type { CatalogCategory } from "@/types/catalog";

export interface CatalogChromeData {
  bodyClasses: string;
  htmlClasses: string;
  pageStyles: string;
  footerMarkup: string;
}

/**
 * Only the captured footer and its styles survive here. The captured header is
 * replaced by `StorefrontHeader`, and the markup after the footer is dropped
 * outright: it held a duplicate mobile sidebar plus a WooCommerce login form with
 * a stale nonce, and V1 has no customer accounts.
 */
export const getCatalogChrome = cache(async (): Promise<CatalogChromeData> => {
  const filePath = path.join(process.cwd(), "src", "data", "pages", "san-pham.json");
  const source = JSON.parse(await readFile(filePath, "utf8")) as CapturedPageData;
  const markup = normalizeCapturedMarkup(source.markup);

  return {
    bodyClasses: source.bodyClasses,
    htmlClasses: source.htmlClasses,
    pageStyles: source.pageStyles,
    footerMarkup: extractElement(markup, "footer"),
  };
});

/**
 * Categories for the chrome navigation only. Navigation is not the content of any
 * route, so an unavailable or malformed category feed degrades the menu to its
 * "đang được cập nhật" state instead of failing the page around it — that also
 * keeps statically prerendered content routes buildable without a live Bagisto.
 * `/san-pham` still calls `getCatalogCategories` directly and stays strict.
 */
export async function getStorefrontNavCategories(): Promise<CatalogCategory[]> {
  try {
    return await getCatalogCategories();
  } catch {
    return [];
  }
}

function extractElement(markup: string, tagName: string): string {
  const start = markup.indexOf(`<${tagName}`);
  const closeTag = `</${tagName}>`;
  const end = markup.indexOf(closeTag, start);
  if (start < 0 || end < 0) throw new Error(`Không tìm thấy ${tagName} trong giao diện đã chụp.`);
  return markup.slice(start, end + closeTag.length);
}
