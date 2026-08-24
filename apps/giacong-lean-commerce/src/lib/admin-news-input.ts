export interface AdminNewsInput {
  content: string;
  coverImageUrl: string | null;
  excerpt: string;
  isPublished: boolean;
  slug: string;
  title: string;
}

type FieldErrors = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Editorial payload contract for news posts. Publishing requires a listing
 * excerpt so /tin-tuc never renders an empty card; drafts are free-form.
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
  if (rawCover && !/^https?:\/\/.+/i.test(rawCover)) {
    fieldErrors.coverImageUrl = "Ảnh bìa phải là URL http(s).";
  } else if (rawCover) {
    coverImageUrl = rawCover;
  }

  const isPublished = source.isPublished === true;
  if (isPublished && !rawExcerpt) {
    fieldErrors.excerpt = "Bài đăng cần tóm tắt để hiển thị trong danh sách tin.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, input: null };
  return {
    fieldErrors,
    input: { content: rawContent, coverImageUrl, excerpt: rawExcerpt, isPublished, slug, title: rawTitle },
  };
}
