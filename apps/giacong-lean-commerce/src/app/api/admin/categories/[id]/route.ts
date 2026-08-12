import { requireAdminAccess } from "@/lib/admin-access";
import { adminJson, readAdminJson } from "@/lib/admin-http";
import {
  CatalogCategoryConflictError,
  CatalogCategoryNotFoundError,
  getCatalogAdminDatabase,
  hideAdminCatalogCategory,
  saveAdminCatalogCategory,
} from "@/lib/catalog-admin-db";
import { validateAdminCategoryPayload } from "@/lib/catalog-admin";

export const dynamic = "force-dynamic";

type AdminCategoryContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: AdminCategoryContext) {
  const access = await requireAdminAccess(request);
  if (!access.ok) return adminJson({ error: access.error }, access.status);

  const id = await readId(context);
  if (id === null) return adminJson({ error: "invalid_category" }, 422);
  let raw: unknown;
  try {
    raw = await readAdminJson(request);
  } catch {
    return adminJson({ error: "invalid_body" }, 422);
  }
  const validation = validateAdminCategoryPayload({ ...(isRecord(raw) ? raw : {}), id });
  if (!validation.ok) return adminJson({ error: "invalid_category", fields: validation.errors }, 422);

  const database = await getCatalogAdminDatabase();
  if (!database) return adminJson({ error: "catalog_unavailable" }, 503);
  try {
    await saveAdminCatalogCategory(database, validation.value);
    return adminJson({ id, ok: true });
  } catch (error) {
    if (error instanceof CatalogCategoryNotFoundError) return adminJson({ error: "category_not_found" }, 404);
    if (error instanceof CatalogCategoryConflictError) return adminJson({ error: "category_conflict" }, 409);
    return adminJson({ error: "catalog_unavailable" }, 503);
  }
}

export async function DELETE(request: Request, context: AdminCategoryContext) {
  const access = await requireAdminAccess(request);
  if (!access.ok) return adminJson({ error: access.error }, access.status);

  const id = await readId(context);
  if (id === null) return adminJson({ error: "invalid_category" }, 422);
  const database = await getCatalogAdminDatabase();
  if (!database) return adminJson({ error: "catalog_unavailable" }, 503);
  try {
    await hideAdminCatalogCategory(database, id);
    return adminJson({ id, ok: true });
  } catch (error) {
    if (error instanceof CatalogCategoryNotFoundError) return adminJson({ error: "category_not_found" }, 404);
    return adminJson({ error: "catalog_unavailable" }, 503);
  }
}

async function readId(context: AdminCategoryContext): Promise<number | null> {
  const value = (await context.params).id;
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
