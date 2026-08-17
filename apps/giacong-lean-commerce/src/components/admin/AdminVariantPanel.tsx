"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, useState } from "react";

import { TierPriceTable } from "@/components/catalog/TierPriceTable";
import styles from "@/components/catalog/product-detail.module.css";
import { clampCommerceQuantity } from "@/lib/commerce-ui";
import { resolveQuantityPricing } from "@/lib/product-detail-view";
import type { ProductDetailView } from "@/lib/product-detail-view";
import {
  REQUEST_CART_STORAGE_KEY,
  readRequestCart,
  removeRequestCartLine,
  upsertRequestCartLine,
  writeRequestCart,
} from "@/lib/request-cart-storage";

interface ProductPurchasePanelProps {
  editingCartVariantSku: string | null;
  initialVariantSku: string | null;
  variantQueryWarning: boolean;
  view: ProductDetailView;
}

type AddState =
  | { kind: "added"; quantity: number; unit: string }
  | { kind: "error"; message: string }
  | { kind: "idle" };

const LINE_LIMIT_MESSAGE = "Giỏ yêu cầu đã đủ số dòng tối đa. Hãy gửi yêu cầu hiện tại trước.";
const INVALID_MESSAGE = "Không thêm được lựa chọn này. Vui lòng thử lại.";

/**
 * Variant choice, quantity, tier table and the two detail actions.
 *
 * The primary action adds a line to the existing request cart through the locked
 * `request-cart-storage` contract — three key fields only, so no money and no PII
 * is written. The secondary action continues to `/gui-yeu-cau/`, the one cart route.
 *
 * The figures beside the stepper are display values derived from the tier bands the
 * server already sent. They are never submitted: the request route re-reads Bagisto
 * and computes the canonical unit price and subtotal itself.
 */
export function ProductPurchasePanel({ editingCartVariantSku, initialVariantSku, variantQueryWarning, view }: ProductPurchasePanelProps) {
  const router = useRouter();
  const quantityFieldId = useId();
  const [selectedSku, setSelectedSku] = useState(initialVariantSku ?? view.defaultVariantSku);
  const selected = view.variants.find((variant) => variant.sku === selectedSku)
    ?? view.variants.find((variant) => variant.sku === view.defaultVariantSku)
    ?? view.variants[0]
    ?? null;
  const [quantity, setQuantity] = useState(selected?.moq ?? 1);
  const [addState, setAddState] = useState<AddState>({ kind: "idle" });

  function selectVariant(nextSku: string) {
    const next = view.variants.find((variant) => variant.sku === nextSku);
    if (!next) return;
    setSelectedSku(next.sku);
    setQuantity(next.moq);
    setAddState({ kind: "idle" });
  }

  function setClampedQuantity(rawQuantity: number) {
    if (!selected) return;
    setQuantity(clampCommerceQuantity(rawQuantity, selected.moq, selected.quantityStep));
    setAddState({ kind: "idle" });
  }

  function addToRequestCart() {
    if (!selected || !selected.isAvailable) {
      setAddState({ kind: "error", message: INVALID_MESSAGE });
      return;
    }
    try {
      const current = readRequestCart(window.localStorage, REQUEST_CART_STORAGE_KEY);
      const next = upsertRequestCartLine(current, {
        productSlug: view.slug,
        quantity,
        variantSku: selected.sku,
      });
      writeRequestCart(window.localStorage, REQUEST_CART_STORAGE_KEY, next);
      if (editingCartVariantSku && editingCartVariantSku !== selected.sku) {
        const withoutOldLine = removeRequestCartLine(next, view.slug, editingCartVariantSku);
        writeRequestCart(window.localStorage, REQUEST_CART_STORAGE_KEY, withoutOldLine);
      }
      window.dispatchEvent(new StorageEvent("storage", { key: REQUEST_CART_STORAGE_KEY }));
      setAddState({ kind: "added", quantity, unit: selected.unit });
      router.refresh();
    } catch (error) {
      setAddState({
        kind: "error",
        message: error instanceof Error && /maximum|limit|tối đa/i.test(error.message)
          ? LINE_LIMIT_MESSAGE
          : INVALID_MESSAGE,
      });
    }
  }

  if (!selected) {
    return <p className={styles.unavailable}>Sản phẩm chưa có quy cách có thể đặt yêu cầu.</p>;
  }

  const pricing = resolveQuantityPricing(selected, quantity);

  return (
    <div className={styles.purchasePanel}>
      {variantQueryWarning ? <p className={styles.warning}>Quy cách được yêu cầu không còn khả dụng. Đã chọn quy cách mặc định.</p> : null}

      <fieldset className={styles.variantFieldset}>
        <legend>Chọn {selected.attributeLabel.toLocaleLowerCase("vi-VN")}</legend>
        <div className={styles.variantChoices}>
          {view.variants.map((variant) => (
            <button
              aria-pressed={variant.sku === selected.sku}
              className={variant.sku === selected.sku ? styles.variantChoiceActive : styles.variantChoice}
              disabled={!variant.isAvailable}
              key={variant.sku}
              onClick={() => selectVariant(variant.sku)}
              type="button"
            >
              {variant.optionLabel}
              {!variant.isAvailable ? " · Tạm hết" : ""}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.quantityBlock}>
        <label htmlFor={quantityFieldId}>Số lượng</label>
        <div className={styles.quantityControls}>
          <button aria-label="Giảm số lượng" onClick={() => setClampedQuantity(quantity - selected.quantityStep)} type="button">−</button>
          <input
            id={quantityFieldId}
            inputMode="numeric"
            min={selected.moq}
            onChange={(event) => setClampedQuantity(Number(event.target.value))}
            step={selected.quantityStep}
            type="number"
            value={quantity}
          />
          <button aria-label="Tăng số lượng" onClick={() => setClampedQuantity(quantity + selected.quantityStep)} type="button">+</button>
          <span>{selected.unit}</span>
        </div>
        <p>MOQ {selected.moq.toLocaleString("vi-VN")} · bước {selected.quantityStep.toLocaleString("vi-VN")} {selected.unit}</p>
      </div>

      <TierPriceTable contactFromQuantity={selected.contactFromQuantity} tiers={selected.tierPrices} unit={selected.unit} />

      <div className={styles.priceSummary} aria-live="polite">
        {pricing.kind === "priced" ? (
          <>
            <span>Đơn giá tại {pricing.quantity.toLocaleString("vi-VN")} {selected.unit}</span>
            <strong>{pricing.unitPrice.toLocaleString("vi-VN")} đ / {selected.unit}</strong>
            <small>Tạm tính {(pricing.unitPrice * pricing.quantity).toLocaleString("vi-VN")} đ</small>
          </>
        ) : (
          <>
            <span>Từ {pricing.quantity.toLocaleString("vi-VN")} {selected.unit}</span>
            <strong>Liên hệ báo giá</strong>
            <small>Đội ngũ tư vấn sẽ xác nhận giá theo số lượng và yêu cầu thực tế.</small>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <button className={styles.primaryAction} disabled={!selected.isAvailable} onClick={addToRequestCart} type="button">
          {editingCartVariantSku ? "Cập nhật yêu cầu" : "Thêm vào giỏ yêu cầu"}
        </button>
        <Link className={styles.secondaryAction} href="/gui-yeu-cau/" prefetch={false}>Gửi yêu cầu tư vấn</Link>
      </div>
      {addState.kind === "added" ? (
        <p className={styles.success} role="status">
          Đã thêm {addState.quantity.toLocaleString("vi-VN")} {addState.unit} vào giỏ yêu cầu.
        </p>
      ) : null}
      {addState.kind === "error" ? <p className={styles.error} role="alert">{addState.message}</p> : null}
    </div>
  );
}
