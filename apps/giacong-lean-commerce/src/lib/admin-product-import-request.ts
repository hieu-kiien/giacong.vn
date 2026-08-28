const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type JsonBodyReadResult =
  | { byteLength: number; ok: true; value: unknown }
  | { ok: false; reason: "invalid_json" | "payload_too_large" };

export function resolveAdminProductImportRequestId(headers: Headers): string | null {
  const idempotencyKey = normalizeHeaderValue(headers.get("idempotency-key"));
  const requestId = normalizeHeaderValue(headers.get("x-request-id"));
  if (!idempotencyKey && !requestId) return null;
  if (idempotencyKey && requestId && idempotencyKey !== requestId) return null;
  const candidate = idempotencyKey ?? requestId;
  return candidate && UUID_V4_PATTERN.test(candidate) ? candidate : null;
}

export function isAdminProductImportRequestId(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

export async function readJsonBodyWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyReadResult> {
  const body = request.body;
  if (!body) return { ok: false, reason: "invalid_json" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const value = chunk.value;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "payload_too_large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { byteLength, ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

function normalizeHeaderValue(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}
