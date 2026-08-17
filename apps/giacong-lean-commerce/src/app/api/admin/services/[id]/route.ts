import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  getAdminService,
  type AdminServiceInput,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { parseAdminServicePayload } from "@/lib/admin-service-input";
import { attachAdminServiceRevision } from "@/lib/admin-service-revision";
import {
  AdminServiceStaleWriteError,
  archiveAdminServiceAtomically,
  updateAdminServiceAtomically,
} from "@/lib/admin-service-write";

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
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");

  try {
    const service = await getAdminService(guard.database, id);
    return service
      ? adminSuccess(crypto.randomUUID(), { service: await attachAdminServiceRevision(guard.database, service) })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tải dịch vụ.",
    );
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
  const existing = await getAdminService(guard.database, id);
  if (!existing) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi cập nhật dịch vụ.",
      { revision: "Hãy tải lại dịch vụ và gửi revision hiện tại." },
    );
  }
  const parsed = parseAdminServicePayload(payload, serviceDefaults(existing));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu dịch vụ chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    await updateAdminServiceAtomically(
      guard.database,
      id,
      parsed.input,
      payload.revision,
      guard.actorSubject,
    );
    const service = await getAdminService(guard.database, id);
    return service
      ? adminSuccess(crypto.randomUUID(), { service: await attachAdminServiceRevision(guard.database, service) })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
  } catch (error) {
    const stale = error instanceof AdminServiceStaleWriteError;
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : unique ? 409 : 503,
      stale ? "STALE_WRITE" : unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể cập nhật dịch vụ.",
      unique ? { slug: "Slug đã tồn tại." } : undefined,
    );
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
  const existing = await getAdminService(guard.database, id);
  if (!existing) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi ẩn dịch vụ.",
      { revision: "Hãy tải lại dịch vụ và gửi revision hiện tại." },
    );
  }

  try {
    await archiveAdminServiceAtomically(
      guard.database,
      id,
      payload.revision,
      guard.actorSubject,
    );
    const service = await getAdminService(guard.database, id);
    return service
      ? adminSuccess(crypto.randomUUID(), { service: await attachAdminServiceRevision(guard.database, service) })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
  } catch (error) {
    const stale = error instanceof AdminServiceStaleWriteError;
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : 503,
      stale ? "STALE_WRITE" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể ẩn dịch vụ.",
    );
  }
}

function canManageServices(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

function serviceDefaults(service: {
  description: string;
  isActive: boolean;
  leadTimeDays: number | null;
  moqSummary: string | null;
  name: string;
  slug: string;
  status: string;
  summary: string;
}): Partial<AdminServiceInput> {
  return {
    description: service.description,
    isActive: service.isActive,
    leadTimeDays: service.leadTimeDays,
    moqSummary: service.moqSummary,
    name: service.name,
    slug: service.slug,
    status: service.status as AdminServiceInput["status"],
    summary: service.summary,
  };
}

async function parseId(context: ServiceRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function hasExplicitRevision(value: unknown): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "revision");
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
