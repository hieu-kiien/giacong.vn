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
 * server already sent. They are never submitted: the request route re-reads the
 * Cloudflare catalog and computes the canonical unit price and subtotal itself.
 */
export function ProductPurchasePanel({ editingCartVariantSku, initialVariantSku, variantQueryWarning, view }: ProductPurchasePanelProps) {
  const router = useRouter();
  const quantityFieldId = useId();
  const [selectedSku, setSelectedSku] = useState(initialVariantSku ?? view.defaultVariantSku);
  const selected = view.variants.find((variant) => variant.sku === selectedSku)
    ?? view.variants.find((variant) => variant.sku === view.defaultVariantSku)
    ?? view.variants[0];
  const [quantity, setQuantity] = useState(selected.minimumOrderQuantity);
  const [addState, setAddState] = useState<AddState>({ kind: "idle" });

  const pricing = resolveQuantityPricing(selected, quantity);
  const contactOnly = selected.tierPrices.length === 0;
  const canOrder = selected.isAvailable && !contactOnly;

  function selectVariant(sku: string) {
    const next = view.variants.find((variant) => variant.sku === sku);
    if (!next) return;
    setSelectedSku(sku);
    setQuantity(next.minimumOrderQuantity);
    setAddState({ kind: "idle" });
  }

  function changeQuantity(next: number) {
    setQuantity(clampCommerceQuantity(next, selected));
    setAddState({ kind: "idle" });
  }

  function addToRequestCart(): boolean {
    const stored = readRequestCart(window.localStorage);
    const state = editingCartVariantSku
      ? removeRequestCartLine(stored.state, editingCartVariantSku)
      : stored.state;
    const mutation = upsertRequestCartLine(state, {
      parentSlug: view.slug,
      quantity: pricing.quantity,
      variantSku: selected.sku,
    });

    if (mutation.status === "line_limit") {
      setAddState({ kind: "error", message: LINE_LIMIT_MESSAGE });
      return false;
    }
    if (mutation.status !== "ok") {
      setAddState({ kind: "error", message: INVALID_MESSAGE });
      return false;
    }

    writeRequestCart(window.localStorage, mutation.state);
    // The header badge syncs on `storage`, which a browser fires only for other
    // tabs. Dispatching it here keeps the shared badge correct in this tab too,
    // without reaching into the header component.
    window.dispatchEvent(new StorageEvent("storage", {
      key: REQUEST_CART_STORAGE_KEY,
      newValue: window.localStorage.getItem(REQUEST_CART_STORAGE_KEY),
      storageArea: window.localStorage,
    }));
    setAddState({ kind: "added", quantity: pricing.quantity, unit: selected.unit });
    return true;
  }

  function requestQuote() {
    if (addToRequestCart()) router.push("/gui-yeu-cau/");
  }

  return (
    <div className={styles.purchase}>
      <div className={styles.currentPrice} aria-live="polite">
        <p>Đơn giá hiện tại</p>
        <strong>{pricing.unitPriceLabel}</strong>
        <span>Giá chưa bao gồm VAT và phí vận chuyển.</span>
      </div>

      {view.variantChoices.length > 1 ? (
        <fieldset className={styles.variantGroup}>
          <legend><span className={styles.purchaseStep}>1</span> Chọn {view.variantAxisLabel.toLowerCase()}</legend>
          <div className={styles.variantOptions}>
            {view.variantChoices.map((choice) => (
              <label
                className={styles.variantOption}
                data-unavailable={choice.isAvailable ? undefined : "true"}
                key={choice.sku}
              >
                <input
                  aria-label={choice.label}
                  checked={choice.sku === selected.sku}
                  disabled={!choice.isAvailable}
                  name="product-detail-variant"
                  onChange={() => selectVariant(choice.sku)}
                  type="radio"
                  value={choice.sku}
                />
                <span>{choice.label}</span>
                {choice.isAvailable ? null : <small>Tạm hết hàng</small>}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {variantQueryWarning ? (
        <p className={styles.warning} role="alert">
          Lựa chọn trong liên kết không còn khả dụng. Chúng tôi đã chọn quy cách đang có sẵn.
        </p>
      ) : null}

      <p className={styles.selectedVariant}>
        <span>{selected.label}</span>
        <span className={styles.variantSku}>SKU: {selected.sku}</span>
      </p>

      <TierPriceTable
        activeMinQuantity={pricing.needsContact ? selected.contactFromQuantity : null}
        rows={selected.tierRows}
        variantLabel={selected.label}
      />

      <div className={styles.quantityRow}>
        <label className={styles.quantityLabel} htmlFor={quantityFieldId}>
          <span className={styles.purchaseStep}>3</span> Chọn số lượng
        </label>
        <div className={styles.stepper}>
          <button
            aria-label={`Giảm ${selected.quantityStep} ${selected.unit}`}
            className={styles.stepButton}
            disabled={pricing.quantity <= selected.minimumOrderQuantity}
            onClick={() => changeQuantity(pricing.quantity - selected.quantityStep)}
            type="button"
          >
            −
          </button>
          <input
            className={styles.quantityInput}
            id={quantityFieldId}
            inputMode="numeric"
            min={selected.minimumOrderQuantity}
            onBlur={() => changeQuantity(quantity)}
            onChange={(event) => setQuantity(Number(event.target.value))}
            step={selected.quantityStep}
            type="number"
            value={quantity}
          />
          <button
            aria-label={`Tăng ${selected.quantityStep} ${selected.unit}`}
            className={styles.stepButton}
            onClick={() => changeQuantity(pricing.quantity + selected.quantityStep)}
            type="button"
          >
            +
          </button>
        </div>
        <p className={styles.quantityRule}>
          Đặt tối thiểu {selected.minimumOrderQuantity} {selected.unit}, tăng mỗi bước {selected.quantityStep} {selected.unit}.
        </p>
      </div>

      <dl aria-live="polite" className={styles.summary}>
        <div>
          <dt>Đơn giá</dt>
          <dd>{pricing.unitPriceLabel}</dd>
        </div>
        <div>
          <dt>Tạm tính</dt>
          <dd className={styles.subtotalValue}>{pricing.subtotalLabel}</dd>
        </div>
      </dl>

      {pricing.needsContact ? (
        <p className={styles.contactNote}>
          Số lượng từ {selected.contactFromQuantity} {selected.unit} được báo giá riêng. Hãy gửi yêu cầu để nhận mức giá theo sản lượng thực tế.
        </p>
      ) : null}

      <div className={styles.actions}>
        {contactOnly ? (
          <Link className={styles.primaryAction} href="/lien-he/">Liên hệ tư vấn</Link>
        ) : <>
          <button
            className={styles.secondaryAction}
            disabled={!canOrder}
            onClick={addToRequestCart}
            type="button"
          >
            {editingCartVariantSku ? "Cập nhật giỏ yêu cầu" : view.addToCartLabel}
          </button>
          <button className={styles.primaryAction} disabled={!canOrder} onClick={requestQuote} type="button">
            {editingCartVariantSku ? "Cập nhật và xem giỏ yêu cầu" : view.requestLabel}
          </button>
        </>}
      </div>

      <p aria-live="polite" className={styles.addFeedback} role="status">
        {addState.kind === "added"
          ? `Đã thêm ${addState.quantity} ${addState.unit} vào giỏ yêu cầu.`
          : addState.kind === "error"
            ? addState.message
            : ""}
      </p>

      {!canOrder && !contactOnly ? (
        <p className={styles.warning}>Quy cách này tạm hết hàng. Hãy chọn quy cách khác hoặc gửi yêu cầu tư vấn.</p>
      ) : null}
    </div>
  );
}
