import type { D1DatabaseLike } from "./admin-data.ts";
import type { AdminNewsStatus } from "./admin-news-input.ts";

export interface AdminNewsCategory {
  id: number;
  name: string;
  slug: string;
  active: boolean;
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
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  revision: number;
  archivedAt: string | null;
  updatedAt: string;
}

interface AdminNewsRow {
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
  archived_at: string | null;
  updated_at: string;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  is_active: number;
}

interface CountRow { total: number; }

export async function listAdminNewsArticles(
  database: D1DatabaseLike,
  input: { page?: number; pageSize?: number; query?: string; status?: string } = {},
): Promise<{ articles: AdminNewsArticle[]; total: number }> {
  const page = clamp(input.page, 1, 10_000, 1);
  const pageSize = clamp(input.pageSize, 1, 100, 20);
  const query = typeof input.query === "string" ? input.query.trim().slice(0, 120) : "";
  const status = input.status === "draft" || input.status === "published" ? input.status : "";
  const where = ["a.archived_at IS NULL"];
  const values: unknown[] = [];

  if (status) {
    where.push("a.status = ?");
    values.push(status);
  }
  if (query) {
    where.push("(a.title LIKE ? ESCAPE '\\' OR a.slug LIKE ? ESCAPE '\\')");
    const pattern = `%${query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    values.push(pattern, pattern);
  }

  const whereSql = where.join(" AND ");
  const offset = (page - 1) * pageSize;
  const [rows, count] = await Promise.all([
    database.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
        a.title, a.slug, a.excerpt, a.content_text, a.thumbnail_url, a.status,
        a.is_featured, a.seo_title, a.seo_description, a.published_at, a.revision,
        a.archived_at, a.updated_at
      FROM articles a
      LEFT JOIN article_categories c ON c.id = a.category_id
      WHERE ${whereSql}
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `).bind(...values, pageSize, offset).all<AdminNewsRow>(),
    database.prepare(`SELECT COUNT(*) AS total FROM articles a WHERE ${whereSql}`)
      .bind(...values)
      .first<CountRow>(),
  ]);

  return {
    articles: rows.results.map(toArticle),
    total: Number(count?.total ?? 0),
  };
}

export async function getAdminNewsArticle(
  database: D1DatabaseLike,
  id: number,
): Promise<AdminNewsArticle | null> {
  const row = await database.prepare(`
    SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
      a.title, a.slug, a.excerpt, a.content_text, a.thumbnail_url, a.status,
      a.is_featured, a.seo_title, a.seo_description, a.published_at, a.revision,
      a.archived_at, a.updated_at
    FROM articles a
    LEFT JOIN article_categories c ON c.id = a.category_id
    WHERE a.id = ?
    LIMIT 1
  `).bind(id).first<AdminNewsRow>();
  return row ? toArticle(row) : null;
}

export async function listAdminNewsCategories(database: D1DatabaseLike): Promise<AdminNewsCategory[]> {
  const rows = await database.prepare(`
    SELECT id, name, slug, is_active
    FROM article_categories
    ORDER BY sort_order ASC, name ASC, id ASC
  `).all<CategoryRow>();
  return rows.results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.is_active === 1,
  }));
}

function toArticle(row: AdminNewsRow): AdminNewsArticle {
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
    featured: row.is_featured === 1,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedAt: row.published_at,
    revision: row.revision,
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
