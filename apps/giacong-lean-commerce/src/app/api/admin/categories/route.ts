import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { adminFailure, adminSuccess } from "@/lib/admin-api";
import {
  AdminCategoryConflictError,
  AdminCategoryIdempotencyConflictError,
  AdminCategoryNotFoundError,
  AdminCategoryValidationError,
  createCategory,
  listCategories,
} from "@/lib/admin-category-repository";

export const dynamic = "force-dynamic";
const MAX_PAGE_SIZE = 100;
const MAX_BODY_BYTES = 64 * 1024;

export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);

  const url = new URL(request.url);
  const page = boundedQueryInt(url.searchParams.get("page"), 1, 1_000_000);
  const pageSize = boundedQueryInt(url.searchParams.get("pageSize"), 50, MAX_PAGE_SIZE);
  const result = await listCategories(page, pageSize);
  return adminSuccess(requestId, { ...result, page, pageSize });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  if (!isJson(request.headers.get("content-type"))) return adminFailure(requestId, 415, "UNSUPPORTED_MEDIA", "Content-Type không được hỗ trợ.");

  try {
    const body = await readJson(request);
    const category = await createCategory(body, admission.actor.subject, requestId);
    return adminSuccess(requestId, category, 201);
  } catch (error) {
    return mapError(requestId, error);
  }
}

function boundedQueryInt(value: string | null, fallback: number, max: number): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : fallback;
}

function isJson(value: string | null): boolean {
  return Boolean(value && value.toLowerCase().split(";", 1)[0].trim() === "application/json");
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new PayloadTooLargeError();
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) throw new PayloadTooLargeError();
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AdminCategoryValidationError("Malformed JSON request."); }
}

function mapError(requestId: string, error: unknown): Response {
  if (error instanceof PayloadTooLargeError) return adminFailure(requestId, 413, "PAYLOAD_TOO_LARGE", "Request quá lớn.");
  if (error instanceof AdminCategoryValidationError || error instanceof Error && /required|invalid|must be|exceeds|slug/i.test(error.message)) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu danh mục không hợp lệ.");
  }
  if (error instanceof AdminCategoryConflictError) return adminFailure(requestId, 409, "UNIQUE_CONFLICT", "Danh mục đã thay đổi hoặc slug đã tồn tại.");
  if (error instanceof AdminCategoryIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", "Request ID đã được sử dụng cho payload khác.");
  if (error instanceof AdminCategoryNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy danh mục.");
  return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể hoàn tất thao tác quản trị.");
}

class PayloadTooLargeError extends Error {}
