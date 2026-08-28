import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageNews } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminNewsPayload } from "@/lib/admin-news-input";
import { createAdminNewsPost, listAdminNewsPosts } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;
  const pageSize = Math.min(Number(url.searchParams.get("pageSize")) || 20, 100);

  try {
    const data = await listAdminNewsPosts(guard.database, {
      page: page > 0 ? page : 1,
      pageSize: pageSize > 0 ? pageSize : 20,
    });
    return adminSuccess(crypto.randomUUID(), {
      ...data,
      pagination: {
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(data.total / pageSize)),
        pageSize,
        total: data.total,
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách bài viết.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được viết bài.");
  }

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const payload = parsedRequest.body;
  const requestId = isRecord(payload) && typeof payload.requestId === "string"
    ? payload.requestId.trim().toLowerCase()
    : parsedRequest.requestId;
  if (
    !isRecord(payload)
    || !isAdminRequestId(payload.requestId)
    || !hasOnlyKeys(payload, ["requestId", "content", "coverImageUrl", "excerpt", "slug", "title"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId và các trường bài viết hợp lệ.");
  }

  const parsed = parseAdminNewsPayload(payload);
  if (!parsed.input) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu bài viết chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const post = await createAdminNewsPost(guard.database, parsed.input, guard.actorSubject, requestId);
    return adminSuccess(requestId, { post }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "AdminNewsIdempotencyConflictError") {
      return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    }
    if (error instanceof Error && error.name === "AdminNewsValidationError") {
      return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    }
    return adminErrorFrom(requestId, error, "Không thể tạo bài viết.", {
      fieldErrors: { slug: "Slug bài viết đã tồn tại." },
      message: "Slug bài viết đã tồn tại.",
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
