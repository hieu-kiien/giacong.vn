import type { AdminProduct, AdminProductInput, AdminPublishStatus } from "./admin-data";

const statuses = new Set<AdminPublishStatus>(["draft", "review", "published", "archived"]);

export function parseAdminProductPayload(
  payload: unknown,
  defaults: Partial<AdminProductInput> = {},
): { fieldErrors: Record<string, string>; input: AdminProductInput | null } {
  const source = isRecord(payload) ? payload : {};
  const merged = { ...defaults, ...source };
  const fieldErrors: Record<string, string> = {};

  const name = textField(merged.name, "Tên sản phẩm", 160, fieldErrors, "name");
  const slug = textField(merged.slug, "Slug", 120, fieldErrors, "slug");
  const sku = textField(merged.sku, "SKU", 80, fieldErrors, "sku");
  const shortDescription = textField(merged.shortDescription, "Mô tả ngắn", 1000, fieldErrors, "shortDescription", false);
  const description = textField(merged.description, "Mô tả", 12000, fieldErrors, "description", false);
  const status = parseStatus(merged.status, fieldErrors);
  const categoryId = parseNullablePositiveInteger(merged.categoryId, "Danh mục", fieldErrors, "categoryId");
  const leadTimeDays = parseNullableNonNegativeInteger(merged.leadTimeDays, "Lead time", fieldErrors, "leadTimeDays");
  const imageUrl = parseImageUrl(merged.imageUrl, fieldErrors);
  const requestedActive = merged.isActive === true;
  const isActive = status === "published" && requestedActive;

  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fieldErrors.slug = "Slug chỉ gồm chữ thường, số và dấu gạch ngang.";
  }
  if (status === "published" && !requestedActive) {
    fieldErrors.isActive = "Sản phẩm published phải được bật hiển thị.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, input: null };
  return {
    fieldErrors,
    input: {
      categoryId,
      description,
      imageUrl,
      isActive,
      leadTimeDays,
      name,
      shortDescription,
      sku,
      slug,
      status,
    },
  };
}

export function productDefaults(product: AdminProduct): AdminProductInput {
  return {
    categoryId: product.categoryId,
    description: product.description,
    imageUrl: product.imageUrl,
    isActive: product.isActive,
    leadTimeDays: product.leadTimeDays,
    name: product.name,
    shortDescription: product.shortDescription,
    sku: product.sku,
    slug: product.slug,
    status: product.status,
  };
}

function textField(
  value: unknown,
  label: string,
  maxLength: number,
  errors: Record<string, string>,
  key: string,
  required = true,
): string {
  if (typeof value !== "string") {
    if (required) errors[key] = `${label} là bắt buộc.`;
    return "";
  }
  const result = value.trim();
  if (required && !result) errors[key] = `${label} là bắt buộc.`;
  if (result.length > maxLength) errors[key] = `${label} không được vượt quá ${maxLength} ký tự.`;
  return result;
}

function parseStatus(value: unknown, errors: Record<string, string>): AdminPublishStatus {
  if (typeof value === "string" && statuses.has(value as AdminPublishStatus)) return value as AdminPublishStatus;
  errors.status = "Trạng thái sản phẩm không hợp lệ.";
  return "draft";
}

function parseNullablePositiveInteger(
  value: unknown,
  label: string,
  errors: Record<string, string>,
  key: string,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    errors[key] = `${label} phải là số nguyên dương hoặc để trống.`;
    return null;
  }
  return parsed;
}

function parseNullableNonNegativeInteger(
  value: unknown,
  label: string,
  errors: Record<string, string>,
  key: string,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3650) {
    errors[key] = `${label} phải là số nguyên từ 0 đến 3650 hoặc để trống.`;
    return null;
  }
  return parsed;
}

function parseImageUrl(value: unknown, errors: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    errors.imageUrl = "Đường dẫn ảnh không hợp lệ.";
    return null;
  }
  const result = value.trim();
  if (result.startsWith("/")) return result;
  try {
    const parsed = new URL(result);
    if (parsed.protocol !== "https:") throw new Error("HTTPS required");
    return parsed.toString();
  } catch {
    errors.imageUrl = "Ảnh phải là đường dẫn nội bộ hoặc URL HTTPS.";
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}