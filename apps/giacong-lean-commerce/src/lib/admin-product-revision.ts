import type { AdminProduct, D1DatabaseLike } from "./admin-data.ts";

export interface AdminProductWithRevision extends AdminProduct {
  revision: number;
}

export class AdminProductRevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminProductRevisionError";
  }
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
  const revisions = new Map<number, number>();
  for (const row of rows.results) revisions.set(row.id, requireRevision(row.revision, row.id));

  return products.map((product) => {
    const revision = revisions.get(product.id);
    if (!revision) {
      throw new AdminProductRevisionError(`Thiếu revision cho sản phẩm #${product.id}.`);
    }
    return { ...product, revision };
  });
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
  if (!row) throw new AdminProductRevisionError(`Thiếu revision cho sản phẩm #${product.id}.`);
  return {
    ...product,
    revision: requireRevision(row.revision, product.id),
  };
}

function requireRevision(value: unknown, productId: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new AdminProductRevisionError(`Revision không hợp lệ cho sản phẩm #${productId}.`);
  }
  return value;
}
