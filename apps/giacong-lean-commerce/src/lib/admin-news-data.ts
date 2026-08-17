import type { D1DatabaseLike } from "./admin-data.ts";

export type AdminNewsStatus = "draft" | "published";

export interface AdminNewsCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNewsArticle {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  title: string;
  slug: string;
  excerpt: string;
  contentText: string;
  thumbnailUrl: string | null;
  status: AdminNewsStatus;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  revision: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNewsArticleInput {
  categoryId: number | null;
  title: string;
  slug: string;
  excerpt: string;
  contentText: string;
  thumbnailUrl: string | null;
  status: AdminNewsStatus;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
}

export interface AdminNewsCategoryInput {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

interface ArticleRow {
  id: number;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content_text: string;
  thumbnail_url: string | null;
  status: AdminNewsStatus;
  is_featured: number;
  seo_title: string;
  seo_description: string;
  published_at: string | null;
  revision: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface CountRow { total: number; }

export async function listAdminNewsArticles(
  database: D1DatabaseLike,
  input: { page?: number; pageSize?: number; query?: string | null; status?: string | null; categoryId?: number | null } = {},
): Promise<{ articles: AdminNewsArticle[]; total: number }> {
  const page = clampInteger(input.page, 1, 10000, 1);
  const pageSize = clampInteger(input.pageSize, 1, 100, 20);
  const query = normalizeText(input.query, 120);
  const status = input.status === "draft" || input.status === "published" ? input.status : "";
  const categoryId = Number.isInteger(input.categoryId) && Number(input.categoryId) > 0 ? Number(input.categoryId) : null;
  const where: string[] = [];
  const values: unknown[] = [];

  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    where.push("(a.title LIKE ? ESCAPE '\\' OR a.slug LIKE ? ESCAPE '\\' OR a.excerpt LIKE ? ESCAPE '\\')");
    values.push(pattern, pattern, pattern);
  }
  if (status) {
    where.push("a.status = ?");
    values.push(status);
  }
  if (categoryId) {
    where.push("a.category_id = ?");
    values.push(categoryId);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  const [rows, count] = await Promise.all([
    database.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
        a.title, a.slug, a.excerpt, a.content_text, a.thumbnail_url, a.status,
        a.is_featured, a.seo_title, a.seo_description, a.published_at, a.revision,
        a.created_by, a.updated_by, a.created_at, a.updated_at
      FROM articles a
      LEFT JOIN article_categories c ON c.id = a.category_id
      ${whereSql}
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `).bind(...values, pageSize, offset).all<ArticleRow>(),
    database.prepare(`SELECT COUNT(*) AS total FROM articles a ${whereSql}`)
      .bind(...values)
      .first<CountRow>(),
  ]);

  return {
    articles: rows.results.map(toArticle),
    total: Number(count?.total ?? 0),
  };
}

export async function getAdminNewsArticle(database: D1DatabaseLike, id: number): Promise<AdminNewsArticle | null> {
  const row = await database.prepare(`
    SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
      a.title, a.slug, a.excerpt, a.content_text, a.thumbnail_url, a.status,
      a.is_featured, a.seo_title, a.seo_description, a.published_at, a.revision,
      a.created_by, a.updated_by, a.created_at, a.updated_at
    FROM articles a
    LEFT JOIN article_categories c ON c.id = a.category_id
    WHERE a.id = ?
    LIMIT 1
  `).bind(id).first<ArticleRow>();
  return row ? toArticle(row) : null;
}

export async function listAdminNewsCategories(database: D1DatabaseLike): Promise<AdminNewsCategory[]> {
  const rows = await database.prepare(`
    SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
    FROM article_categories
    ORDER BY sort_order ASC, name ASC, id ASC
  `).all<CategoryRow>();
  return rows.results.map(toCategory);
}

export async function getAdminNewsCategory(database: D1DatabaseLike, id: number): Promise<AdminNewsCategory | null> {
  const row = await database.prepare(`
    SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
    FROM article_categories
    WHERE id = ?
    LIMIT 1
  `).bind(id).first<CategoryRow>();
  return row ? toCategory(row) : null;
}

export async function countArticlesInNewsCategory(database: D1DatabaseLike, id: number): Promise<number> {
  const row = await database.prepare("SELECT COUNT(*) AS total FROM articles WHERE category_id = ?")
    .bind(id)
    .first<CountRow>();
  return Number(row?.total ?? 0);
}

function toArticle(row: ArticleRow): AdminNewsArticle {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    contentText: row.content_text,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    isFeatured: row.is_featured === 1,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedAt: row.published_at,
    revision: row.revision,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCategory(row: CategoryRow): AdminNewsCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeText(value: string | null | undefined, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
