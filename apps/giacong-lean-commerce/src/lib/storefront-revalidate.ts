import { revalidatePath, revalidateTag } from "next/cache";

export function revalidatePublishedStorefront(options?: {
  tags?: string[];
  paths?: string[];
}): void {
  try {
    const tags = options?.tags ?? [
      "published-site-settings",
      "site-settings",
      "published-site-navigation",
      "site-navigation",
      "published-site-page",
      "site-pages",
    ];
    for (const tag of tags) {
      try {
        revalidateTag(tag, { expire: 0 });
      } catch {
        // Safe in environments without Next.js server context
      }
    }

    const paths = options?.paths ?? ["/"];
    for (const path of paths) {
      try {
        revalidatePath(path);
      } catch {
        // Safe in environments without Next.js server context
      }
    }
  } catch {
    // Graceful fallback
  }
}

export function withStorefrontPurgeHeader(response: Response, paths: string[] = ["/"]): Response {
  response.headers.set("x-purge-storefront-cache", paths.join(","));
  return response;
}

/** Public paths that can show a product: home, the catalog list, and each detail URL given. */
export function catalogProductPurgePaths(slugs: ReadonlyArray<string | null | undefined> = []): string[] {
  const paths = new Set<string>(["/", "/san-pham/"]);
  for (const slug of slugs) {
    if (slug) paths.add(`/san-pham/${encodeURIComponent(slug)}/`);
  }
  return [...paths];
}

/** Public paths that can show a service: home, the service list, and each detail URL given. */
export function catalogServicePurgePaths(slugs: ReadonlyArray<string | null | undefined> = []): string[] {
  const paths = new Set<string>(["/", "/thue-gia-cong/"]);
  for (const slug of slugs) {
    if (slug) paths.add(`/thue-gia-cong/${encodeURIComponent(slug)}/`);
  }
  return [...paths];
}

/**
 * After a successful product/service write: revalidate the ISR pages and ask the worker to drop
 * its cached HTML for the same paths. The catalog has no tagged data cache, so only paths apply.
 */
export function purgeCatalogStorefront(response: Response, paths: string[]): Response {
  revalidatePublishedStorefront({ tags: [], paths });
  return withStorefrontPurgeHeader(response, paths);
}

interface ProductSlugDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): { first<T = Record<string, unknown>>(): Promise<T | null> };
  };
}

/**
 * Same as purgeCatalogStorefront for writes that only know a product id (variants, gallery,
 * specs, create/import): looks up the current slug so the detail page is purged too. A failed
 * lookup still purges the list pages and never blocks the already-saved write.
 */
export async function purgeCatalogProductById(
  database: ProductSlugDatabase,
  productIds: ReadonlyArray<number>,
  response: Response,
): Promise<Response> {
  const slugs: string[] = [];
  for (const id of productIds) {
    try {
      const row = await database.prepare("SELECT slug FROM products WHERE id = ?").bind(id).first<{ slug: string }>();
      if (row?.slug) slugs.push(row.slug);
    } catch {
      // list pages are still purged below
    }
  }
  return purgeCatalogStorefront(response, catalogProductPurgePaths(slugs));
}
