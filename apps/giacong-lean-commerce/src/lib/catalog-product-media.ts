import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { CatalogProductParent } from "@/types/catalog";
import {
  buildLiveProductGallery,
  type ProductGalleryAsset,
  type ProductGalleryImage,
} from "@/lib/product-gallery";

interface D1Result<T> {
  results: T[];
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

interface CatalogMediaEnv {
  GIACONG_VN_CATALOG?: D1DatabaseLike;
}

interface MediaAssetRow {
  alt_text: string | null;
  storage_key: string;
}

/**
 * Reads active product-level media from the canonical D1 metadata table and maps
 * each R2 key onto the existing `/media/*` delivery route.
 */
export async function getCatalogProductGallery(
  product: Pick<CatalogProductParent, "id" | "imageUrl" | "name">,
): Promise<ProductGalleryImage[]> {
  const database = getCatalogDatabase();
  const result = await database.prepare(`
    SELECT storage_key, alt_text
    FROM media_assets
    WHERE namespace = 'product'
      AND product_id = ?
      AND status = 'active'
    ORDER BY created_at ASC, id ASC
  `).bind(product.id).all<MediaAssetRow>();

  const assets: ProductGalleryAsset[] = result.results.map((row) => ({
    altText: row.alt_text,
    storageKey: row.storage_key,
  }));

  return buildLiveProductGallery({
    assets,
    productImageUrl: product.imageUrl,
    productName: product.name,
  });
}

function getCatalogDatabase(): D1DatabaseLike {
  const { env } = getCloudflareContext();
  const database = (env as unknown as CatalogMediaEnv).GIACONG_VN_CATALOG;
  if (!database) throw new Error("Thiếu binding D1 GIACONG_VN_CATALOG.");
  return database;
}
