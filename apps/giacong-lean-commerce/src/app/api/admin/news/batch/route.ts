import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import {
  AdminNewsIdempotencyConflictError,
  AdminNewsValidationError,
  batchAdminNewsPublication,
  type AdminNewsBatchItem,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageNews } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import { revalidatePublishedStorefront, withStorefrontPurgeHeader } from "@/lib/storefront-revalidate";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xử lý hàng loạt bài viết.");
  }

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  const requestId = isRecord(body) && typeof body.requestId === "string"
    ? body.requestId.trim().toLowerCase()
    : parsedRequest.requestId;
  const items = isRecord(body) ? parseBatchItems(body.items) : null;
  if (
    !isRecord(body)
    || !isAdminRequestId(body.requestId)
    || typeof body.publish !== "boolean"
    || !items
    || !hasOnlyKeys(body, ["requestId", "publish", "items"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId, publish và danh sách bài viết hợp lệ.");
  }

  try {
    const result = await batchAdminNewsPublication(guard.database, {
      actorSubject: guard.actorSubject,
      items,
      publish: body.publish,
      requestId,
    });
    const paths = ["/", "/tin-tuc"];
    revalidatePublishedStorefront({
      tags: ["news", "published-news"],
      paths,
    });
    return withStorefrontPurgeHeader(adminSuccess(requestId, result), paths);
  } catch (error) {
    if (error instanceof AdminNewsIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof AdminNewsValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(requestId, error, body.publish ? "Không thể phát hành hàng loạt bài viết." : "Không thể ẩn hàng loạt bài viết.");
  }
}

function parseBatchItems(value: unknown): AdminNewsBatchItem[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const items: AdminNewsBatchItem[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== "number" || !Number.isInteger(entry.id) || entry.id < 1
      || typeof entry.expectedRevision !== "number" || !Number.isInteger(entry.expectedRevision) || entry.expectedRevision < 1) {
      return null;
    }
    items.push({ expectedRevision: entry.expectedRevision, id: entry.id });
  }
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
