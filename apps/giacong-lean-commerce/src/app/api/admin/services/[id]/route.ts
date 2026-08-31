import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  AdminServiceWriteConflictError,
  AdminServiceWriteIdempotencyConflictError,
  AdminServiceWriteValidationError,
  archiveAdminServiceAtomically,
  updateAdminServiceAtomically,
} from "@/lib/admin-service-write.ts";
import {
  getAdminService,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageServices } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import {
  parseAdminServiceArchiveCommand,
  parseAdminServiceUpdateCommand,
} from "@/lib/admin-service-command.ts";
import { attachAdminServiceRevision } from "@/lib/admin-service-revision.ts";

export const dynamic = "force-dynamic";

interface ServiceRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  context: ServiceRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "services.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem dịch vụ.");
  }
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");

  try {
    const service = await getAdminService(guard.database, id);
    return service
      ? adminSuccess(crypto.randomUUID(), { service: await attachAdminServiceRevision(guard.database, service) })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải dịch vụ.");
  }
}

export async function PATCH(
  request: Request,
  context: ServiceRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageServices(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa dịch vụ.");
  }

  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminServiceUpdateCommand(parsedRequest.body);
  const requestId = parsed.command?.requestId ?? parsedRequest.requestId;
  if (!parsed.command) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu dịch vụ chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const changedId = await updateAdminServiceAtomically(
      guard.database,
      id,
      parsed.command.input,
      parsed.command.revision,
      guard.actorSubject,
      requestId,
    );
    if (changedId === null) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
    const service = await getAdminService(guard.database, changedId);
    if (!service) return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không đọc lại được dịch vụ vừa cập nhật.");
    return adminSuccess(requestId, { service: await attachAdminServiceRevision(guard.database, service) });
  } catch (error) {
    return mapServiceWriteError(requestId, error, "Không thể cập nhật dịch vụ.", { fieldErrors: { slug: "Slug đã tồn tại." } });
  }
}

export async function DELETE(
  request: Request,
  context: ServiceRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageServices(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được ẩn dịch vụ.");
  }

  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminServiceArchiveCommand(parsedRequest.body);
  const requestId = parsed.command?.requestId ?? parsedRequest.requestId;
  if (!parsed.command) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu ẩn dịch vụ chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const changedId = await archiveAdminServiceAtomically(
      guard.database,
      id,
      parsed.command.revision,
      guard.actorSubject,
      requestId,
    );
    if (changedId === null) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
    const service = await getAdminService(guard.database, changedId);
    if (!service) return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không đọc lại được dịch vụ vừa ẩn.");
    return adminSuccess(requestId, { service: await attachAdminServiceRevision(guard.database, service) });
  } catch (error) {
    return mapServiceWriteError(requestId, error, "Không thể ẩn dịch vụ.", {});
  }
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

async function parseId(context: ServiceRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
