import { requireAdminAccess } from "@/lib/admin-access";
import { adminJson, AdminBodyError, readAdminJson } from "@/lib/admin-http";
import {
  CatalogCategoryConflictError,
  getCatalogAdminDatabase,
  saveAdminCatalogCategory,
} from "@/lib/catalog-admin-db";
import { validateAdminCategoryPayload } from "@/lib/catalog-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireAdminAccess(request);
  if (!access.ok) return adminJson({ error: access.error }, access.status);

  let raw: unknown;
  try {
    raw = await readAdminJson(request);
  } catch (error) {
    if (error instanceof AdminBodyError) return adminJson({ error: "invalid_body" }, 422);
    return adminJson({ error: "invalid_body" }, 422);
  }
  const validation = validateAdminCategoryPayload(raw);
  if (!validation.ok) return adminJson({ error: "invalid_category", fields: validation.errors }, 422);

  const database = await getCatalogAdminDatabase();
  if (!database) return adminJson({ error: "catalog_unavailable" }, 503);
  try {
    const id = await saveAdminCatalogCategory(database, validation.value);
    return adminJson({ id, ok: true }, 201);
  } catch (error) {
    if (error instanceof CatalogCategoryConflictError) return adminJson({ error: "category_conflict" }, 409);
    return adminJson({ error: "catalog_unavailable" }, 503);
  }
}
