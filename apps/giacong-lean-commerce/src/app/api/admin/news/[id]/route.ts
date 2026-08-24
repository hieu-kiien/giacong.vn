import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { parseAdminNewsPayload } from "@/lib/admin-news-input";
import { deleteAdminNewsPost, getAdminNewsPost, updateAdminNewsPost } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

interface NewsRouteContext {
  params: Promise<{ id: string }>;
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
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

  let payload: Record<string, unknown> = {};
  try {
    const body: unknown = await request.json();
    payload = typeof body === "object" && body !== null && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch {
    return adminFailure(crypto.randomUUID(), 400, "INVALID_REQUEST", "Dữ liệu gửi lên không hợp lệ.");
  }

  const expectedRevision = Number(payload.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", "Thiếu phiên bản dữ liệu (revision). Hãy tải lại bài viết rồi lưu lại.");
  }

  const parsed = parseAdminNewsPayload(payload);
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu bài viết chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const post = await updateAdminNewsPost(guard.database, id, parsed.input, expectedRevision, guard.actorSubject);
    return post
      ? adminSuccess(crypto.randomUUID(), { post })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    if (error instanceof Error && /đã thay đổi|stale/i.test(error.message)) {
      return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", "Bài viết đã được người khác cập nhật. Hãy tải lại rồi thử lại.");
    }
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể cập nhật bài viết.", {
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

  try {
    const deleted = await deleteAdminNewsPost(guard.database, id, guard.actorSubject);
    return deleted
      ? adminSuccess(crypto.randomUUID(), { deleted: true })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể xóa bài viết.");
  }
}
