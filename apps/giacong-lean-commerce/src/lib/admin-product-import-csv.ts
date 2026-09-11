export const ADMIN_PRODUCT_IMPORT_HEADERS = [
  "name",
  "slug",
  "sku",
  "category_slug",
  "short_description",
  "description",
  "image_url",
  "lead_time_days",
] as const;

export const ADMIN_PRODUCT_IMPORT_REQUIRED_HEADERS = ["name", "slug", "sku"] as const;
export const MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES = 100;
export const ADMIN_PRODUCT_IMPORT_MARKER_BIND_COUNT = 4;
export const ADMIN_PRODUCT_IMPORT_PRODUCT_BIND_COUNT = 7;
export const ADMIN_PRODUCT_IMPORT_META_BIND_COUNT = 4;
export const ADMIN_PRODUCT_IMPORT_AUDIT_BIND_COUNT = 4;
export const ADMIN_PRODUCT_IMPORT_CHUNK_ROWS = Math.floor(
  MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES / ADMIN_PRODUCT_IMPORT_PRODUCT_BIND_COUNT,
);
export const MAX_ADMIN_PRODUCT_IMPORT_ROWS = 50;
export const ADMIN_PRODUCT_IMPORT_BATCH_STATEMENTS = 1 + Math.ceil(
  MAX_ADMIN_PRODUCT_IMPORT_ROWS / ADMIN_PRODUCT_IMPORT_CHUNK_ROWS,
) * 4;
export const MAX_ADMIN_PRODUCT_IMPORT_BYTES = 64 * 1024;

export interface AdminProductImportBindCounts {
  audit: number;
  marker: number;
  meta: number;
  product: number;
}

export function getAdminProductImportBindCounts(rowCount: number): AdminProductImportBindCounts {
  return {
    audit: rowCount * ADMIN_PRODUCT_IMPORT_AUDIT_BIND_COUNT,
    marker: ADMIN_PRODUCT_IMPORT_MARKER_BIND_COUNT,
    meta: rowCount * ADMIN_PRODUCT_IMPORT_META_BIND_COUNT,
    product: rowCount * ADMIN_PRODUCT_IMPORT_PRODUCT_BIND_COUNT,
  };
}

export type AdminProductImportHeader = typeof ADMIN_PRODUCT_IMPORT_HEADERS[number];

export interface AdminProductImportRow {
  categorySlug: string;
  description: string;
  imageUrl: string;
  leadTimeDays: string;
  name: string;
  shortDescription: string;
  sku: string;
  slug: string;
}

export interface ProductImportCsvResult {
  errors: string[];
  headers: string[];
  rows: AdminProductImportRow[];
}

export function parseProductImportCsv(text: string): ProductImportCsvResult {
  if (new TextEncoder().encode(text).byteLength > MAX_ADMIN_PRODUCT_IMPORT_BYTES) {
    return {
      errors: [`File không được vượt quá ${MAX_ADMIN_PRODUCT_IMPORT_BYTES / 1024} KiB.`],
      headers: [],
      rows: [],
    };
  }
  const parsed = parseCsvMatrix(text);
  if (parsed.rows.length === 0) {
    return {
      errors: parsed.errors.length > 0 ? parsed.errors : ["File chưa có dòng sản phẩm nào để nhập."],
      headers: [],
      rows: [],
    };
  }
  if (parsed.errors.length > 0) return { errors: parsed.errors, headers: [], rows: [] };

  const headers = parsed.rows[0]!.map((value, index) => normalizeHeader(value, index));
  const expected = new Set<string>(ADMIN_PRODUCT_IMPORT_HEADERS);
  const required = new Set<string>(ADMIN_PRODUCT_IMPORT_REQUIRED_HEADERS);
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const header of headers) {
    if (!expected.has(header)) {
      errors.push(
        `Cột “${header || "trống"}” không được hỗ trợ. File nhập chỉ nhận sản phẩm, không nhận cột variant_*; hãy tạo biến thể ở màn hình sản phẩm sau khi nhập.`,
      );
    }
    if (seen.has(header)) errors.push(`Cột “${header}” bị lặp.`);
    seen.add(header);
  }
  for (const header of required) {
    if (!seen.has(header)) errors.push(`Thiếu cột bắt buộc “${header}”.`);
  }
  if (errors.length > 0) return { errors, headers, rows: [] };

  const rows: AdminProductImportRow[] = [];
  const dataRows = parsed.rows.slice(1);
  if (dataRows.length === 0) {
    return { errors: ["File chưa có dòng sản phẩm nào để nhập."], headers, rows: [] };
  }
  if (dataRows.length > MAX_ADMIN_PRODUCT_IMPORT_ROWS) {
    return {
      errors: [`File chỉ được chứa tối đa ${MAX_ADMIN_PRODUCT_IMPORT_ROWS} sản phẩm mỗi lần nhập.`],
      headers,
      rows: [],
    };
  }

  for (const [index, values] of dataRows.entries()) {
    if (values.length !== headers.length) {
      errors.push(`Dòng ${index + 2} có ${values.length} cột, cần đúng ${headers.length} cột.`);
      continue;
    }
    const row = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? ""]));
    rows.push({
      categorySlug: row.category_slug ?? "",
      description: row.description ?? "",
      imageUrl: row.image_url ?? "",
      leadTimeDays: row.lead_time_days ?? "",
      name: row.name ?? "",
      shortDescription: row.short_description ?? "",
      sku: row.sku ?? "",
      slug: row.slug ?? "",
    });
  }

  return { errors, headers, rows };
}

function parseCsvMatrix(text: string): { errors: string[]; rows: string[][] } {
  const rows: string[][] = [];
  const errors: string[] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let closedQuote = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
    closedQuote = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    const next = text[index + 1];

    if (inQuotes) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
        closedQuote = true;
      } else {
        cell += character === "\r" && next === "\n" ? "" : character;
        if (character === "\r" && next === "\n") index += 1;
      }
      continue;
    }

    if (closedQuote) {
      if (character === ",") {
        pushCell();
      } else if (character === "\n") {
        pushRow();
      } else if (character === "\r" && next === "\n") {
        pushRow();
        index += 1;
      } else if (character.trim() !== "") {
        errors.push("CSV không hợp lệ: có ký tự sau dấu ngoặc kép đóng.");
        closedQuote = false;
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell === "") {
      inQuotes = true;
    } else if (character === ",") {
      pushCell();
    } else if (character === "\n") {
      pushRow();
    } else if (character === "\r" && next === "\n") {
      pushRow();
      index += 1;
    } else {
      cell += character;
    }
  }

  if (inQuotes) errors.push("CSV không hợp lệ: thiếu dấu ngoặc kép đóng.");
  if (row.length > 0 || cell.length > 0) pushRow();
  return { errors, rows };
}

function normalizeHeader(value: string, index: number): string {
  const trimmed = value.trim().replace(/^\uFEFF/, "").toLowerCase();
  return trimmed || `cột-${index + 1}`;
}
