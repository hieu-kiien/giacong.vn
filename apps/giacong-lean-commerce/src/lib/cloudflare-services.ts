import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getServiceFamily, type ServiceFamily } from "@/data/service-families";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
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
      SELECT slug, name, summary, description, is_active
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

function textOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
