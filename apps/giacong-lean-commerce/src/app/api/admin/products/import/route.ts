import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { listAdminCategories, type AdminCategory } from "@/lib/admin-data";
import { isUniqueConstraintError } from "@/lib/admin-error-mapping.ts";
import {
  findAdminProductImportConflicts,
  fingerprintAdminProductImportRows,
  importErrorsToFieldErrors,
  prepareAdminProductImportRows,
} from "@/lib/admin-product-import";
import { readJsonBodyWithinLimit, resolveAdminProductImportRequestId } from "@/lib/admin-product-import-request";
import {
  AdminProductImportIdempotencyConflictError,
  createAdminProductsAtomically,
  findAdminProductImportReplay,
  isAdminProductImportReplay,
} from "@/lib/admin-product-import-write";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { MAX_ADMIN_PRODUCT_IMPORT_BYTES, MAX_ADMIN_PRODUCT_IMPORT_ROWS } from "@/lib/admin-product-import-csv";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

  const requestId = resolveAdminProductImportRequestId(request.headers) ?? "";
  if (!requestId) {
    return adminFailure(
      crypto.randomUUID(),
      400,
      "INVALID_REQUEST",
      "Mỗi lần nhập cần một Idempotency-Key UUID ổn định để có thể thử lại an toàn.",
    );
  }
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(requestId, 403, "FORBIDDEN", "Vai trò hiện tại không được nhập sản phẩm.");
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return adminFailure(requestId, 415, "UNSUPPORTED_MEDIA", "Request nhập sản phẩm phải dùng Content-Type application/json.");
  }

  const declaredLength = parseDeclaredLength(request.headers.get("content-length"));
  if (declaredLength !== null && declaredLength > MAX_ADMIN_PRODUCT_IMPORT_BYTES) {
    return payloadTooLarge(requestId);
  }

  const body = await readJsonBodyWithinLimit(request, MAX_ADMIN_PRODUCT_IMPORT_BYTES);
  if (!body.ok) {
    return body.reason === "payload_too_large"
      ? payloadTooLarge(requestId)
      : adminFailure(requestId, 400, "INVALID_REQUEST", "Request nhập sản phẩm không phải JSON hợp lệ.");
  }
  if (!isRecord(body.value)) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Request nhập sản phẩm phải là một object JSON.");
  }
  if (!Array.isArray(body.value.rows) || Object.keys(body.value).some((key) => key !== "rows")) {
    return adminFailure(
      requestId,
      400,
      "INVALID_REQUEST",
      "Request nhập sản phẩm phải có đúng một trường rows là một mảng.",
    );
  }
  if (body.value.rows.length > MAX_ADMIN_PRODUCT_IMPORT_ROWS) {
    return adminFailure(
      requestId,
      422,
      "VALIDATION_ERROR",
      `Chỉ được nhập tối đa ${MAX_ADMIN_PRODUCT_IMPORT_ROWS} sản phẩm mỗi lần.`,
    );
  }

  let payloadSha256: string;
  try {
    payloadSha256 = await fingerprintAdminProductImportRows(body.value.rows);
  } catch {
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể kiểm tra dấu vân tay request nhập sản phẩm.");
  }

  try {
    const replay = await findAdminProductImportReplay(guard.database, requestId);
    if (replay) return replayResponse(requestId, replay.payloadSha256, payloadSha256, replay.productIds);
  } catch (error) {
    if (error instanceof AdminProductImportIdempotencyConflictError) {
      return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    }
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể đọc trạng thái lần nhập trước.");
  }

  let categories: AdminCategory[];
  try {
    categories = await listAdminCategories(guard.database);
  } catch {
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể đọc danh mục sản phẩm.");
  }

  const prepared = prepareAdminProductImportRows(body.value.rows, categories);
  if (prepared.errors.length > 0) {
    return adminFailure(
      requestId,
      422,
      "VALIDATION_ERROR",
      "File có lỗi. Chưa có sản phẩm nào được lưu.",
      importErrorsToFieldErrors(prepared.errors),
    );
  }
  if (prepared.entries.length > MAX_ADMIN_PRODUCT_IMPORT_ROWS) {
    return adminFailure(
      requestId,
      422,
      "VALIDATION_ERROR",
      `Chỉ được nhập tối đa ${MAX_ADMIN_PRODUCT_IMPORT_ROWS} sản phẩm mỗi lần.`,
    );
  }

  try {
    const conflicts = await findAdminProductImportConflicts(guard.database, prepared.entries);
    if (conflicts.length > 0) {
      return adminFailure(
        requestId,
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
      requestId,
      payloadSha256,
    );
    return adminSuccess(requestId, { createdCount: productIds.length, productIds, replayed: false }, 201);
  } catch (error) {
    if (error instanceof AdminProductImportIdempotencyConflictError) {
      return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    }
    if (isUniqueConstraintError(error)) {
      try {
        const replay = await findAdminProductImportReplay(guard.database, requestId);
        if (replay) return replayResponse(requestId, replay.payloadSha256, payloadSha256, replay.productIds);
      } catch (replayError) {
        if (replayError instanceof AdminProductImportIdempotencyConflictError) {
          return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", replayError.message);
        }
        // Fall through to the safe conflict response when the replay record is unavailable.
      }
      return adminFailure(
        requestId,
        409,
        "UNIQUE_CONFLICT",
        "Một slug, SKU hoặc request ID vừa được xử lý bởi thao tác khác. Chưa có import lặp được tạo.",
      );
    }
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể nhập sản phẩm lúc này.");
  }
}

function replayResponse(
  requestId: string,
  storedPayloadSha256: string,
  payloadSha256: string,
  productIds: number[],
): Response {
  if (!isAdminProductImportReplay(storedPayloadSha256, payloadSha256)) {
    return adminFailure(
      requestId,
      409,
      "IDEMPOTENCY_CONFLICT",
      "Idempotency-Key đã được dùng cho payload khác.",
    );
  }
  return adminSuccess(requestId, { createdCount: productIds.length, productIds, replayed: true });
}

function payloadTooLarge(requestId: string): Response {
  return adminFailure(
    requestId,
    413,
    "PAYLOAD_TOO_LARGE",
    `Payload nhập sản phẩm không được vượt quá ${MAX_ADMIN_PRODUCT_IMPORT_BYTES / 1024} KiB.`,
  );
}

function parseDeclaredLength(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
