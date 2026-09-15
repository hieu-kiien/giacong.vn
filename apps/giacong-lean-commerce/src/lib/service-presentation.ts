import { serviceFamilies, type ServiceFamily, type ServiceOffering } from "../data/service-families.ts";

export const DEFAULT_SERVICE_CTA_LABEL = "Liên hệ tư vấn";

export interface ServiceFamilyPresentation {
  ctaHref: string;
  ctaLabel: string;
  offerings: ServiceOffering[];
  sortOrder: number;
}

export interface StoredServicePresentation {
  cta_href?: unknown;
  cta_label?: unknown;
  offerings_json?: unknown;
  sort_order?: unknown;
}

export function defaultServicePresentation(
  slug: string,
  fallback?: Pick<ServiceFamily, "offerings">,
): ServiceFamilyPresentation {
  const index = serviceFamilies.findIndex((family) => family.slug === slug);
  return {
    ctaHref: defaultServiceCtaHref(slug),
    ctaLabel: DEFAULT_SERVICE_CTA_LABEL,
    offerings: fallback ? [...fallback.offerings] : [],
    sortOrder: index >= 0 ? index : 10_000,
  };
}

export function resolveServicePresentation(
  slug: string,
  fallback: Pick<ServiceFamily, "offerings"> | undefined,
  stored?: StoredServicePresentation,
): ServiceFamilyPresentation {
  const defaults = defaultServicePresentation(slug, fallback);
  if (!stored) return defaults;

  return {
    ctaHref: safeInternalHref(stored.cta_href) ?? defaults.ctaHref,
    ctaLabel: typeof stored.cta_label === "string" && stored.cta_label.trim()
      ? stored.cta_label.trim()
      : defaults.ctaLabel,
    offerings: parseStoredOfferings(stored.offerings_json, defaults.offerings),
    sortOrder: isValidSortOrder(stored.sort_order) ? stored.sort_order : defaults.sortOrder,
  };
}

export function parseStoredOfferings(
  value: unknown,
  fallback: readonly ServiceOffering[],
): ServiceOffering[] {
  if (typeof value !== "string" || !value.trim()) return [...fallback];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length > 100) return [...fallback];
    const offerings: ServiceOffering[] = [];
    const hrefs = new Set<string>();
    for (const item of parsed) {
      if (!isRecord(item) || typeof item.href !== "string" || typeof item.label !== "string") return [...fallback];
      const href = item.href.trim();
      const label = item.label.trim();
      if (!label || label.length > 160 || !isSafeInternalHref(href) || hrefs.has(href)) return [...fallback];
      hrefs.add(href);
      offerings.push({ href, label });
    }
    return offerings;
  } catch {
    return [...fallback];
  }
}

export function safeInternalHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  return isSafeInternalHref(href) ? href : null;
}

function defaultServiceCtaHref(slug: string): string {
  return `/lien-he/?service=${encodeURIComponent(slug)}`;
}

function isSafeInternalHref(value: string): boolean {
  return value.length > 0
    && value.length <= 500
    && value.startsWith("/")
    && !value.startsWith("//")
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function isValidSortOrder(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
