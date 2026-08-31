import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  archiveAdminService,
  getAdminService,
  updateAdminService,
  type AdminServiceInput,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageServices } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminServicePayload } from "@/lib/admin-service-input";

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
      ? adminSuccess(crypto.randomUUID(), { service })
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
  const existing = await getAdminService(guard.database, id);
  if (!existing) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminServicePayload(parsedRequest.body, serviceDefaults(existing));
  if (!parsed.input) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu dịch vụ chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const service = await updateAdminService(guard.database, id, parsed.input, guard.actorSubject);
    return service
      ? adminSuccess(parsedRequest.requestId, { service })
      : adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể cập nhật dịch vụ.", { fieldErrors: { slug: "Slug đã tồn tại." } });
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

  try {
    const service = await archiveAdminService(guard.database, id, guard.actorSubject);
    return service
      ? adminSuccess(crypto.randomUUID(), { service })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể ẩn dịch vụ.");
  }
}

function serviceDefaults(service: {
  description: string;
  imageUrl: string | null;
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
    imageUrl: service.imageUrl,
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
