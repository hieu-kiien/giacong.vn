import type { AdminProductVariant, AdminProductVariantInput } from "./admin-data";

export function parseAdminVariantPayload(
  payload: unknown,
  defaults: Partial<AdminProductVariantInput> = {},
): { fieldErrors: Record<string, string>; input: AdminProductVariantInput | null } {
  const source = isRecord(payload) ? payload : {};
  const merged = { ...defaults, ...source };
  const fieldErrors: Record<string, string> = {};
  const name = text(merged.name, "Tên variant", 160, fieldErrors, "name");
  const sku = text(merged.sku, "SKU", 100, fieldErrors, "sku");
  const optionLabel = text(merged.optionLabel, "Tên lựa chọn", 160, fieldErrors, "optionLabel");
  const unit = text(merged.unit, "Đơn vị", 40, fieldErrors, "unit");
  const attributeCode = text(merged.attributeCode, "Mã nhóm lựa chọn", 80, fieldErrors, "attributeCode");
  const attributeLabel = text(merged.attributeLabel, "Tên nhóm lựa chọn", 120, fieldErrors, "attributeLabel");
  const imageUrl = parseImage(merged.imageUrl, fieldErrors);
  const moq = positiveInteger(merged.moq, "MOQ", fieldErrors, "moq");
  const quantityStep = positiveInteger(merged.quantityStep, "Bước số lượng", fieldErrors, "quantityStep");
  const contactFromQuantity = positiveInteger(merged.contactFromQuantity, "Ngưỡng liên hệ", fieldErrors, "contactFromQuantity");
  const attributeId = positiveInteger(merged.attributeId, "Attribute ID", fieldErrors, "attributeId");
  const optionId = nonNegativeInteger(merged.optionId, "Option ID", fieldErrors, "optionId");
  const sortOrder = nonNegativeInteger(merged.sortOrder, "Thứ tự", fieldErrors, "sortOrder");
  const isAvailable = merged.isAvailable !== false;
  const tierPrices = parseTiers(merged.tierPrices, moq, quantityStep, contactFromQuantity, fieldErrors);
  const revision = merged.revision === undefined ? undefined : positiveInteger(merged.revision, "Revision", fieldErrors, "revision");

  if (contactFromQuantity <= moq) fieldErrors.contactFromQuantity = "Ngưỡng liên hệ phải lớn hơn MOQ.";
  if (quantityStep > 0 && (contactFromQuantity - moq) % quantityStep !== 0) {
    fieldErrors.contactFromQuantity = "Ngưỡng liên hệ phải khớp MOQ và bước số lượng.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, input: null };
  return {
    fieldErrors,
    input: {
      attributeCode,
      attributeId,
      attributeLabel,
      contactFromQuantity,
      imageUrl,
      isAvailable,
      moq,
      name,
      optionId,
      optionLabel,
      quantityStep,
      revision,
      sku,
      sortOrder,
      tierPrices,
      unit,
    },
  };
}

export function variantDefaults(variant: AdminProductVariant): AdminProductVariantInput {
  return {
    attributeCode: variant.attributeCode,
    attributeId: variant.attributeId,
    attributeLabel: variant.attributeLabel,
    contactFromQuantity: variant.contactFromQuantity,
    imageUrl: variant.imageUrl,
    isAvailable: variant.isAvailable,
    moq: variant.moq,
    name: variant.name,
    optionId: variant.optionId,
    optionLabel: variant.optionLabel,
    quantityStep: variant.quantityStep,
    revision: variant.revision,
    sku: variant.sku,
    sortOrder: variant.sortOrder,
    tierPrices: variant.tierPrices.map(({ currency, minQuantity, price }) => ({ currency, minQuantity, price })),
    unit: variant.unit,
  };
}

function parseTiers(
  value: unknown,
  moq: number,
  step: number,
  contactFromQuantity: number,
  errors: Record<string, string>,
): AdminProductVariantInput["tierPrices"] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.tierPrices = "Bảng giá theo bậc không hợp lệ.";
    return [];
  }
  const seen = new Set<number>();
  const tiers = value.map((raw, index) => {
    const row = isRecord(raw) ? raw : {};
    const minQuantity = positiveInteger(row.minQuantity, `Bậc ${index + 1} · số lượng`, errors, `tierPrices.${index}.minQuantity`);
    const price = positiveInteger(row.price, `Bậc ${index + 1} · giá`, errors, `tierPrices.${index}.price`);
    if (seen.has(minQuantity)) errors.tierPrices = "Không được lặp số lượng tối thiểu.";
    seen.add(minQuantity);
    if (minQuantity < moq || minQuantity >= contactFromQuantity || (minQuantity - moq) % step !== 0) {
      errors.tierPrices = "Mỗi bậc phải từ MOQ đến trước ngưỡng liên hệ và khớp bước số lượng.";
    }
    return { currency: "VND" as const, minQuantity, price };
  }).sort((a, b) => a.minQuantity - b.minQuantity);
  if (tiers.length > 0 && tiers[0].minQuantity !== moq) errors.tierPrices = "Bậc đầu tiên phải bắt đầu tại MOQ.";
  return tiers;
}

function text(value: unknown, label: string, maxLength: number, errors: Record<string, string>, key: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) errors[key] = `${label} là bắt buộc.`;
  if (result.length > maxLength) errors[key] = `${label} không được vượt quá ${maxLength} ký tự.`;
  return result;
}

function positiveInteger(value: unknown, label: string, errors: Record<string, string>, key: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) errors[key] = `${label} phải là số nguyên dương.`;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function nonNegativeInteger(value: unknown, label: string, errors: Record<string, string>, key: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) errors[key] = `${label} phải là số nguyên không âm.`;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function parseImage(value: unknown, errors: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    errors.imageUrl = "Đường dẫn ảnh không hợp lệ.";
    return null;
  }
  const result = value.trim();
  if (result.startsWith("/")) return result;
  try {
    const url = new URL(result);
    if (url.protocol !== "https:") throw new Error("HTTPS required");
    return url.toString();
  } catch {
    errors.imageUrl = "Ảnh phải là đường dẫn nội bộ hoặc URL HTTPS.";
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
