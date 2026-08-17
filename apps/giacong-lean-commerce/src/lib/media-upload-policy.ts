export const MAX_MEDIA_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_MEDIA_MULTIPART_BYTES = MAX_MEDIA_FILE_BYTES + (256 * 1024);

export type AllowedMediaContentType = "image/jpeg" | "image/png" | "image/webp";

export class MediaUploadValidationError extends Error {
  readonly kind: "SIGNATURE_MISMATCH" | "SIZE_MISMATCH" | "TOO_LARGE" | "UNSUPPORTED_TYPE";

  constructor(
    kind: MediaUploadValidationError["kind"],
    message: string,
  ) {
    super(message);
    this.name = "MediaUploadValidationError";
    this.kind = kind;
  }
}

export function validateMediaFileMetadata(
  contentType: string,
  size: number,
): AllowedMediaContentType {
  if (contentType !== "image/jpeg" && contentType !== "image/png" && contentType !== "image/webp") {
    throw new MediaUploadValidationError("UNSUPPORTED_TYPE", "Ảnh phải là JPEG, PNG hoặc WebP.");
  }
  if (!Number.isInteger(size) || size <= 0) {
    throw new MediaUploadValidationError("SIZE_MISMATCH", "File ảnh rỗng hoặc có kích thước không hợp lệ.");
  }
  if (size > MAX_MEDIA_FILE_BYTES) {
    throw new MediaUploadValidationError("TOO_LARGE", "Ảnh không được vượt quá 8 MiB.");
  }
  return contentType;
}

export function validateMediaBytes(
  contentType: AllowedMediaContentType,
  bytes: Uint8Array,
  declaredSize: number,
): void {
  if (bytes.byteLength !== declaredSize || bytes.byteLength <= 0) {
    throw new MediaUploadValidationError("SIZE_MISMATCH", "Kích thước file ảnh không khớp payload đã khai báo.");
  }
  if (bytes.byteLength > MAX_MEDIA_FILE_BYTES) {
    throw new MediaUploadValidationError("TOO_LARGE", "Ảnh không được vượt quá 8 MiB.");
  }
  if (!matchesSignature(contentType, bytes)) {
    throw new MediaUploadValidationError("SIGNATURE_MISMATCH", "Nội dung file không khớp định dạng ảnh đã khai báo.");
  }
}

export function assertMediaMultipartLength(contentLengthHeader: string | null): void {
  if (!contentLengthHeader) return;
  const contentLength = Number(contentLengthHeader);
  if (!Number.isFinite(contentLength) || contentLength < 0) return;
  if (contentLength > MAX_MEDIA_MULTIPART_BYTES) {
    throw new MediaUploadValidationError("TOO_LARGE", "Payload upload vượt quá giới hạn cho phép.");
  }
}

export function extensionForMediaType(contentType: AllowedMediaContentType): ".jpg" | ".png" | ".webp" {
  return contentType === "image/jpeg" ? ".jpg" : contentType === "image/png" ? ".png" : ".webp";
}

function matchesSignature(contentType: AllowedMediaContentType, bytes: Uint8Array): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
  }
  return bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
}
