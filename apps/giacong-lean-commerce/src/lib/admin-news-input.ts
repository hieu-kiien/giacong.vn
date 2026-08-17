import type {
  AdminNewsArticle,
  AdminNewsArticleInput,
  AdminNewsCategory,
  AdminNewsCategoryInput,
} from "./admin-news-data.ts";

export interface AdminNewsParseResult<T> {
  input: T | null;
  fieldErrors: Record<string, string>;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseAdminNewsArticlePayload(
  value: unknown,
  defaults?: AdminNewsArticleInput,
): AdminNewsParseResult<AdminNewsArticleInput> {
  const record = asRecord(value);
  const fallback = defaults ?? articleDefaults();
  const categoryId = nullablePositiveInteger(read(record, "categoryId", fallback.categoryId));
  const title = text(read(record, "title", fallback.title), 200);
  const slug = text(read(record, "slug", fallback.slug), 160).toLowerCase();
  const excerpt = text(read(record, "excerpt", fallback.excerpt), 1000);
  const contentText = text(read(record, "contentText", fallback.contentText), 120_000, false);
  const thumbnailUrl = nullableText(read(record, "thumbnailUrl", fallback.thumbnailUrl), 1200);
  const status = read(record, "status", fallback.status);
  const isFeatured = booleanValue(read(record, "isFeatured", fallback.isFeatured));
  const seoTitle = text(read(record, "seoTitle", fallback.seoTitle), 200);
  const seoDescription = text(read(record, "seoDescription", fallback.seoDescription), 500);
  const publishedAt = normalizePublishedAt(read(record, "publishedAt", fallback.publishedAt));
  const fieldErrors: Record<string, string> = {};

  if (!title) fieldErrors.title = "Tiêu đề là bắt buộc.";
  if (!slug) fieldErrors.slug = "Slug là bắt buộc.";
  else if (!SLUG_PATTERN.test(slug)) fieldErrors.slug = "Slug chỉ dùng chữ thường không dấu, số và dấu gạch nối.";
  if (status !== "draft" && status !== "published") fieldErrors.status = "Trạng thái bài viết không hợp lệ.";
  if (thumbnailUrl && !isSafeMediaUrl(thumbnailUrl)) fieldErrors.thumbnailUrl = "URL ảnh phải là http(s) hoặc đường dẫn nội bộ bắt đầu bằng /.";
  if (read(record, "publishedAt", fallback.publishedAt) && !publishedAt) fieldErrors.publishedAt = "Thời điểm xuất bản không hợp lệ.";
  if (status === "published" && !publishedAt) fieldErrors.publishedAt = "Bài published cần có thời điểm xuất bản.";
  if (categoryId === undefined) fieldErrors.categoryId = "Danh mục không hợp lệ.";

  if (Object.keys(fieldErrors).length > 0 || (status !== "draft" && status !== "published") || categoryId === undefined) {
    return { input: null, fieldErrors };
  }

  return {
    input: {
      categoryId,
      title,
      slug,
      excerpt,
      contentText,
      thumbnailUrl,
      status,
      isFeatured,
      seoTitle,
      seoDescription,
      publishedAt,
    },
    fieldErrors,
  };
}

export function parseAdminNewsCategoryPayload(
  value: unknown,
  defaults?: AdminNewsCategoryInput,
): AdminNewsParseResult<AdminNewsCategoryInput> {
  const record = asRecord(value);
  const fallback = defaults ?? categoryDefaults();
  const name = text(read(record, "name", fallback.name), 160);
  const slug = text(read(record, "slug", fallback.slug), 160).toLowerCase();
  const description = text(read(record, "description", fallback.description), 1000);
  const sortOrder = nonNegativeInteger(read(record, "sortOrder", fallback.sortOrder));
  const isActive = booleanValue(read(record, "isActive", fallback.isActive));
  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "Tên danh mục là bắt buộc.";
  if (!slug) fieldErrors.slug = "Slug là bắt buộc.";
  else if (!SLUG_PATTERN.test(slug)) fieldErrors.slug = "Slug chỉ dùng chữ thường không dấu, số và dấu gạch nối.";
  if (sortOrder === null) fieldErrors.sortOrder = "Thứ tự phải là số nguyên không âm.";

  if (Object.keys(fieldErrors).length > 0 || sortOrder === null) return { input: null, fieldErrors };
  return { input: { name, slug, description, sortOrder, isActive }, fieldErrors };
}

export function adminNewsArticleDefaults(article?: AdminNewsArticle): AdminNewsArticleInput {
  return article ? {
    categoryId: article.categoryId,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    contentText: article.contentText,
    thumbnailUrl: article.thumbnailUrl,
    status: article.status,
    isFeatured: article.isFeatured,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    publishedAt: article.publishedAt,
  } : articleDefaults();
}

export function adminNewsCategoryDefaults(category?: AdminNewsCategory): AdminNewsCategoryInput {
  return category ? {
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  } : categoryDefaults();
}

function articleDefaults(): AdminNewsArticleInput {
  return {
    categoryId: null,
    title: "",
    slug: "",
    excerpt: "",
    contentText: "",
    thumbnailUrl: null,
    status: "draft",
    isFeatured: false,
    seoTitle: "",
    seoDescription: "",
    publishedAt: null,
  };
}

function categoryDefaults(): AdminNewsCategoryInput {
  return { name: "", slug: "", description: "", sortOrder: 0, isActive: true };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function read(record: Record<string, unknown>, key: string, fallback: unknown): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : fallback;
}

function text(value: unknown, maxLength: number, trim = true): string {
  if (typeof value !== "string") return "";
  const normalized = trim ? value.trim() : value;
  return normalized.slice(0, maxLength);
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return text(value, maxLength) || null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function nullablePositiveInteger(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizePublishedAt(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isSafeMediaUrl(value: string): boolean {
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
