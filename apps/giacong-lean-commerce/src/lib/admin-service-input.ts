import type { AdminPublishStatus, AdminServiceInput } from "./admin-data";

const statuses = new Set<AdminPublishStatus>(["draft", "review", "published", "archived"]);

export function parseAdminServicePayload(
  payload: unknown,
  defaults: Partial<AdminServiceInput> = {},
): { fieldErrors: Record<string, string>; input: AdminServiceInput | null } {
  const source = isRecord(payload) ? payload : {};
  const merged = { ...defaults, ...source };
  const fieldErrors: Record<string, string> = {};
  const name = textField(merged.name, "Tên dịch vụ", 160, fieldErrors, "name");
  const slug = textField(merged.slug, "Slug", 120, fieldErrors, "slug");
  const summary = textField(merged.summary, "Tóm tắt", 2000, fieldErrors, "summary", false);
  const description = textField(merged.description, "Mô tả", 12000, fieldErrors, "description", false);
  const moqSummary = nullableTextField(merged.moqSummary, "MOQ", 1000, fieldErrors, "moqSummary");
  const imageUrl = parseImageUrl(merged.imageUrl, fieldErrors);
  const status = parseStatus(merged.status, fieldErrors);
  const leadTimeDays = parseNullableNonNegativeInteger(merged.leadTimeDays, "Lead time", fieldErrors, "leadTimeDays");
  const requestedActive = merged.isActive === true;
  const isActive = status === "published" && requestedActive;

  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fieldErrors.slug = "Slug chỉ gồm chữ thường, số và dấu gạch ngang.";
  }
  if (status === "published" && !requestedActive) {
    fieldErrors.isActive = "Dịch vụ published phải được bật hiển thị.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, input: null };
  return {
    fieldErrors,
    input: {
      description,
      imageUrl,
      isActive,
      leadTimeDays,
      moqSummary,
      name,
      slug,
      status,
      summary,
    },
  };
}

/**
 * The main image is an R2 media URL (`/media/...`) or an absolute http(s) URL.
 * Anything else is rejected rather than stored, mirroring the news cover rule.
 */
function parseImageUrl(value: unknown, errors: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    errors.imageUrl = "Ảnh chính phải là URL.";
    return null;
  }
  const result = value.trim();
  if (!result) return null;
  if (result.length > 500 || !/^(https?:\/\/.+|\/media\/.+)/i.test(result)) {
    errors.imageUrl = "Ảnh chính phải là URL http(s) hoặc đường dẫn /media/.";
    return null;
  }
  return result;
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

function nullableTextField(
  value: unknown,
  label: string,
  maxLength: number,
  errors: Record<string, string>,
  key: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    errors[key] = `${label} không hợp lệ.`;
    return null;
  }
  const result = value.trim();
  if (result.length > maxLength) errors[key] = `${label} không được vượt quá ${maxLength} ký tự.`;
  return result || null;
}

function parseStatus(value: unknown, errors: Record<string, string>): AdminPublishStatus {
  if (typeof value === "string" && statuses.has(value as AdminPublishStatus)) return value as AdminPublishStatus;
  errors.status = "Trạng thái dịch vụ không hợp lệ.";
  return "draft";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}