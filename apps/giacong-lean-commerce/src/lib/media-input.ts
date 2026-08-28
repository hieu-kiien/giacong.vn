export const adminMediaMaxBytes = 8 * 1024 * 1024;
export const adminMediaMultipartOverheadBytes = 64 * 1024;
export const adminMediaMaxRequestBytes = adminMediaMaxBytes + adminMediaMultipartOverheadBytes;

export const adminImageContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type AdminImageContentType = (typeof adminImageContentTypes)[number];

export type AdminMediaRequestSizeError = "invalid" | "too_large";

export function validateAdminMediaContentLength(value: string | null): AdminMediaRequestSizeError | null {
  if (value === null || value.trim() === "") return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return "invalid";
  return Number(normalized) > adminMediaMaxRequestBytes ? "too_large" : null;
}

export async function readBoundedAdminMultipart(
  request: Request,
): Promise<{ form: FormData; ok: true } | { ok: false; reason: "invalid" | "too_large" }> {
  const lengthError = validateAdminMediaContentLength(request.headers.get("content-length"));
  if (lengthError) return { ok: false, reason: lengthError };

  const bytes = await readRequestBytes(request, adminMediaMaxRequestBytes);
  if (!bytes) return { ok: false, reason: "too_large" };
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  try {
    const boundedRequest = new Request(request.url, { body: bytes, headers, method: request.method });
    return { form: await boundedRequest.formData(), ok: true };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function isAdminImageContentType(value: string): value is AdminImageContentType {
  return (adminImageContentTypes as readonly string[]).includes(value);
}

/**
 * Checks the bytes as well as the browser-declared MIME type. A client can
 * rename any arbitrary payload to .jpg, so the declaration alone is not a
 * sufficient upload boundary.
 */
export function validateAdminImageBytes(contentType: string, bytes: ArrayBuffer): string | null {
  if (!isAdminImageContentType(contentType)) return "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.";
  if (bytes.byteLength <= 0) return "File ảnh không được rỗng.";
  if (bytes.byteLength > adminMediaMaxBytes) return "Ảnh không được vượt quá 8 MiB.";

  const view = new Uint8Array(bytes);
  if (contentType === "image/jpeg" && hasBytes(view, [0xff, 0xd8, 0xff])) return null;
  if (contentType === "image/png" && hasBytes(view, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  if (
    contentType === "image/webp"
    && hasAscii(view, 0, "RIFF")
    && hasAscii(view, 8, "WEBP")
  ) return null;
  return "Nội dung file không khớp với định dạng ảnh đã khai báo.";
}

function hasBytes(view: Uint8Array, expected: number[]): boolean {
  return expected.every((byte, index) => view[index] === byte);
}

function hasAscii(view: Uint8Array, offset: number, expected: string): boolean {
  return [...expected].every((character, index) => view[offset + index] === character.charCodeAt(0));
}

async function readRequestBytes(request: Request, limit: number): Promise<ArrayBuffer | null> {
  if (!request.body) {
    try {
      const bytes = await request.arrayBuffer();
      return bytes.byteLength <= limit ? bytes : null;
    } catch {
      return null;
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
  } catch {
    return null;
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
