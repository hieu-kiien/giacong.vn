export const MAX_PAGE_BLOCKS = 40;
export const MAX_FEATURE_ITEMS = 12;
export const MAX_PAGE_JSON_BYTES = 48_000;

export interface PageCta {
  href: string;
  label: string;
}

export type PageBlock =
  | { type: "hero"; eyebrow: string; title: string; description: string; imageUrl: string | null; primaryCta: PageCta | null; secondaryCta: PageCta | null }
  | { type: "rich_text"; title: string; body: string }
  | { type: "image"; imageUrl: string; alt: string; caption: string }
  | { type: "feature_grid"; title: string; items: Array<{ title: string; description: string }> }
  | { type: "cta"; title: string; body: string; label: string; href: string }
  | { type: "contact"; title: string; body: string };

export class PageBuilderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageBuilderValidationError";
  }
}

const allowedBlockKeys: Readonly<Record<string, readonly string[]>> = {
  cta: ["type", "title", "body", "label", "href"],
  contact: ["type", "title", "body"],
  feature_grid: ["type", "title", "items"],
  hero: ["type", "eyebrow", "title", "description", "imageUrl", "primaryCta", "secondaryCta"],
  image: ["type", "imageUrl", "alt", "caption"],
  rich_text: ["type", "title", "body"],
};

export function parsePageBlocks(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) throw new PageBuilderValidationError("Page phải là một danh sách section.");
  if (value.length > MAX_PAGE_BLOCKS) throw new PageBuilderValidationError(`Page chỉ được có tối đa ${MAX_PAGE_BLOCKS} section.`);
  const blocks = value.map((item, index) => parseBlock(item, index));
  if (new TextEncoder().encode(JSON.stringify(blocks)).length > MAX_PAGE_JSON_BYTES) {
    throw new PageBuilderValidationError("Nội dung page vượt quá giới hạn cho phép.");
  }
  return blocks;
}

export function parsePageBlocksJson(value: string | null | undefined): PageBlock[] {
  if (!value) return [];
  try {
    return parsePageBlocks(JSON.parse(value));
  } catch (error) {
    if (error instanceof PageBuilderValidationError) throw error;
    throw new PageBuilderValidationError("Nội dung page trong D1 không hợp lệ.");
  }
}

export function serializePageBlocks(value: unknown): string {
  return JSON.stringify(parsePageBlocks(value));
}

function parseBlock(value: unknown, index: number): PageBlock {
  const path = `Section ${index + 1}`;
  const record = asRecord(value, path);
  const type = readRequiredText(record.type, `${path}.type`, 40);
  assertAllowedKeys(record, allowedBlockKeys[type] ?? ["type"], path);
  switch (type) {
    case "hero":
      return {
        type,
        eyebrow: readText(record.eyebrow, `${path}.eyebrow`, 160),
        title: readRequiredText(record.title, `${path}.title`, 240),
        description: readRequiredText(record.description, `${path}.description`, 2400),
        imageUrl: readOptionalImageUrl(record.imageUrl, `${path}.imageUrl`),
        primaryCta: readCta(record.primaryCta, `${path}.primaryCta`),
        secondaryCta: readCta(record.secondaryCta, `${path}.secondaryCta`),
      };
    case "rich_text":
      return { type, title: readText(record.title, `${path}.title`, 240), body: readRequiredText(record.body, `${path}.body`, 8000) };
    case "image":
      return {
        type,
        imageUrl: readRequiredImageUrl(record.imageUrl, `${path}.imageUrl`),
        alt: readRequiredText(record.alt, `${path}.alt`, 240),
        caption: readText(record.caption, `${path}.caption`, 500),
      };
    case "feature_grid": {
      const items = Array.isArray(record.items) ? record.items : null;
      if (!items || items.length === 0 || items.length > MAX_FEATURE_ITEMS) {
        throw new PageBuilderValidationError(`${path}.items phải có từ 1 đến ${MAX_FEATURE_ITEMS} mục.`);
      }
      return {
        type,
        title: readText(record.title, `${path}.title`, 240),
        items: items.map((item, itemIndex) => {
          const itemRecord = asRecord(item, `${path}.items[${itemIndex}]`);
          assertAllowedKeys(itemRecord, ["title", "description"], `${path}.items[${itemIndex}]`);
          return {
            title: readRequiredText(itemRecord.title, `${path}.items[${itemIndex}].title`, 180),
            description: readRequiredText(itemRecord.description, `${path}.items[${itemIndex}].description`, 600),
          };
        }),
      };
    }
    case "cta":
      return {
        type,
        title: readRequiredText(record.title, `${path}.title`, 240),
        body: readText(record.body, `${path}.body`, 1000),
        label: readRequiredText(record.label, `${path}.label`, 120),
        href: readRequiredUrl(record.href, `${path}.href`),
      };
    case "contact":
      return { type, title: readRequiredText(record.title, `${path}.title`, 240), body: readRequiredText(record.body, `${path}.body`, 2400) };
    default:
      throw new PageBuilderValidationError(`${path}.type không được phép.`);
  }
}

function readCta(value: unknown, path: string): PageCta | null {
  if (value === null || value === undefined || value === "") return null;
  const record = asRecord(value, path);
  assertAllowedKeys(record, ["label", "href"], path);
  return { label: readRequiredText(record.label, `${path}.label`, 120), href: readRequiredUrl(record.href, `${path}.href`) };
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedKeys);
  const unknownKey = Object.keys(record).find((key) => !allowed.has(key));
  if (unknownKey) throw new PageBuilderValidationError(`${path}.${unknownKey} không được phép.`);
}

function readText(value: unknown, path: string, maxLength: number): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new PageBuilderValidationError(`${path} phải là chuỗi.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new PageBuilderValidationError(`${path} vượt quá giới hạn ký tự.`);
  if (/[<>]/.test(normalized)) throw new PageBuilderValidationError(`${path} không được chứa HTML hoặc markup.`);
  return normalized;
}

function readRequiredText(value: unknown, path: string, maxLength: number): string {
  const text = readText(value, path, maxLength);
  if (!text) throw new PageBuilderValidationError(`${path} là bắt buộc.`);
  return text;
}

function readOptionalImageUrl(value: unknown, path: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return readImageUrl(value, path);
}

function readRequiredImageUrl(value: unknown, path: string): string {
  const url = readImageUrl(value, path);
  if (!url) throw new PageBuilderValidationError(`${path} là bắt buộc.`);
  return url;
}

function readImageUrl(value: unknown, path: string): string {
  if (typeof value !== "string") throw new PageBuilderValidationError(`${path} phải là URL ảnh.`);
  const normalized = value.trim();
  if (!isSafeUrl(normalized, false)) throw new PageBuilderValidationError(`${path} không phải URL ảnh an toàn.`);
  return normalized;
}

function readRequiredUrl(value: unknown, path: string): string {
  if (typeof value !== "string") throw new PageBuilderValidationError(`${path} phải là URL.`);
  const normalized = value.trim();
  if (!isSafeUrl(normalized, true)) throw new PageBuilderValidationError(`${path} không phải URL an toàn.`);
  return normalized;
}

function isSafeUrl(value: string, allowContactProtocols: boolean): boolean {
  if (!value || value.startsWith("//")) return false;
  if (value.startsWith("/" ) || value.startsWith("#")) return true;
  try {
    const url = new URL(value);
    const allowed = allowContactProtocols ? ["http:", "https:", "mailto:", "tel:"] : ["http:", "https:"];
    return allowed.includes(url.protocol);
  } catch {
    return false;
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PageBuilderValidationError(`${path} phải là object.`);
  return value as Record<string, unknown>;
}
