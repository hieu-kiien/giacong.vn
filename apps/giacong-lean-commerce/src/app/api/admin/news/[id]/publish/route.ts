import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import {
  AdminNewsConflictError,
  AdminNewsIdempotencyConflictError,
  AdminNewsValidationError,
  publishAdminNewsPost,
  unpublishAdminNewsPost,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageNews } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được phát hành bài viết.");
  }
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  const requestId = isRecord(body) && typeof body.requestId === "string"
    ? body.requestId.trim().toLowerCase()
    : parsedRequest.requestId;
  if (
    !isRecord(body)
    || !isAdminRequestId(body.requestId)
    || typeof body.expectedRevision !== "number"
    || !Number.isInteger(body.expectedRevision)
    || body.expectedRevision < 1
    || typeof body.publish !== "boolean"
    || !hasOnlyKeys(body, ["requestId", "expectedRevision", "publish"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId, expectedRevision và publish hợp lệ.");
  }

  try {
    const post = body.publish
      ? await publishAdminNewsPost(guard.database, id, body.expectedRevision, guard.actorSubject, requestId)
      : await unpublishAdminNewsPost(guard.database, id, body.expectedRevision, guard.actorSubject, requestId);
    return post
      ? adminSuccess(requestId, { post })
      : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    if (error instanceof AdminNewsConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof AdminNewsIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof AdminNewsValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(requestId, error, body.publish ? "Không thể phát hành bài viết." : "Không thể ẩn bài viết.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
