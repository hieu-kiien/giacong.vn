import type { AdminProduct, D1DatabaseLike } from "./admin-data.ts";

export interface AdminProductWithRevision extends AdminProduct {
  revision: number;
}

export async function attachAdminProductRevisions(
  database: D1DatabaseLike,
  products: AdminProduct[],
): Promise<AdminProductWithRevision[]> {
  if (products.length === 0) return [];
  const ids = products.map((product) => product.id);
  const rows = await database.prepare(`
    SELECT id, revision
    FROM products
    WHERE id IN (${ids.map(() => "?").join(", ")})
  `).bind(...ids).all<{ id: number; revision: number }>();
  const revisions = new Map(rows.results.map((row) => [row.id, positiveRevision(row.revision)]));
  return products.map((product) => ({
    ...product,
    revision: revisions.get(product.id) ?? 1,
  }));
}

export async function attachAdminProductRevision(
  database: D1DatabaseLike,
  product: AdminProduct,
): Promise<AdminProductWithRevision> {
  const row = await database.prepare(`
    SELECT revision
    FROM products
    WHERE id = ?
    LIMIT 1
  `).bind(product.id).first<{ revision: number }>();
  return {
    ...product,
    revision: positiveRevision(row?.revision),
  };
}

function positiveRevision(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}
