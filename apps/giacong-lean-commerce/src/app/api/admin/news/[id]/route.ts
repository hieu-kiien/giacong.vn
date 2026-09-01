import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageNews } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminNewsPayload } from "@/lib/admin-news-input";
import {
  AdminNewsConflictError,
  AdminNewsIdempotencyConflictError,
  AdminNewsValidationError,
  deleteAdminNewsPost,
  getAdminNewsPost,
  updateAdminNewsPost,
} from "@/lib/admin-data";

export const dynamic = "force-dynamic";

interface NewsRouteContext {
  params: Promise<{ id: string }>;
}

async function parseId(context: NewsRouteContext): Promise<number | null> {
  const raw = Number((await context.params).id);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

export async function GET(
  request: Request,
  context: NewsRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "news.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem bài viết.");
  }
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");

  try {
    const post = await getAdminNewsPost(guard.database, id);
    return post
      ? adminSuccess(crypto.randomUUID(), { post })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải bài viết.");
  }
}

export async function PATCH(
  request: Request,
  context: NewsRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa bài viết.");
  }
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  const requestId = isRecord(body) && typeof body.requestId === "string"
    ? body.requestId.trim().toLowerCase()
    : parsedRequest.requestId;
  if (
    !isRecord(body)
    || !isAdminRequestId(body.requestId)
    || typeof body.revision !== "number"
    || !Number.isInteger(body.revision)
    || body.revision < 1
    || !hasOnlyKeys(body, ["requestId", "revision", "content", "coverImageUrl", "excerpt", "slug", "title"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId, revision và các trường bài viết hợp lệ.");
  }

  const expectedRevision = body.revision;

  const parsed = parseAdminNewsPayload(body);
  if (!parsed.input) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu bài viết chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const post = await updateAdminNewsPost(guard.database, id, parsed.input, expectedRevision, guard.actorSubject, requestId);
    return post
      ? adminSuccess(requestId, { post })
      : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    if (error instanceof AdminNewsConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof AdminNewsIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof AdminNewsValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(requestId, error, "Không thể cập nhật bài viết.", {
      fieldErrors: { slug: "Slug bài viết đã tồn tại." },
      message: "Slug bài viết đã tồn tại.",
    });
  }
}

export async function DELETE(
  request: Request,
  context: NewsRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xóa bài viết.");
  }
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  const requestId = isRecord(body) && typeof body.requestId === "string"
    ? body.requestId.trim().toLowerCase()
    : parsedRequest.requestId;
  if (
    !isRecord(body)
    || !isAdminRequestId(body.requestId)
    || typeof body.revision !== "number"
    || !Number.isInteger(body.revision)
    || body.revision < 1
    || !hasOnlyKeys(body, ["requestId", "revision"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId và revision hợp lệ để xóa bài viết.");
  }

  try {
    const deleted = await deleteAdminNewsPost(guard.database, id, body.revision, guard.actorSubject, requestId);
    return deleted
      ? adminSuccess(requestId, { deleted: true })
      : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    if (error instanceof AdminNewsConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof AdminNewsIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof AdminNewsValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(requestId, error, "Không thể xóa bài viết.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
