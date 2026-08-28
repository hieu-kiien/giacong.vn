export interface AdminNewsDraftInput {
  content: string;
  coverImageUrl: string | null;
  excerpt: string;
  slug: string;
  title: string;
}

/** Backwards-compatible name for server adapters that accept a draft payload. */
export type AdminNewsInput = AdminNewsDraftInput;

type FieldErrors = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Editorial payload contract for news drafts. Publication is a separate
 * mutation so editing a published post never changes the public snapshot.
 */
export function parseAdminNewsPayload(
  payload: unknown,
): { fieldErrors: FieldErrors; input: AdminNewsInput | null } {
  const source = isRecord(payload) ? payload : {};
  const fieldErrors: FieldErrors = {};

  const rawTitle = typeof source.title === "string" ? source.title.trim() : "";
  if (!rawTitle || rawTitle.length > 200) {
    fieldErrors.title = "Tiêu đề bắt buộc, tối đa 200 ký tự.";
  }

  const rawSlug = typeof source.slug === "string" ? source.slug.trim() : "";
  let slug = "";
  if (!rawSlug || rawSlug.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug)) {
    fieldErrors.slug = "Slug chỉ gồm chữ thường, số và dấu gạch ngang.";
  } else {
    slug = rawSlug;
  }

  const rawExcerpt = typeof source.excerpt === "string" ? source.excerpt.trim() : "";
  if (rawExcerpt.length > 500) {
    fieldErrors.excerpt = "Tóm tắt tối đa 500 ký tự.";
  }

  const rawContent = typeof source.content === "string" ? source.content : "";
  if (rawContent.length > 60_000) {
    fieldErrors.content = "Nội dung tối đa 60.000 ký tự.";
  }

  let coverImageUrl: string | null = null;
  const rawCover = typeof source.coverImageUrl === "string" ? source.coverImageUrl.trim() : "";
  if (rawCover && !isSafeImageUrl(rawCover)) {
    fieldErrors.coverImageUrl = "Ảnh bìa phải là URL http(s) hoặc media nội bộ an toàn.";
  } else if (rawCover) {
    coverImageUrl = rawCover;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, input: null };
  return {
    fieldErrors,
    input: { content: rawContent, coverImageUrl, excerpt: rawExcerpt, slug, title: rawTitle },
  };
}

function isSafeImageUrl(value: string): boolean {
  if (value.startsWith("/media/") && !/[\s<>"']/.test(value)) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !/[\s<>]/.test(value);
  } catch {
    return false;
  }
}
