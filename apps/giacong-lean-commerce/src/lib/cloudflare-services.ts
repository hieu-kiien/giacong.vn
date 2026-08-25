import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getServiceFamily, type ServiceFamily } from "@/data/service-families";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

interface ServiceEnv {
  GIACONG_VN_CATALOG?: D1DatabaseLike;
}

interface ServiceRow {
  description: string;
  image_url: string | null;
  is_active: number;
  name: string;
  slug: string;
  summary: string;
}

/**
 * Static service taxonomy remains the fallback while editable copy can live in D1.
 * This is deliberately additive: no service page becomes unavailable just because
 * managed content has not been migrated or a managed row is inactive.
 */
export async function getManagedServiceFamily(slug: string): Promise<ServiceFamily | undefined> {
  const fallback = getServiceFamily(slug);
  if (!fallback) return undefined;

  try {
    const db = getCatalogDatabase();
    if (!db) return fallback;
    const row = await db.prepare(`
      SELECT slug, name, summary, description, is_active, image_url
      FROM services
      WHERE slug = ?
      LIMIT 1
    `).bind(slug).first<ServiceRow>();

    if (!row || row.is_active !== 1) return fallback;
    return {
      ...fallback,
      name: textOrFallback(row.name, fallback.name),
      summary: textOrFallback(row.summary, fallback.summary),
      description: textOrFallback(row.description, fallback.description),
      imageUrl: textOrFallback(row.image_url, "") || null,
    };
  } catch {
    return fallback;
  }
}

function getCatalogDatabase(): D1DatabaseLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as ServiceEnv).GIACONG_VN_CATALOG ?? null;
  } catch {
    return null;
  }
}

/**
 * Promoted main images for the service directory, read in one query. Slugs
 * without a managed row (or with no image) stay absent so the static taxonomy's
 * icon fallback applies. Any failure returns an empty map — the index must not
 * depend on D1 being reachable.
 */
export async function getManagedServiceImageMap(slugs: readonly string[]): Promise<Record<string, string>> {
  if (slugs.length === 0) return {};
  try {
    const db = getCatalogDatabase();
    if (!db) return {};
    const placeholders = slugs.map(() => "?").join(", ");
    const result = await db.prepare(`
      SELECT slug, image_url
      FROM services
      WHERE is_active = 1 AND image_url IS NOT NULL AND slug IN (${placeholders})
    `).bind(...slugs).all<{ image_url: string; slug: string }>();
    const map: Record<string, string> = {};
    for (const row of result.results) {
      if (typeof row.slug === "string" && typeof row.image_url === "string" && row.image_url.trim()) {
        map[row.slug] = row.image_url.trim();
      }
    }
    return map;
  } catch {
    return {};
  }
}

function textOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
