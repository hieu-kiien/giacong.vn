export type AdminNewsStatus = "draft" | "published";

export interface AdminNewsInput {
  categoryId: number | null;
  contentText: string;
  excerpt: string;
  featured: boolean;
  publishedAt: string | null;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  status: AdminNewsStatus;
  thumbnailUrl: string | null;
  title: string;
}

export interface AdminNewsParseResult {
  fieldErrors?: Record<string, string>;
  input?: AdminNewsInput;
}

export function parseAdminNewsPayload(
  value: unknown,
  defaults: Partial<AdminNewsInput> = {},
): AdminNewsParseResult {
  const source = isRecord(value) ? value : {};
  const input: AdminNewsInput = {
    categoryId: nullablePositiveInteger(source.categoryId, defaults.categoryId ?? null),
    contentText: text(source.contentText, defaults.contentText ?? "", 100_000),
    excerpt: text(source.excerpt, defaults.excerpt ?? "", 600),
    featured: booleanValue(source.featured, defaults.featured ?? false),
    publishedAt: nullableDateTime(source.publishedAt, defaults.publishedAt ?? null),
    seoDescription: text(source.seoDescription, defaults.seoDescription ?? "", 320),
    seoTitle: text(source.seoTitle, defaults.seoTitle ?? "", 180),
    slug: text(source.slug, defaults.slug ?? "", 160).toLowerCase(),
    status: statusValue(source.status, defaults.status ?? "draft"),
    thumbnailUrl: nullableUrl(source.thumbnailUrl, defaults.thumbnailUrl ?? null),
    title: text(source.title, defaults.title ?? "", 180),
  };

  const fieldErrors: Record<string, string> = {};
  if (!input.title) fieldErrors.title = "Tiêu đề là bắt buộc.";
  if (!input.slug) fieldErrors.slug = "Slug là bắt buộc.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    fieldErrors.slug = "Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang.";
  }
  if (source.status !== undefined && source.status !== "draft" && source.status !== "published") {
    fieldErrors.status = "Trạng thái bài viết không hợp lệ.";
  }
  if (source.featured !== undefined && typeof source.featured !== "boolean") {
    fieldErrors.featured = "Cờ bài nổi bật phải là true hoặc false.";
  }
  if (input.status === "published" && !input.contentText.trim()) {
    fieldErrors.contentText = "Bài xuất bản cần có nội dung.";
  }
  if (source.categoryId !== undefined && source.categoryId !== null && input.categoryId === null) {
    fieldErrors.categoryId = "Chuyên mục không hợp lệ.";
  }
  if (source.publishedAt !== undefined && source.publishedAt !== null && input.publishedAt === null) {
    fieldErrors.publishedAt = "Thời điểm xuất bản không hợp lệ.";
  }
  if (source.thumbnailUrl !== undefined && source.thumbnailUrl !== null && input.thumbnailUrl === null) {
    fieldErrors.thumbnailUrl = "URL ảnh đại diện không hợp lệ.";
  }

  return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : { input };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, maxLength: number): string {
  return (typeof value === "string" ? value : fallback).trim().slice(0, maxLength);
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function nullablePositiveInteger(value: unknown, fallback: number | null): number | null {
  if (value === null || value === "") return null;
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function statusValue(value: unknown, fallback: AdminNewsStatus): AdminNewsStatus {
  return value === "draft" || value === "published" ? value : fallback;
}

function nullableDateTime(value: unknown, fallback: string | null): string | null {
  if (value === null || value === "") return null;
  if (value === undefined) return fallback;
  if (typeof value !== "string") return null;
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function nullableUrl(value: unknown, fallback: string | null): string | null {
  if (value === null || value === "") return null;
  if (value === undefined) return fallback;
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, 2048);
  if (normalized.startsWith("/")) return normalized;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:" ? normalized : null;
  } catch {
    return null;
  }
}
