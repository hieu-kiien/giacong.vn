import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminService, listAdminServices } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { parseAdminServicePayload } from "@/lib/admin-service-input";
import {
  attachAdminServiceRevision,
  attachAdminServiceRevisions,
} from "@/lib/admin-service-revision";
import { createAdminServiceAtomically } from "@/lib/admin-service-write";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

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
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tải danh sách dịch vụ.",
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageServices(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo dịch vụ.");
  }

  const parsed = parseAdminServicePayload(await readJson(request));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu dịch vụ chưa hợp lệ.", parsed.fieldErrors);
  }
  if (parsed.input.status === "published") {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Dịch vụ mới cần được tạo ở draft trước khi phát hành.",
      { status: "Hãy lưu draft rồi mới publish." },
    );
  }

  try {
    const serviceId = await createAdminServiceAtomically(
      guard.database,
      parsed.input,
      guard.actorSubject,
    );
    const service = await getAdminService(guard.database, serviceId);
    if (!service) {
      return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "Không đọc lại được dịch vụ vừa tạo.");
    }
    return adminSuccess(
      crypto.randomUUID(),
      { service: await attachAdminServiceRevision(guard.database, service) },
      201,
    );
  } catch (error) {
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      unique ? 409 : 503,
      unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tạo dịch vụ.",
      unique ? { slug: "Slug đã tồn tại." } : undefined,
    );
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function canManageServices(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
