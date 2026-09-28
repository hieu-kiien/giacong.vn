import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import { MAX_PRODUCT_GALLERY_IMAGES } from "./admin-product-gallery-contract.ts";

export { MAX_PRODUCT_GALLERY_IMAGES } from "./admin-product-gallery-contract.ts";
const MAX_PRODUCT_GALLERY_IMAGE_URL_LENGTH = 2_048;

export interface AdminProductGalleryImageInput {
  imageUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

export class AdminProductGalleryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminProductGalleryValidationError";
  }
}

export function parseAdminProductGalleryPayload(value: unknown): AdminProductGalleryImageInput[] {
  if (!isRecord(value) || !Array.isArray(value.images)) {
    throw new AdminProductGalleryValidationError("Request phải có danh sách images hợp lệ.");
  }
  if (value.images.length > MAX_PRODUCT_GALLERY_IMAGES) {
    throw new AdminProductGalleryValidationError(`Thư viện chỉ hỗ trợ tối đa ${MAX_PRODUCT_GALLERY_IMAGES} ảnh.`);
  }

  const seenUrls = new Set<string>();
  const images = value.images.map((item, index): AdminProductGalleryImageInput => {
    if (!isRecord(item) || typeof item.imageUrl !== "string") {
      throw new AdminProductGalleryValidationError(`Ảnh thứ ${index + 1} thiếu URL hợp lệ.`);
    }

    const imageUrl = item.imageUrl.trim();
    if (!isSafeGalleryImageUrl(imageUrl)) {
      throw new AdminProductGalleryValidationError(`URL ảnh thứ ${index + 1} không hợp lệ.`);
    }
    if (seenUrls.has(imageUrl)) {
      throw new AdminProductGalleryValidationError("Thư viện không thể chứa cùng một URL ảnh nhiều lần.");
    }
    seenUrls.add(imageUrl);

    if (item.isPrimary !== undefined && typeof item.isPrimary !== "boolean") {
      throw new AdminProductGalleryValidationError(`Ảnh thứ ${index + 1} có trạng thái ảnh chính không hợp lệ.`);
    }

    return {
      imageUrl,
      isPrimary: item.isPrimary === undefined ? index === 0 : item.isPrimary,
      sortOrder: index,
    };
  });

  const primaryCount = images.filter((image) => image.isPrimary).length;
  if (primaryCount > 1) {
    throw new AdminProductGalleryValidationError("Chỉ được chọn một ảnh chính cho thư viện.");
  }
  if (images.length > 0 && primaryCount === 0) images[0]!.isPrimary = true;

  return images;
}

export async function replaceAdminProductGalleryAtomically(
  database: D1DatabaseLike,
  productId: number,
  images: readonly AdminProductGalleryImageInput[],
): Promise<void> {
  const databaseWithBatch = database as D1DatabaseLike & {
    batch?: (statements: D1PreparedStatementLike[]) => Promise<unknown[]>;
  };
  if (typeof databaseWithBatch.batch !== "function") {
    throw new Error("D1 batch() là bắt buộc để lưu thư viện ảnh an toàn.");
  }

  const statements = [
    database.prepare("DELETE FROM product_gallery_images WHERE product_id = ?").bind(productId),
    ...images.map((image) => database.prepare(`
      INSERT INTO product_gallery_images (product_id, image_url, sort_order, is_primary)
      VALUES (?, ?, ?, ?)
    `).bind(productId, image.imageUrl, image.sortOrder, image.isPrimary ? 1 : 0)),
  ];
  const results = await databaseWithBatch.batch(statements);
  if (!Array.isArray(results) || results.length !== statements.length) {
    throw new Error("D1 batch trả về kết quả thư viện ảnh không hợp lệ.");
  }
}

function isSafeGalleryImageUrl(value: string): boolean {
  if (!value || value.length > MAX_PRODUCT_GALLERY_IMAGE_URL_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
