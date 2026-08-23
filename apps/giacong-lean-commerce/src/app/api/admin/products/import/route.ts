import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  findAdminProductImportConflicts,
  importErrorsToFieldErrors,
  prepareAdminProductImportRows,
} from "@/lib/admin-product-import";
import { listAdminCategories, type AdminCategory } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminProductsAtomically } from "@/lib/admin-product-write";
import {
  MAX_ADMIN_PRODUCT_IMPORT_BYTES,
  MAX_ADMIN_PRODUCT_IMPORT_ROWS,
} from "@/lib/admin-product-import-csv";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được nhập sản phẩm.");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ADMIN_PRODUCT_IMPORT_BYTES) {
    return adminFailure(
      crypto.randomUUID(),
      413,
      "PAYLOAD_TOO_LARGE",
      `File nhập không được vượt quá ${MAX_ADMIN_PRODUCT_IMPORT_BYTES / 1_000_000} MB.`,
    );
  }

  const payload = await readJson(request);
  const rows = isRecord(payload) && Array.isArray(payload.rows) ? payload.rows : [];
  let categories: AdminCategory[];
  try {
    categories = await listAdminCategories(guard.database);
  } catch {
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "Không thể đọc danh mục sản phẩm.");
  }

  const prepared = prepareAdminProductImportRows(rows, categories);
  if (prepared.errors.length > 0) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "File có lỗi. Chưa có sản phẩm nào được lưu.",
      importErrorsToFieldErrors(prepared.errors),
    );
  }
  if (prepared.entries.length > MAX_ADMIN_PRODUCT_IMPORT_ROWS) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      `Chỉ được nhập tối đa ${MAX_ADMIN_PRODUCT_IMPORT_ROWS} sản phẩm mỗi lần.`,
    );
  }

  try {
    const conflicts = await findAdminProductImportConflicts(guard.database, prepared.entries);
    if (conflicts.length > 0) {
      return adminFailure(
        crypto.randomUUID(),
        409,
        "UNIQUE_CONFLICT",
        "File có slug hoặc SKU đã tồn tại. Chưa có sản phẩm nào được lưu.",
        importErrorsToFieldErrors(conflicts),
      );
    }

    const productIds = await createAdminProductsAtomically(
      guard.database,
      prepared.entries,
      guard.actorSubject,
    );
    return adminSuccess(crypto.randomUUID(), {
      createdCount: productIds.length,
      productIds,
    }, 201);
  } catch (error) {
    if (isUniqueError(error)) {
      return adminFailure(
        crypto.randomUUID(),
        409,
        "UNIQUE_CONFLICT",
        "Một slug hoặc SKU vừa được tạo bởi thao tác khác. Chưa có sản phẩm nào được lưu.",
      );
    }
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "Không thể nhập sản phẩm lúc này.");
  }
}

function canManageCatalog(role: string): boolean {
  return role === "owner" || role === "catalog_manager" || role === "content_manager";
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
