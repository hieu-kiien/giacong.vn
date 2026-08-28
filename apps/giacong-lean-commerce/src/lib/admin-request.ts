import type { AdminApiErrorCode } from "./admin-api";

export const adminJsonBodyLimit = 64 * 1024;

export type AdminJsonRequestResult =
  | { body: unknown; ok: true; requestId: string }
  | {
      code: Extract<AdminApiErrorCode, "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA">;
      message: string;
      ok: false;
      requestId: string;
      status: 400 | 413 | 415;
    };

export async function readBoundedAdminJson(
  request: Request,
  maxBytes = adminJsonBodyLimit,
): Promise<AdminJsonRequestResult> {
  const requestId = crypto.randomUUID();
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return {
      code: "UNSUPPORTED_MEDIA",
      message: "Request phải dùng Content-Type application/json.",
      ok: false,
      requestId,
      status: 415,
    };
  }

  const contentLength = request.headers.get("content-length")?.trim();
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) {
    return {
      code: /^\d+$/.test(contentLength) ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
      message: /^\d+$/.test(contentLength)
        ? "Request vượt quá giới hạn kích thước cho phép."
        : "Content-Length không hợp lệ.",
      ok: false,
      requestId,
      status: /^\d+$/.test(contentLength) ? 413 : 400,
    };
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await request.arrayBuffer();
  } catch {
    return { code: "INVALID_REQUEST", message: "Không đọc được request.", ok: false, requestId, status: 400 };
  }
  if (bytes.byteLength > maxBytes) {
    return {
      code: "PAYLOAD_TOO_LARGE",
      message: "Request vượt quá giới hạn kích thước cho phép.",
      ok: false,
      requestId,
      status: 413,
    };
  }

  try {
    return { body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), ok: true, requestId };
  } catch {
    return { code: "INVALID_REQUEST", message: "JSON request không hợp lệ.", ok: false, requestId, status: 400 };
  }
}

export function isAdminRequestId(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}
