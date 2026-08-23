export interface AdminCategoryInput {
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  slug: string;
  sortOrder: number;
}

type FieldErrors = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Mirrors the product payload contract so both admin forms validate identically. */
export function parseAdminCategoryPayload(
  payload: unknown,
): { fieldErrors: FieldErrors; input: AdminCategoryInput | null } {
  const source = isRecord(payload) ? payload : {};
  const fieldErrors: FieldErrors = {};

  const rawName = typeof source.name === "string" ? source.name.trim() : "";
  if (!rawName || rawName.length > 160) {
    fieldErrors.name = "Tên danh mục bắt buộc, tối đa 160 ký tự.";
  }

  const rawSlug = typeof source.slug === "string" ? source.slug.trim() : "";
  let slug = "";
  if (!rawSlug || rawSlug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug)) {
    fieldErrors.slug = "Slug chỉ gồm chữ thường, số và dấu gạch ngang.";
  } else {
    slug = rawSlug;
  }

  const rawDescription = typeof source.description === "string" ? source.description.trim() : "";
  if (rawDescription.length > 2000) {
    fieldErrors.description = "Mô tả tối đa 2000 ký tự.";
  }

  let imageUrl: string | null = null;
  const rawImage = typeof source.imageUrl === "string" ? source.imageUrl.trim() : "";
  if (rawImage && !/^https?:\/\/.+/i.test(rawImage)) {
    fieldErrors.imageUrl = "Ảnh danh mục phải là URL http(s).";
  } else if (rawImage) {
    imageUrl = rawImage;
  }

  const rawSort = Number(source.sortOrder);
  let sortOrder = 0;
  if (source.sortOrder !== "" && source.sortOrder !== undefined && (
    !Number.isInteger(rawSort) || rawSort < 0
  )) {
    fieldErrors.sortOrder = "Thứ tự phải là số nguyên không âm.";
  } else if (Number.isInteger(rawSort) && rawSort >= 0) {
    sortOrder = rawSort;
  }

  const isActive = source.isActive === true;

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, input: null };
  return {
    fieldErrors,
    input: { description: rawDescription, imageUrl, isActive, name: rawName, slug, sortOrder },
  };
}
