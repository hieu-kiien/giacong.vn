import { ADMIN_PRODUCT_IMPORT_HEADERS, ADMIN_PRODUCT_IMPORT_IGNORED_HEADERS } from "./admin-product-import-csv.ts";

/** Read-only columns appended after the importable ones (ignored by the importer). */
export const ADMIN_PRODUCT_EXPORT_READONLY_HEADERS = ADMIN_PRODUCT_IMPORT_IGNORED_HEADERS;

export const ADMIN_PRODUCT_EXPORT_HEADERS = [
  ...ADMIN_PRODUCT_IMPORT_HEADERS,
  ...ADMIN_PRODUCT_EXPORT_READONLY_HEADERS,
] as const;

export interface AdminProductExportInput {
  categorySlug: string | null;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  leadTimeDays: number | null;
  name: string;
  shortDescription: string;
  sku: string;
  slug: string;
  startingPrice: number | null;
  status: string;
  variantCount: number | null;
}

/**
 * Spreadsheet apps treat cells beginning with these characters as formulas.
 * Prefix an apostrophe so exported text is never executed when opened.
 */
function neutralizeFormula(value: string): string {
  // Plain phone-like numbers (+84 912 345 678) are harmless and should stay readable.
  if (/^[+-]?\d[\d\s().-]*$/.test(value)) return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(value: string | number | null | undefined, options: { text?: boolean } = {}): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const text = options.text === false ? raw : neutralizeFormula(raw);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function visibilityLabel(product: Pick<AdminProductExportInput, "isActive" | "status">): string {
  if (product.status === "draft" || product.status === "review") return "nhap";
  if (product.status === "archived" || !product.isActive) return "an";
  return "hien-thi";
}

/** UTF-8 BOM + CRLF so Excel opens Vietnamese text correctly. */
export function buildProductExportCsv(products: readonly AdminProductExportInput[]): string {
  const lines = [ADMIN_PRODUCT_EXPORT_HEADERS.join(",")];
  for (const product of products) {
    lines.push([
      escapeCsvCell(product.name),
      escapeCsvCell(product.slug),
      escapeCsvCell(product.sku),
      escapeCsvCell(product.categorySlug),
      escapeCsvCell(product.shortDescription),
      escapeCsvCell(product.description),
      escapeCsvCell(product.imageUrl),
      escapeCsvCell(product.leadTimeDays, { text: false }),
      escapeCsvCell(visibilityLabel(product)),
      escapeCsvCell(product.startingPrice, { text: false }),
      escapeCsvCell(product.variantCount ?? 0, { text: false }),
    ].join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
