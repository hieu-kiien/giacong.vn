export interface NewsD1Result<T> {
  results: T[];
}

export interface NewsD1Statement {
  bind(...values: unknown[]): NewsD1Statement;
  all<T = Record<string, unknown>>(): Promise<NewsD1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface NewsD1Database {
  prepare(query: string): NewsD1Statement;
}

export interface NewsCategory {
  id: number;
  name: string;
  slug: string;
}

export interface NewsArticleSummary {
  id: number;
  category: NewsCategory | null;
  title: string;
  slug: string;
  excerpt: string;
  thumbnailUrl: string | null;
  featured: boolean;
  publishedAt: string;
}

export interface NewsArticleDetail extends NewsArticleSummary {
  contentText: string;
  seoTitle: string;
  seoDescription: string;
}

export interface NewsListResult {
  articles: NewsArticleSummary[];
  categories: NewsCategory[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface NewsRow {
  id: number;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content_text?: string;
  thumbnail_url: string | null;
  is_featured: number;
  seo_title?: string;
  seo_description?: string;
  published_at: string;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
}

interface CountRow {
  total: number;
}

export async function listPublishedNews(
  database: NewsD1Database,
  input: { category?: string | null; page?: number; perPage?: number; query?: string | null } = {},
): Promise<NewsListResult> {
  const page = clampInteger(input.page, 1, 10000, 1);
  const perPage = clampInteger(input.perPage, 1, 24, 12);
  const category = normalizeFilter(input.category, 120);
  const query = normalizeFilter(input.query, 120);

  const where = ["a.status = 'published'", "a.published_at IS NOT NULL", "a.published_at <= CURRENT_TIMESTAMP"];
  const values: unknown[] = [];
  if (category) {
    where.push("c.slug = ?");
    values.push(category);
  }
  if (query) {
    where.push("(a.title LIKE ? ESCAPE '\\' OR a.excerpt LIKE ? ESCAPE '\\')");
    const pattern = `%${escapeLike(query)}%`;
    values.push(pattern, pattern);
  }

  const whereSql = where.join(" AND ");
  const offset = (page - 1) * perPage;
  const [rows, count, categoryRows] = await Promise.all([
    database.prepare(`
      SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
        a.title, a.slug, a.excerpt, a.thumbnail_url, a.is_featured, a.published_at
      FROM articles a
      LEFT JOIN article_categories c ON c.id = a.category_id
      WHERE ${whereSql}
      ORDER BY a.is_featured DESC, a.published_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `).bind(...values, perPage, offset).all<NewsRow>(),
    database.prepare(`
      SELECT COUNT(*) AS total
      FROM articles a
      LEFT JOIN article_categories c ON c.id = a.category_id
      WHERE ${whereSql}
    `).bind(...values).first<CountRow>(),
    database.prepare(`
      SELECT id, name, slug
      FROM article_categories
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC, id ASC
    `).all<CategoryRow>(),
  ]);

  const total = Number(count?.total ?? 0);
  return {
    articles: rows.results.map(toSummary),
    categories: categoryRows.results.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getPublishedNewsArticle(
  database: NewsD1Database,
  slugRaw: string,
): Promise<NewsArticleDetail | null> {
  const slug = normalizeFilter(slugRaw, 160);
  if (!slug) return null;
  const row = await database.prepare(`
    SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
      a.title, a.slug, a.excerpt, a.content_text, a.thumbnail_url, a.is_featured,
      a.seo_title, a.seo_description, a.published_at
    FROM articles a
    LEFT JOIN article_categories c ON c.id = a.category_id
    WHERE a.slug = ? AND a.status = 'published'
      AND a.published_at IS NOT NULL AND a.published_at <= CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(slug).first<NewsRow>();
  if (!row) return null;
  return {
    ...toSummary(row),
    contentText: row.content_text ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
  };
}

export async function listRelatedPublishedNews(
  database: NewsD1Database,
  input: { articleId: number; categoryId: number | null; limit?: number },
): Promise<NewsArticleSummary[]> {
  const limit = clampInteger(input.limit, 1, 6, 3);
  const rows = input.categoryId
    ? await database.prepare(`
        SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
          a.title, a.slug, a.excerpt, a.thumbnail_url, a.is_featured, a.published_at
        FROM articles a
        LEFT JOIN article_categories c ON c.id = a.category_id
        WHERE a.status = 'published' AND a.published_at IS NOT NULL
          AND a.published_at <= CURRENT_TIMESTAMP AND a.id <> ? AND a.category_id = ?
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT ?
      `).bind(input.articleId, input.categoryId, limit).all<NewsRow>()
    : await database.prepare(`
        SELECT a.id, a.category_id, c.name AS category_name, c.slug AS category_slug,
          a.title, a.slug, a.excerpt, a.thumbnail_url, a.is_featured, a.published_at
        FROM articles a
        LEFT JOIN article_categories c ON c.id = a.category_id
        WHERE a.status = 'published' AND a.published_at IS NOT NULL
          AND a.published_at <= CURRENT_TIMESTAMP AND a.id <> ?
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT ?
      `).bind(input.articleId, limit).all<NewsRow>();
  return rows.results.map(toSummary);
}

function toSummary(row: NewsRow): NewsArticleSummary {
  return {
    id: row.id,
    category: row.category_id && row.category_name && row.category_slug
      ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
      : null,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    thumbnailUrl: row.thumbnail_url,
    featured: row.is_featured === 1,
    publishedAt: row.published_at,
  };
}

function normalizeFilter(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
