import type { AdminAdmissionFailureCode } from "./admin-access.ts";

export type AdminApiErrorCode =
  | AdminAdmissionFailureCode
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_REQUEST"
  | "MEDIA_IN_USE"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "STALE_WRITE"
  | "UNIQUE_CONFLICT"
  | "UNSUPPORTED_MEDIA"
  | "VALIDATION_ERROR";

const adminResponseHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export function adminSuccess<T>(requestId: string, data: T, status = 200): Response {
  return Response.json(
    { data, ok: true, requestId },
    { headers: adminResponseHeaders, status },
  );
}

export function adminFailure(
  requestId: string,
  status: number,
  code: AdminApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): Response {
  const body: {
    code: AdminApiErrorCode;
    fieldErrors?: Record<string, string>;
    message: string;
    ok: false;
    requestId: string;
  } = { code, message, ok: false, requestId };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) body.fieldErrors = fieldErrors;
  return Response.json(body, { headers: adminResponseHeaders, status });
}
