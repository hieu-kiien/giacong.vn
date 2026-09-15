import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getServiceFamily, serviceFamilies, type ServiceFamily } from "@/data/service-families";
import {
  defaultServicePresentation,
  resolveServicePresentation,
  type ServiceFamilyPresentation,
} from "@/lib/service-presentation";

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
  id: number;
  image_url: string | null;
  is_active: number;
  name: string;
  slug: string;
  summary: string;
  offerings_json?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  sort_order?: number | null;
}

export interface ManagedServiceFacts {
  adminId: number | null;
  leadTimeDays: number | null;
  moqSummary: string | null;
}

export type ManagedServiceFamily = ServiceFamily & ManagedServiceFacts & ServiceFamilyPresentation;

/**
 * Static service taxonomy remains the fallback while editable copy can live in D1.
 * This is deliberately additive: no service page becomes unavailable just because
 * managed content has not been migrated or a managed row is inactive.
 */
export async function getManagedServiceFamily(slug: string): Promise<ManagedServiceFamily | undefined> {
  const fallback = getServiceFamily(slug);
  const absent: ManagedServiceFacts = { adminId: null, leadTimeDays: null, moqSummary: null };

  try {
    const db = getCatalogDatabase();
    if (!db) {
      return fallback
        ? { ...fallback, ...absent, ...defaultServicePresentation(slug, fallback) }
        : undefined;
    }
    const row = await db.prepare(`
      SELECT id, slug, name, summary, description, is_active, image_url
      FROM services
      WHERE slug = ?
      LIMIT 1
    `).bind(slug).first<ServiceRow>();

    if (!row || row.is_active !== 1) {
      return fallback
        ? { ...fallback, ...absent, ...defaultServicePresentation(slug, fallback) }
        : undefined;
    }
    const baseFamily = fallback ?? serviceFamilyFromRow(row);
    const managed: ManagedServiceFamily = {
      ...baseFamily,
      ...absent,
      ...defaultServicePresentation(row.slug, baseFamily),
      adminId: Number.isSafeInteger(row.id) && row.id > 0 ? row.id : null,
      name: textOrFallback(row.name, fallback?.name ?? "Dịch vụ gia công"),
      summary: textOrFallback(row.summary, fallback?.summary ?? "Dịch vụ gia công theo yêu cầu."),
      description: textOrFallback(row.description, fallback?.description ?? "Liên hệ để trao đổi yêu cầu gia công cụ thể."),
      imageUrl: textOrFallback(row.image_url, "") || null,
    };
    // Meta lives in a separate table that older environments may lack: read it
    // in its own fail-soft query so a missing table only drops the facts, never
    // the managed copy above.
    try {
      const meta = await db.prepare(`
        SELECT lead_time_days, moq_summary, offerings_json, cta_label, cta_href, sort_order
        FROM service_admin_meta
        WHERE service_id = (SELECT id FROM services WHERE slug = ? LIMIT 1)
        LIMIT 1
      `).bind(slug).first<{
        lead_time_days?: unknown;
        moq_summary?: unknown;
        offerings_json?: unknown;
        cta_label?: unknown;
        cta_href?: unknown;
        sort_order?: unknown;
      }>();
      if (meta) {
        Object.assign(managed, resolveServicePresentation(row.slug, baseFamily, meta));
        managed.leadTimeDays = typeof meta.lead_time_days === "number"
          && Number.isInteger(meta.lead_time_days)
          && meta.lead_time_days >= 0
          ? meta.lead_time_days
          : null;
        managed.moqSummary = typeof meta.moq_summary === "string" && meta.moq_summary.trim()
          ? meta.moq_summary.trim()
          : null;
      }
    } catch {
      // Meta unreadable: facts stay absent, managed copy still applies.
    }
    return managed;
  } catch {
    return fallback
      ? { ...fallback, ...absent, ...defaultServicePresentation(slug, fallback) }
      : undefined;
  }
}

/** Resolve a previous managed service slug only while its target is public. */
export async function getManagedServiceRedirect(slug: string): Promise<string | null> {
  const clean = slug.trim();
  if (!clean) return null;
  try {
    const db = getCatalogDatabase();
    if (!db) return null;
    const row = await db.prepare(`
      SELECT services.slug AS slug
      FROM service_slug_redirects
      INNER JOIN services ON services.id = service_slug_redirects.service_id
      WHERE service_slug_redirects.old_slug = ?
        AND services.is_active = 1
      LIMIT 1
    `).bind(clean).first<{ slug?: unknown }>();
    const target = typeof row?.slug === "string" ? row.slug.trim() : "";
    return target && target !== clean ? target : null;
  } catch {
    // The redirect table is additive; older environments retain normal route fallback.
    return null;
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

/** Active service IDs let storefront shortcuts open the exact admin record. */
export async function getManagedServiceIdMap(slugs: readonly string[]): Promise<Record<string, number>> {
  if (slugs.length === 0) return {};
  try {
    const db = getCatalogDatabase();
    if (!db) return {};
    const placeholders = slugs.map(() => "?").join(", ");
    const result = await db.prepare(`
      SELECT id, slug
      FROM services s
      WHERE is_active = 1 AND slug IN (${placeholders})
    `).bind(...slugs).all<{ id: number; slug: string }>();
    const map: Record<string, number> = {};
    for (const row of result.results) {
      if (Number.isSafeInteger(row.id) && row.id > 0 && typeof row.slug === "string" && row.slug.trim()) {
        map[row.slug] = row.id;
      }
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Returns the static taxonomy plus active service rows created in admin. Static
 * families remain the fallback when D1 is unavailable; active rows with a new
 * valid slug become ordinary empty-offering groups until their content links are
 * added to the inventory.
 */
export async function getManagedServiceFamilies(): Promise<Array<ServiceFamily & { adminId: number | null } & ServiceFamilyPresentation>> {
  const base: Array<ServiceFamily & { adminId: number | null } & ServiceFamilyPresentation> = serviceFamilies.map((family) => ({
    ...family,
    adminId: null,
    ...defaultServicePresentation(family.slug, family),
    imageUrl: "imageUrl" in family && typeof family.imageUrl === "string" ? family.imageUrl : null,
  }));
  try {
    const db = getCatalogDatabase();
    if (!db) return base;
    const result = await db.prepare(`
      SELECT s.id, s.slug, s.name, s.summary, s.description, s.is_active, s.image_url,
        m.offerings_json, m.cta_label, m.cta_href, m.sort_order
      FROM services s
      LEFT JOIN service_admin_meta m ON m.service_id = s.id
      WHERE s.is_active = 1
      ORDER BY s.id ASC
    `).all<ServiceRow>();
    const rows = result.results.filter((row) => (
      row.is_active === 1
      && typeof row.slug === "string"
      && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug.trim())
    ));
    const bySlug = new Map(rows.map((row) => [row.slug.trim(), row]));
    const families = base.map((family) => {
      const row = bySlug.get(family.slug);
      if (!row) return family;
      return {
        ...family,
        adminId: safeServiceId(row.id),
        ...resolveServicePresentation(row.slug, family, row),
        description: textOrFallback(row.description, family.description),
        imageUrl: textOrFallback(row.image_url, "") || null,
        name: textOrFallback(row.name, family.name),
        summary: textOrFallback(row.summary, family.summary),
      };
    });
    const known = new Set<string>(serviceFamilies.map((family) => family.slug));
    for (const row of rows) {
      const slug = row.slug.trim();
      if (known.has(slug)) continue;
      const family = serviceFamilyFromRow(row);
      families.push({
        ...family,
        ...resolveServicePresentation(slug, family, row),
        adminId: safeServiceId(row.id),
      });
    }
    return families.sort((left, right) => (
      left.sortOrder - right.sortOrder
      || (left.adminId ?? Number.MAX_SAFE_INTEGER) - (right.adminId ?? Number.MAX_SAFE_INTEGER)
    ));
  } catch {
    return base;
  }
}

function textOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeServiceId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function serviceFamilyFromRow(row: ServiceRow): ServiceFamily {
  const slug = row.slug.trim();
  return {
    description: textOrFallback(row.description, "Liên hệ để trao đổi yêu cầu gia công cụ thể."),
    hubHref: `/thue-gia-cong/${encodeURIComponent(slug)}/`,
    imageUrl: textOrFallback(row.image_url, "") || null,
    name: textOrFallback(row.name, "Dịch vụ gia công"),
    offerings: [],
    slug,
    summary: textOrFallback(row.summary, "Dịch vụ gia công theo yêu cầu."),
  };
}
