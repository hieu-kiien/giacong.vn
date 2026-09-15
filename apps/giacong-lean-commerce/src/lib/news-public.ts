import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

interface PublicNewsRow {
  content: string;
  cover_image_url: string | null;
  excerpt: string;
  id: number;
  published_at: string | null;
  slug: string;
  title: string;
}

export interface PublicNewsListItem {
  excerpt: string;
  coverImageUrl: string | null;
  id: number;
  publishedAt: string | null;
  slug: string;
  title: string;
}

export interface PublicNewsPost extends PublicNewsListItem {
  content: string;
  id: number;
}

export interface PublicNewsPage {
  lastPage: number;
  page: number;
  pageSize: number;
  posts: PublicNewsListItem[];
  total: number;
}

interface PublicNewsEnv {
  GIACONG_VN_CATALOG?: {
    prepare(query: string): {
      bind(...values: unknown[]): {
        all<T>(): Promise<{ results: T[] }>;
        first<T>(): Promise<T | null>;
      };
    };
  };
}

function getNewsDatabase(): PublicNewsEnv["GIACONG_VN_CATALOG"] | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as PublicNewsEnv).GIACONG_VN_CATALOG ?? null;
  } catch {
    return null;
  }
}

/** Storefront listing: published posts only, newest first, optionally filtered by query. */
export async function getPublishedNews(limit = 30, query = "", offset = 0): Promise<PublicNewsListItem[]> {
  const db = getNewsDatabase();
  if (!db) return [];
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 500) : 30;
  const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const cleanQuery = query.trim().slice(0, 100);
  const pattern = `%${cleanQuery}%`;
  try {
    const rows = await db.prepare(`
      SELECT id, published_slug AS slug, published_title AS title,
        published_excerpt AS excerpt, published_cover_image_url AS cover_image_url,
        published_at, '' AS content
      FROM news_posts
      WHERE is_published = 1 AND published_slug IS NOT NULL
        AND (? = '' OR published_title LIKE ? OR published_excerpt LIKE ? OR published_content LIKE ?)
      ORDER BY published_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(cleanQuery, pattern, pattern, pattern, safeLimit, safeOffset).all<PublicNewsRow & { cover_image_url: string | null }>();
    return rows.results.map((row) => ({
      coverImageUrl: row.cover_image_url ?? null,
      excerpt: row.excerpt,
      id: row.id,
      publishedAt: row.published_at ?? null,
      slug: row.slug,
      title: row.title,
    }));
  } catch (error) {
    console.warn("Published news listing unavailable; using an empty public listing.", error);
    return [];
  }
}

/** Storefront detail: 404 for drafts and unknown slugs alike — never leaks editorial state. */
export async function getPublishedNewsPost(slug: string): Promise<PublicNewsPost | null> {
  const clean = slug.trim();
  if (!clean) return null;
  const db = getNewsDatabase();
  if (!db) return null;
  try {
    const row = await db.prepare(`
      SELECT id, published_slug AS slug, published_title AS title,
        published_excerpt AS excerpt, published_content AS content,
        published_cover_image_url AS cover_image_url, published_at
      FROM news_posts
      WHERE published_slug = ? AND is_published = 1
      LIMIT 1
    `).bind(clean).first<PublicNewsRow>();
    if (!row) return null;
    return {
      content: row.content,
      coverImageUrl: row.cover_image_url ?? null,
      excerpt: row.excerpt,
      id: row.id,
      publishedAt: row.published_at ?? null,
      slug: row.slug,
      title: row.title,
    };
  } catch (error) {
    console.warn("Published news post unavailable; treating it as not found.", error);
    return null;
  }
}

/** Storefront listing with a bounded page and a count for an honest pagination UI. */
export async function getPublishedNewsPage(
  requestedPage = 1,
  query = "",
  pageSize = 12,
): Promise<PublicNewsPage> {
  const db = getNewsDatabase();
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 30) : 12;
  const safeRequestedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const cleanQuery = query.trim().slice(0, 100);
  const pattern = `%${cleanQuery}%`;
  if (!db) return { lastPage: 1, page: 1, pageSize: safePageSize, posts: [], total: 0 };

  try {
    const countRow = await db.prepare(`
      SELECT COUNT(*) AS total
      FROM news_posts
      WHERE is_published = 1 AND published_slug IS NOT NULL
        AND (? = '' OR published_title LIKE ? OR published_excerpt LIKE ? OR published_content LIKE ?)
    `).bind(cleanQuery, pattern, pattern, pattern).first<{ total: number }>();
    const total = Math.max(0, Number(countRow?.total ?? 0));
    const lastPage = Math.max(1, Math.ceil(total / safePageSize));
    const page = Math.min(safeRequestedPage, lastPage);
    const posts = await getPublishedNews(safePageSize, cleanQuery, (page - 1) * safePageSize);
    return { lastPage, page, pageSize: safePageSize, posts, total };
  } catch (error) {
    console.warn("Published news pagination unavailable; using an empty public page.", error);
    return { lastPage: 1, page: 1, pageSize: safePageSize, posts: [], total: 0 };
  }
}

/** Resolve a previously published slug only while its target remains public. */
export async function getPublishedNewsRedirect(slug: string): Promise<string | null> {
  const clean = slug.trim();
  if (!clean) return null;
  const db = getNewsDatabase();
  if (!db) return null;
  try {
    const row = await db.prepare(`
      SELECT news_posts.published_slug AS slug
      FROM news_slug_redirects
      INNER JOIN news_posts ON news_posts.id = news_slug_redirects.news_id
      WHERE news_slug_redirects.old_slug = ?
        AND news_posts.is_published = 1
        AND news_posts.published_slug IS NOT NULL
      LIMIT 1
    `).bind(clean).first<{ slug: string | null }>();
    const target = row?.slug?.trim() ?? "";
    return target && target !== clean ? target : null;
  } catch {
    // The redirect table is additive; an older environment keeps the normal 404 behavior.
    return null;
  }
}
