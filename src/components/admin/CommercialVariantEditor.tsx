"use client";

import { Plus, Trash2 } from "lucide-react";
import { legacyErrorLabel, type CommercialErrors, type CommercialVariantDraft } from "@/components/admin/commercial-rules";

interface Props {
  index: number;
  variant: CommercialVariantDraft;
  errors: CommercialErrors;
  onChange: (variant: CommercialVariantDraft) => void;
}

export function CommercialVariantEditor({ index, variant, errors, onChange }: Props) {
  const base = `variants.${index}`;
  const field = (name: "unit" | "moq" | "quantity_step" | "contact_from_quantity") => `${base}.${name}`;
  const inputClass = "mt-1 h-10 w-full rounded-md border border-[#cfd1bf] bg-white px-3 text-sm outline-none focus:border-[#607c20] focus:ring-2 focus:ring-[#dfe8bd]";

  function updateField(name: "unit" | "moq" | "quantity_step" | "contact_from_quantity", value: string) {
    onChange({ ...variant, [name]: value });
  }

  function updateTier(tierIndex: number, name: "min_quantity" | "unit_price", value: string) {
    onChange({
      ...variant,
      tier_prices: variant.tier_prices.map((tier, current) => current === tierIndex ? { ...tier, [name]: value } : tier),
    });
  }

  function addTier() {
    if (variant.tier_prices.length >= 20) return;
    const previous = variant.tier_prices.at(-1);
    const previousQuantity = Number(previous?.min_quantity);
    const step = Number(variant.quantity_step);
    onChange({
      ...variant,
      tier_prices: [...variant.tier_prices, {
        min_quantity: Number.isInteger(previousQuantity) && Number.isInteger(step) ? String(previousQuantity + step) : "",
        unit_price: previous?.unit_price ?? "",
      }],
    });
  }

  return (
    <article className="rounded-lg border border-[#d7d8c9] bg-[#fbfbf5] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#273326]">{variant.name}</h3>
          <p className="mt-0.5 font-mono text-xs text-[#667151]">{variant.sku}</p>
          {variant.optionLabel && <p className="mt-1 text-sm text-[#59634d]">{variant.optionLabel}</p>}
        </div>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-[#cfd1bf] bg-white px-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={variant.published}
            onChange={(event) => onChange({ ...variant, published: event.target.checked })}
          />
          Xuất bản biến thể
        </label>
      </div>

      {variant.legacyErrors.length > 0 && (
        <div className="mt-4 rounded-md border border-[#e0c69b] bg-[#fff9ed] p-3 text-sm text-[#714d18]">
          <p className="font-medium">Cần hoàn thiện dữ liệu cũ</p>
          <ul className="mt-1 list-disc pl-5">
            {variant.legacyErrors.map((error) => <li key={error}>{legacyErrorLabel(error)}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">
          Đơn vị
          <input
            id={fieldId(field("unit"))}
            className={inputClass}
            value={variant.unit}
            aria-label={`Đơn vị · ${variant.name}`}
            aria-invalid={Boolean(errors[field("unit")])}
            aria-describedby={errorId(field("unit"), errors)}
            maxLength={32}
            onChange={(event) => updateField("unit", event.target.value)}
          />
          <FieldError path={field("unit")} errors={errors} />
        </label>
        <NumberField label="MOQ" name="moq" value={variant.moq} path={field("moq")} variantName={variant.name} errors={errors} onChange={updateField} />
        <NumberField label="Bước số lượng" name="quantity_step" value={variant.quantity_step} path={field("quantity_step")} variantName={variant.name} errors={errors} onChange={updateField} />
        <NumberField label="Liên hệ từ" name="contact_from_quantity" value={variant.contact_from_quantity} path={field("contact_from_quantity")} variantName={variant.name} errors={errors} onChange={updateField} />
      </div>

      <div className="mt-5 border-t border-[#d7d8c9] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-medium">Giá theo số lượng</h4>
            <p className="text-xs text-[#667151]">Mức đầu tiên bằng MOQ; đơn giá không tăng ở mức sau.</p>
          </div>
          <button
            type="button"
            aria-label={`Thêm mức giá · ${variant.name}`}
            disabled={variant.tier_prices.length >= 20}
            onClick={addTier}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#859b4a] bg-white px-3 text-sm font-medium text-[#3f5712] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} aria-hidden /> Thêm mức giá
          </button>
        </div>
        <FieldError path={`${base}.tier_prices`} errors={errors} />
        <div className="mt-3 space-y-3">
          {variant.tier_prices.map((tier, tierIndex) => {
            const quantityPath = `${base}.tier_prices.${tierIndex}.min_quantity`;
            const pricePath = `${base}.tier_prices.${tierIndex}.unit_price`;
            return (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-start gap-2" key={`${variant.id}-${tierIndex}`}>
                <label className="text-xs font-medium text-[#59634d]">
                  Số lượng mức {tierIndex + 1}
                  <input id={fieldId(quantityPath)} type="number" inputMode="numeric" min="1" className={inputClass} value={tier.min_quantity} aria-invalid={Boolean(errors[quantityPath])} aria-describedby={errorId(quantityPath, errors)} onChange={(event) => updateTier(tierIndex, "min_quantity", event.target.value)} />
                  <FieldError path={quantityPath} errors={errors} />
                </label>
                <label className="text-xs font-medium text-[#59634d]">
                  Đơn giá mức {tierIndex + 1} (₫)
                  <input id={fieldId(pricePath)} type="number" inputMode="numeric" min="1" max="99999999" className={inputClass} value={tier.unit_price} aria-invalid={Boolean(errors[pricePath])} aria-describedby={errorId(pricePath, errors)} onChange={(event) => updateTier(tierIndex, "unit_price", event.target.value)} />
                  <FieldError path={pricePath} errors={errors} />
                </label>
                <button
                  type="button"
                  aria-label={`Xoá mức giá ${tierIndex + 1} · ${variant.name}`}
                  disabled={variant.tier_prices.length === 1}
                  onClick={() => onChange({ ...variant, tier_prices: variant.tier_prices.filter((_, current) => current !== tierIndex) })}
                  className="mt-5 grid h-10 place-items-center rounded-md text-[#8b2c16] hover:bg-[#f8e8e2] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 size={17} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function NumberField({ label, name, value, path, variantName, errors, onChange }: {
  label: string;
  name: "moq" | "quantity_step" | "contact_from_quantity";
  value: string;
  path: string;
  variantName: string;
  errors: CommercialErrors;
  onChange: (name: "unit" | "moq" | "quantity_step" | "contact_from_quantity", value: string) => void;
}) {
  return <label className="text-sm font-medium">{label}<input id={fieldId(path)} type="number" inputMode="numeric" min="1" className="mt-1 h-10 w-full rounded-md border border-[#cfd1bf] bg-white px-3 text-sm outline-none focus:border-[#607c20] focus:ring-2 focus:ring-[#dfe8bd]" value={value} aria-label={`${label} · ${variantName}`} aria-invalid={Boolean(errors[path])} aria-describedby={errorId(path, errors)} onChange={(event) => onChange(name, event.target.value)} /><FieldError path={path} errors={errors} /></label>;
}

function FieldError({ path, errors }: { path: string; errors: CommercialErrors }) {
  return errors[path] ? <span id={`${fieldId(path)}-error`} className="mt-1 block text-xs font-normal text-[#9a3412]">{errors[path]}</span> : null;
}

function errorId(path: string, errors: CommercialErrors) {
  return errors[path] ? `${fieldId(path)}-error` : undefined;
}

function fieldId(path: string) {
  return `commercial-${path.replaceAll(".", "-")}`;
}
