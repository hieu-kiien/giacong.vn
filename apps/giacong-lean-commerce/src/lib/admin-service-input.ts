import type { AdminPublishStatus, AdminServiceInput } from "./admin-data";
import { safeInternalHref } from "./service-presentation.ts";
import type { ServiceOffering } from "@/data/service-families";

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
  const offerings = merged.offerings === undefined
    ? undefined
    : parseOfferings(merged.offerings, fieldErrors);
  const ctaLabel = merged.ctaLabel === undefined
    ? undefined
    : nullableTextField(merged.ctaLabel, "Nhãn CTA", 120, fieldErrors, "ctaLabel");
  const ctaHref = merged.ctaHref === undefined
    ? undefined
    : parseCtaHref(merged.ctaHref, fieldErrors);
  const sortOrder = merged.sortOrder === undefined
    ? undefined
    : parseNullableNonNegativeInteger(merged.sortOrder, "Thứ tự nhóm", fieldErrors, "sortOrder", 100_000);

  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fieldErrors.slug = "Slug chỉ gồm chữ thường, số và dấu gạch ngang.";
  }
  if (status === "published" && !requestedActive) {
    fieldErrors.isActive = "Dịch vụ published phải được bật hiển thị.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, input: null };
  const input: AdminServiceInput = {
    description,
    imageUrl,
    isActive,
    leadTimeDays,
    moqSummary,
    name,
    slug,
    status,
    summary,
  };
  if (offerings !== undefined) input.offerings = offerings;
  if (ctaLabel !== undefined) input.ctaLabel = ctaLabel;
  if (ctaHref !== undefined) input.ctaHref = ctaHref;
  if (sortOrder !== undefined) input.sortOrder = sortOrder;
  return { fieldErrors, input };
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
  max = 3650,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    errors[key] = `${label} phải là số nguyên từ 0 đến ${max} hoặc để trống.`;
    return null;
  }
  return parsed;
}

function parseOfferings(value: unknown, errors: Record<string, string>): ServiceOffering[] {
  if (!Array.isArray(value)) {
    errors.offerings = "Danh sách dịch vụ trong nhóm phải là một mảng.";
    return [];
  }
  if (value.length > 100) {
    errors.offerings = "Mỗi nhóm chỉ được có tối đa 100 dịch vụ.";
    return [];
  }
  const hrefs = new Set<string>();
  const offerings: ServiceOffering[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.label !== "string" || typeof item.href !== "string") {
      errors.offerings = "Mỗi dịch vụ trong nhóm cần có tên và đường dẫn.";
      return [];
    }
    const label = item.label.trim();
    const href = item.href.trim();
    if (!label || label.length > 160) {
      errors.offerings = "Tên dịch vụ trong nhóm phải có từ 1 đến 160 ký tự.";
      return [];
    }
    if (!safeInternalHref(href)) {
      errors.offerings = "Đường dẫn dịch vụ trong nhóm phải là đường dẫn nội bộ bắt đầu bằng /.";
      return [];
    }
    if (hrefs.has(href)) {
      errors.offerings = "Đường dẫn dịch vụ trong nhóm không được trùng.";
      return [];
    }
    hrefs.add(href);
    offerings.push({ href, label });
  }
  return offerings;
}

function parseCtaHref(value: unknown, errors: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    errors.ctaHref = "CTA phải là đường dẫn nội bộ.";
    return null;
  }
  const href = value.trim();
  if (!safeInternalHref(href)) {
    errors.ctaHref = "CTA phải là đường dẫn nội bộ bắt đầu bằng /.";
    return null;
  }
  return href;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
