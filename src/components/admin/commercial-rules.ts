import type { AdminProductDetail } from "@/lib/admin-contract";

export interface CommercialTierDraft {
  min_quantity: string;
  unit_price: string;
}

export interface CommercialVariantDraft {
  id: number;
  sku: string;
  name: string;
  optionLabel: string;
  published: boolean;
  unit: string;
  moq: string;
  quantity_step: string;
  contact_from_quantity: string;
  tier_prices: CommercialTierDraft[];
  legacyErrors: string[];
}

export interface CommercialRulesDraft {
  version: string;
  published: boolean;
  variants: CommercialVariantDraft[];
}

export type CommercialErrors = Record<string, string>;

export function productToDraft(product: AdminProductDetail): CommercialRulesDraft {
  return {
    version: product.resource_version,
    published: product.published,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      optionLabel: variant.option_values.map((option) => option.option_label).join(" · "),
      published: variant.published,
      unit: variant.unit ?? "",
      moq: numericInput(variant.moq),
      quantity_step: numericInput(variant.quantity_step),
      contact_from_quantity: numericInput(variant.contact_from_quantity),
      tier_prices: variant.tier_prices.length > 0
        ? variant.tier_prices.map((tier) => ({
            min_quantity: numericInput(tier.min_quantity),
            unit_price: numericInput(tier.unit_price),
          }))
        : [{ min_quantity: numericInput(variant.moq), unit_price: "" }],
      legacyErrors: variant.validation_errors,
    })),
  };
}

export function validateCommercialDraft(draft: CommercialRulesDraft): CommercialErrors {
  const errors: CommercialErrors = {};
  if (draft.published && !draft.variants.some((variant) => variant.published)) {
    errors.published = "Sản phẩm đang xuất bản cần ít nhất một biến thể được xuất bản.";
  }
  for (const [variantIndex, variant] of draft.variants.entries()) {
    const base = `variants.${variantIndex}`;
    if (!variant.unit.trim()) errors[`${base}.unit`] = "Nhập đơn vị bán.";
    else if (variant.unit.trim().length > 32) errors[`${base}.unit`] = "Đơn vị tối đa 32 ký tự.";
    const moq = positiveInteger(variant.moq, `${base}.moq`, "MOQ", errors, 4_294_967_295);
    const step = positiveInteger(variant.quantity_step, `${base}.quantity_step`, "Bước số lượng", errors, 4_294_967_295);
    const contact = positiveInteger(variant.contact_from_quantity, `${base}.contact_from_quantity`, "Mức liên hệ", errors, 4_294_967_295);
    if (moq && step && contact && (contact <= moq || (contact - moq) % step !== 0)) {
      errors[`${base}.contact_from_quantity`] = "Mức liên hệ phải lớn hơn MOQ và khớp bước số lượng.";
    }
    if (variant.tier_prices.length < 1 || variant.tier_prices.length > 20) {
      errors[`${base}.tier_prices`] = "Mỗi biến thể cần từ 1 đến 20 mức giá.";
    }
    let previousQuantity: number | null = null;
    let previousPrice: number | null = null;
    for (const [tierIndex, tier] of variant.tier_prices.entries()) {
      const tierBase = `${base}.tier_prices.${tierIndex}`;
      const quantity = positiveInteger(tier.min_quantity, `${tierBase}.min_quantity`, "Số lượng", errors, 4_294_967_295);
      const price = positiveInteger(tier.unit_price, `${tierBase}.unit_price`, "Đơn giá", errors, 99_999_999);
      if (quantity && moq && step && contact) {
        const invalidQuantity = (tierIndex === 0 && quantity !== moq)
          || quantity < moq
          || quantity >= contact
          || (quantity - moq) % step !== 0
          || (previousQuantity !== null && quantity <= previousQuantity);
        if (invalidQuantity) {
          errors[`${tierBase}.min_quantity`] = tierIndex === 0
            ? "Mức đầu tiên phải bằng MOQ."
            : "Số lượng phải tăng dần, khớp bước và thấp hơn mức liên hệ.";
        }
      }
      if (price && previousPrice !== null && price > previousPrice) {
        errors[`${tierBase}.unit_price`] = "Đơn giá sau không được cao hơn mức trước.";
      }
      previousQuantity = quantity;
      previousPrice = price;
    }
  }
  return errors;
}

export function draftToRequest(draft: CommercialRulesDraft) {
  return {
    version: draft.version,
    published: draft.published,
    variants: draft.variants.map((variant) => ({
      id: variant.id,
      published: variant.published,
      unit: variant.unit.trim(),
      moq: Number(variant.moq),
      quantity_step: Number(variant.quantity_step),
      contact_from_quantity: Number(variant.contact_from_quantity),
      tier_prices: variant.tier_prices.map((tier) => ({
        min_quantity: Number(tier.min_quantity),
        unit_price: Number(tier.unit_price),
      })),
    })),
  };
}

export function legacyErrorLabel(code: string): string {
  const labels: Record<string, string> = {
    parent_visibility_invalid: "Hiển thị sản phẩm cha chưa đúng",
    parent_channel_invalid: "Thiếu kênh bán cho sản phẩm",
    parent_status_missing: "Thiếu trạng thái xuất bản sản phẩm",
    no_published_variants: "Chưa có biến thể được xuất bản",
    variant_configuration_invalid: "Một hoặc nhiều biến thể chưa hợp lệ",
    missing_b2b_config: "Thiếu cấu hình bán hàng",
    unit_invalid: "Đơn vị chưa hợp lệ",
    moq_invalid: "MOQ chưa hợp lệ",
    quantity_step_invalid: "Bước số lượng chưa hợp lệ",
    contact_from_quantity_invalid: "Mức liên hệ chưa hợp lệ",
    tier_count_invalid: "Số mức giá chưa hợp lệ",
    tier_quantities_invalid: "Mốc số lượng chưa hợp lệ",
    tier_prices_invalid: "Đơn giá chưa hợp lệ",
    tier_prices_increasing: "Đơn giá tăng theo số lượng",
    variant_channel_invalid: "Thiếu kênh bán",
    variant_visibility_invalid: "Hiển thị biến thể chưa đúng",
    variant_status_missing: "Thiếu trạng thái xuất bản",
    base_price_missing: "Thiếu giá cơ sở",
  };
  return labels[code] ?? "Dữ liệu cũ cần được kiểm tra";
}

function numericInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function positiveInteger(
  value: string,
  path: string,
  label: string,
  errors: CommercialErrors,
  maximum: number,
): number | null {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum || !Number.isSafeInteger(Number(value))) {
    errors[path] = `${label} phải là số nguyên dương hợp lệ.`;
    return null;
  }
  return Number(value);
}
