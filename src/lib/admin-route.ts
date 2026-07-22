import "server-only";
import { NextResponse } from "next/server";
import { AdminBffError, type AdminUpstreamResult } from "@/lib/admin-bff";

const messages: Record<string, string> = {
  unauthenticated: "Phiên đăng nhập đã hết hạn.", forbidden: "Bạn không có quyền truy cập nội dung này.", session_expired: "Phiên bảo mật đã hết hạn. Vui lòng thử lại.", validation_failed: "Dữ liệu gửi lên không hợp lệ.", too_many_requests: "Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau.", invalid_credentials: "Thông tin đăng nhập không hợp lệ.", invalid_two_factor_code: "Mã xác thực không hợp lệ.", two_factor_required: "Cần xác thực hai lớp.", invalid_origin: "Yêu cầu không hợp lệ.", not_found: "Không tìm thấy dữ liệu yêu cầu.", upstream_timeout: "Dịch vụ quản trị đang phản hồi chậm.", upstream_unavailable: "Dịch vụ quản trị tạm thời không khả dụng.", invalid_request: "Yêu cầu không hợp lệ.",
};

export function adminJson(data: unknown, result: AdminUpstreamResult, status = result.status): NextResponse {
  const response = NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } });
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
