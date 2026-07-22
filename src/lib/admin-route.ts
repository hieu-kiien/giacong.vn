import "server-only";
import { NextResponse } from "next/server";
import { AdminBffError, type AdminUpstreamResult } from "@/lib/admin-bff";

const messages: Record<string, string> = {
  unauthenticated: "Phiên đăng nhập đã hết hạn.", forbidden: "Bạn không có quyền truy cập nội dung này.", session_expired: "Phiên bảo mật đã hết hạn. Vui lòng thử lại.", validation_failed: "Dữ liệu gửi lên không hợp lệ.", version_conflict: "Dữ liệu đã thay đổi kể từ lần tải gần nhất.", precondition_required: "Cần tải phiên bản dữ liệu mới nhất trước khi lưu.", too_many_requests: "Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau.", invalid_credentials: "Thông tin đăng nhập không hợp lệ.", invalid_two_factor_code: "Mã xác thực không hợp lệ.", two_factor_required: "Cần xác thực hai lớp.", invalid_origin: "Yêu cầu không hợp lệ.", not_found: "Không tìm thấy dữ liệu yêu cầu.", upstream_timeout: "Dịch vụ quản trị đang phản hồi chậm.", upstream_unavailable: "Dịch vụ quản trị tạm thời không khả dụng.", invalid_request: "Yêu cầu không hợp lệ.",
};

export function adminJson(data: unknown, result: AdminUpstreamResult, status = result.status): NextResponse {
  const response = NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } });
  if (result.etag) response.headers.set("ETag", result.etag);
  for (const cookie of result.setCookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

export function adminNoContent(result: AdminUpstreamResult): NextResponse {
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store, private" } });
  for (const cookie of result.setCookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

export function adminFailure(error: unknown, upstream?: AdminUpstreamResult): NextResponse {
  const failure = error instanceof AdminBffError ? error : upstreamFailure(upstream);
  const headers = new Headers({ "Cache-Control": "no-store, private" });
  if (failure.retryAfter) headers.set("Retry-After", failure.retryAfter);
  const response = NextResponse.json({ code: failure.code, message: messages[failure.code] ?? messages.upstream_unavailable }, { status: failure.status, headers });
  for (const cookie of upstream?.setCookies ?? []) response.headers.append("Set-Cookie", cookie);
  return response;
}

export function upstreamFailure(result: AdminUpstreamResult | undefined): AdminBffError {
  if (!result) return new AdminBffError(502, "upstream_unavailable");
  const mapping: Record<number, [number, string]> = { 401: [401, "unauthenticated"], 403: [403, "forbidden"], 404: [404, "not_found"], 419: [419, "session_expired"], 422: [422, "validation_failed"], 429: [429, "too_many_requests"] };
  const selected = mapping[result.status] ?? [502, "upstream_unavailable"];
  return new AdminBffError(selected[0], selected[1], result.retryAfter);
}

export function adminMutationFailure(result: AdminUpstreamResult): NextResponse {
  const mapping: Record<number, string> = {
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    412: "version_conflict",
    419: "session_expired",
    422: "validation_failed",
    428: "precondition_required",
    429: "too_many_requests",
  };
  const code = mapping[result.status];
  if (!code || !validErrorEnvelope(result.payload, result.status)) {
    return adminFailure(new AdminBffError(502, "upstream_unavailable"), result);
  }
  const fields = result.status === 422 ? safeValidationFields(result.payload) : undefined;
  const response = NextResponse.json(
    { code, message: messages[code], ...(fields ? { fields } : {}) },
    { status: result.status, headers: { "Cache-Control": "no-store, private" } },
  );
  if (result.status === 412 && result.etag) response.headers.set("ETag", result.etag);
  if (result.retryAfter) response.headers.set("Retry-After", result.retryAfter);
  for (const cookie of result.setCookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

function validErrorEnvelope(payload: unknown, status: number): payload is Record<string, unknown> {
  if (!record(payload)) return false;
  const keys = Object.keys(payload).sort();
  const expected = status === 422 && "fields" in payload
    ? ["code", "fields", "message", "trace_id"]
    : ["code", "message", "trace_id"];
  if (keys.join("|") !== expected.sort().join("|")) return false;
  if (typeof payload.code !== "string" || typeof payload.message !== "string" || typeof payload.trace_id !== "string") return false;
  const backendCodes: Record<number, string> = {
    401: "unauthenticated", 403: "forbidden", 404: "not_found", 412: "precondition_failed",
    419: "csrf_mismatch", 422: "validation_failed", 428: "precondition_required", 429: "too_many_requests",
  };
  return payload.code === backendCodes[status] && /^[0-9a-f-]{36}$/i.test(payload.trace_id);
}

function safeValidationFields(payload: Record<string, unknown>): Record<string, string[]> | undefined {
  if (!("fields" in payload)) return undefined;
  if (!record(payload.fields)) throw new AdminBffError(502, "upstream_unavailable");
  const safe: Record<string, string[]> = {};
  for (const [path, messages] of Object.entries(payload.fields)) {
    if (!safeFieldPath(path) || !Array.isArray(messages) || messages.length < 1 || messages.length > 8 || !messages.every((message) => typeof message === "string")) {
      throw new AdminBffError(502, "upstream_unavailable");
    }
    safe[path] = ["Giá trị không hợp lệ."];
  }
  return safe;
}

function safeFieldPath(path: string): boolean {
  return /^(?:snapshot|published|variants|variants\.\d+\.(?:id|published|unit|moq|quantity_step|contact_from_quantity|tier_prices|tier_prices\.\d+\.(?:min_quantity|unit_price)))$/.test(path);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
