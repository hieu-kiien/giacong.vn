import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import type { CapturedPageData } from "@/types/captured-page";

export interface CatalogChromeData {
  bodyClasses: string;
  htmlClasses: string;
  pageStyles: string;
  headerMarkup: string;
  footerMarkup: string;
  trailingMarkup: string;
}

export const getCatalogChrome = cache(async (): Promise<CatalogChromeData> => {
  const filePath = path.join(process.cwd(), "src", "data", "pages", "san-pham.json");
  const source = JSON.parse(await readFile(filePath, "utf8")) as CapturedPageData;
  const headerMarkup = extractElement(source.markup, "header");
  const footerMarkup = extractElement(source.markup, "footer");
  const footerEnd = source.markup.indexOf(footerMarkup) + footerMarkup.length;
  const trailingMarkup = source.markup.slice(footerEnd).replace(/^\s*<\/div>\s*/, "");

  return {
    bodyClasses: source.bodyClasses,
    htmlClasses: source.htmlClasses,
    pageStyles: source.pageStyles,
    headerMarkup,
    footerMarkup,
    trailingMarkup,
  };
});

function extractElement(markup: string, tagName: string): string {
  const start = markup.indexOf(`<${tagName}`);
  const closeTag = `</${tagName}>`;
  const end = markup.indexOf(closeTag, start);
  if (start < 0 || end < 0) throw new Error(`Không tìm thấy ${tagName} trong giao diện đã chụp.`);
  return markup.slice(start, end + closeTag.length);
}
