import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  AdminServiceWriteConflictError,
  AdminServiceWriteIdempotencyConflictError,
  AdminServiceWriteValidationError,
  createAdminServiceAtomically,
} from "@/lib/admin-service-write.ts";
import { listAdminServices, getAdminService } from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageServices } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminServiceCreateCommand } from "@/lib/admin-service-command.ts";
import { attachAdminServiceRevisions, attachAdminServiceRevision } from "@/lib/admin-service-revision.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "services.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem dịch vụ.");
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 20), 100);

  try {
    const data = await listAdminServices(guard.database, {
      page,
      pageSize,
      query: url.searchParams.get("query") ?? undefined,
    });
    const services = await attachAdminServiceRevisions(guard.database, data.services);
    return adminSuccess(crypto.randomUUID(), {
      services,
      total: data.total,
      pagination: {
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(data.total / pageSize)),
        pageSize,
        total: data.total,
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách dịch vụ.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageServices(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo dịch vụ.");
  }

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminServiceCreateCommand(parsedRequest.body);
  const requestId = parsed.command?.requestId ?? parsedRequest.requestId;
  if (!parsed.command) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu dịch vụ chưa hợp lệ.", parsed.fieldErrors);
  }
  if (parsed.command.input.status === "published") {
    return adminFailure(
      requestId,
      422,
      "VALIDATION_ERROR",
      "Dịch vụ mới cần được tạo ở draft trước khi phát hành.",
      { status: "Hãy lưu draft rồi mới publish." },
    );
  }

  try {
    const id = await createAdminServiceAtomically(guard.database, parsed.command.input, guard.actorSubject, requestId);
    const service = await getAdminService(guard.database, id);
    if (!service) return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không đọc lại được dịch vụ vừa tạo.");
    return adminSuccess(requestId, { service: await attachAdminServiceRevision(guard.database, service) }, 201);
  } catch (error) {
    return mapServiceWriteError(requestId, error, "Không thể tạo dịch vụ.", { fieldErrors: { slug: "Slug đã tồn tại." } });
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function mapServiceWriteError(
  requestId: string,
  error: unknown,
  fallbackMessage: string,
  conflict: { fieldErrors?: Record<string, string>; message?: string },
): Response {
  if (error instanceof AdminServiceWriteConflictError) {
    return adminFailure(requestId, 409, "STALE_WRITE", error.message);
  }
  if (error instanceof AdminServiceWriteIdempotencyConflictError) {
    return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
  }
  if (error instanceof AdminServiceWriteValidationError) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
  }
  return adminErrorFrom(requestId, error, fallbackMessage, conflict);
}
