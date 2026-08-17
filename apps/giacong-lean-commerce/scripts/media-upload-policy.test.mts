import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertMediaMultipartLength,
  MAX_MEDIA_FILE_BYTES,
  MAX_MEDIA_MULTIPART_BYTES,
  MediaUploadValidationError,
  validateMediaBytes,
  validateMediaFileMetadata,
} from "../src/lib/media-upload-policy.ts";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test("locked media policy accepts only JPEG, PNG and WebP up to 8 MiB", () => {
  assert.equal(validateMediaFileMetadata("image/jpeg", 1), "image/jpeg");
  assert.equal(validateMediaFileMetadata("image/png", MAX_MEDIA_FILE_BYTES), "image/png");
  assert.equal(validateMediaFileMetadata("image/webp", 42), "image/webp");

  assert.throws(
    () => validateMediaFileMetadata("image/avif", 100),
    (error: unknown) => error instanceof MediaUploadValidationError && error.kind === "UNSUPPORTED_TYPE",
  );
  assert.throws(
    () => validateMediaFileMetadata("image/png", MAX_MEDIA_FILE_BYTES + 1),
    (error: unknown) => error instanceof MediaUploadValidationError && error.kind === "TOO_LARGE",
  );
});

test("media content type must match the file magic bytes", () => {
  assert.doesNotThrow(() => validateMediaBytes("image/jpeg", jpeg, jpeg.byteLength));
  assert.doesNotThrow(() => validateMediaBytes("image/png", png, png.byteLength));
  assert.doesNotThrow(() => validateMediaBytes("image/webp", webp, webp.byteLength));

  assert.throws(
    () => validateMediaBytes("image/png", jpeg, jpeg.byteLength),
    (error: unknown) => error instanceof MediaUploadValidationError && error.kind === "SIGNATURE_MISMATCH",
  );
  assert.throws(
    () => validateMediaBytes("image/jpeg", jpeg, jpeg.byteLength + 1),
    (error: unknown) => error instanceof MediaUploadValidationError && error.kind === "SIZE_MISMATCH",
  );
});

test("multipart request is rejected before parsing when it exceeds file budget plus bounded overhead", () => {
  assert.doesNotThrow(() => assertMediaMultipartLength(String(MAX_MEDIA_MULTIPART_BYTES)));
  assert.throws(
    () => assertMediaMultipartLength(String(MAX_MEDIA_MULTIPART_BYTES + 1)),
    (error: unknown) => error instanceof MediaUploadValidationError && error.kind === "TOO_LARGE",
  );
});

test("admin media route enforces policy before R2 persistence", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/media/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /assertMediaMultipartLength\(request\.headers\.get\("content-length"\)\)/);
  assert.match(route, /validateMediaFileMetadata/);
  assert.match(route, /validateMediaBytes/);
  assert.doesNotMatch(route, /image\/avif/);
  assert.doesNotMatch(route, /10 \* 1024 \* 1024/);
  assert.ok(
    route.indexOf("validateMediaBytes") < route.indexOf("createMediaAsset(guard.database"),
    "magic-byte validation must happen before media persistence",
  );
});

test("media metadata and audit are one D1 batch with R2 compensation on failure", async () => {
  const data = await readFile(new URL("../src/lib/media-data.ts", import.meta.url), "utf8");

  assert.match(data, /const batchDatabase = requireBatch\(database\)/);
  assert.match(data, /'media\.created', 'media'/);
  assert.match(data, /await batchDatabase\.batch\(statements\)/);
  assert.match(data, /await bucket\.delete\(storageKey\)\.catch/);
  assert.ok(
    data.indexOf("const batchDatabase = requireBatch(database)") < data.indexOf("await bucket.put(storageKey"),
    "D1 batch capability must be verified before R2 upload begins",
  );
});
