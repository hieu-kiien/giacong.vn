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
  publishedAt: string | null;
  slug: string;
  title: string;
}

export interface PublicNewsPost extends PublicNewsListItem {
  content: string;
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

/** Storefront listing: published posts only, newest first. */
export async function getPublishedNews(limit = 30): Promise<PublicNewsListItem[]> {
  const db = getNewsDatabase();
  if (!db) return [];
  const rows = await db.prepare(`
    SELECT published_slug AS slug, published_title AS title,
      published_excerpt AS excerpt, published_cover_image_url AS cover_image_url,
      published_at, '' AS content
    FROM news_posts
    WHERE is_published = 1 AND published_slug IS NOT NULL
    ORDER BY published_at DESC, id DESC
    LIMIT ?
  `).bind(limit).all<PublicNewsRow & { cover_image_url: string | null }>();
  return rows.results.map((row) => ({
    coverImageUrl: row.cover_image_url ?? null,
    excerpt: row.excerpt,
    publishedAt: row.published_at ?? null,
    slug: row.slug,
    title: row.title,
  }));
}

/** Storefront detail: 404 for drafts and unknown slugs alike — never leaks editorial state. */
export async function getPublishedNewsPost(slug: string): Promise<PublicNewsPost | null> {
  const clean = slug.trim();
  if (!clean) return null;
  const db = getNewsDatabase();
  if (!db) return null;
  const row = await db.prepare(`
    SELECT published_slug AS slug, published_title AS title,
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
    publishedAt: row.published_at ?? null,
    slug: row.slug,
    title: row.title,
  };
}
