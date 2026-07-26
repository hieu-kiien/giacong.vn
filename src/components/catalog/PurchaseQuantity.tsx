"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/components/catalog/catalog.module.css";
import { formatVnd } from "@/lib/format-vnd";
import {
  REQUEST_CART_STORAGE_KEY,
  readRequestCart,
  upsertRequestCartLine,
  writeRequestCart,
} from "@/lib/request-cart-storage";
import type { CatalogTierPrice } from "@/types/catalog";

interface PurchaseQuantityProps {
  contactFromQuantity: number;
  minimumOrderQuantity: number;
  parentSlug: string;
  productName: string;
  quantityStep: number;
  tierPrices: CatalogTierPrice[];
  unit: string;
  variantSku: string;
}

export function PurchaseQuantity({
  contactFromQuantity,
  minimumOrderQuantity,
  parentSlug,
  productName,
  quantityStep,
  tierPrices,
  unit,
  variantSku,
}: PurchaseQuantityProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(minimumOrderQuantity);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const isValid = Number.isInteger(quantity)
    && quantity >= minimumOrderQuantity
    && (quantity - minimumOrderQuantity) % quantityStep === 0;
  const needsContact = isValid && quantity >= contactFromQuantity;
  const unitPrice = isValid && !needsContact
    ? [...tierPrices].reverse().find((tier) => tier.minQuantity <= quantity)?.price
    : undefined;
  function addToRequestCart(): boolean {
    if (!isValid) return false;
    const storage = window.localStorage;
    const mutation = upsertRequestCartLine(readRequestCart(storage).state, {
      parentSlug,
      quantity,
      variantSku,
    });
    if (mutation.status !== "ok") {
      setCartNotice(mutation.status === "line_limit"
        ? "Giỏ yêu cầu đã đủ số dòng. Hãy gửi yêu cầu hiện tại trước."
        : "Không thể thêm lựa chọn này vào giỏ yêu cầu. Vui lòng thử lại.");
      return false;
    }
    writeRequestCart(storage, mutation.state);
    window.dispatchEvent(new StorageEvent("storage", {
      key: REQUEST_CART_STORAGE_KEY,
      newValue: storage.getItem(REQUEST_CART_STORAGE_KEY),
      storageArea: storage,
    }));
    setCartNotice(`Đã thêm ${productName} (${quantity} ${unit}) vào giỏ yêu cầu.`);
    return true;
  }

  function continueToRequestCart() {
    if (addToRequestCart()) router.push("/gui-yeu-cau/");
  }

  return (
    <section className={styles.purchase} aria-labelledby="purchase-title">
      <h2 className={styles.purchaseTitle} id="purchase-title">Chọn số lượng mua</h2>
      <p className={styles.purchaseRule}>
        Mua tối thiểu {minimumOrderQuantity} {unit}, tăng mỗi lần {quantityStep} {unit}.
      </p>
      <div className={styles.quantityControl}>
        <button
          aria-label={`Giảm ${quantityStep} ${unit}`}
          disabled={quantity <= minimumOrderQuantity}
          onClick={() => setQuantity((current) => Math.max(minimumOrderQuantity, current - quantityStep))}
          type="button"
        >
          −
        </button>
        <label>
          Số lượng ({unit})
          <input
            aria-describedby={isValid ? undefined : "quantity-error"}
            aria-invalid={!isValid}
            min={minimumOrderQuantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            step={quantityStep}
            type="number"
            value={quantity}
          />
        </label>
        <button
          aria-label={`Tăng ${quantityStep} ${unit}`}
          onClick={() => setQuantity((current) => current + quantityStep)}
          type="button"
        >
          +
        </button>
      </div>
      {!isValid ? (
        <p className={styles.quantityError} id="quantity-error" role="alert">
          Số lượng phải từ {minimumOrderQuantity} và tăng theo bước {quantityStep} {unit}.
        </p>
      ) : needsContact ? (
        <div className={styles.purchaseSummary} aria-live="polite">
          <strong>Giá riêng cho đơn từ {contactFromQuantity} {unit}</strong>
          <span>Hãy liên hệ để nhận mức giá theo số lượng thực tế.</span>
        </div>
      ) : (
        <div className={styles.purchaseSummary} aria-live="polite">
          <span>Đơn giá: <strong>{formatVnd(unitPrice ?? 0)}</strong></span>
          <span>Tạm tính: <strong>{formatVnd((unitPrice ?? 0) * quantity)}</strong></span>
        </div>
      )}
      {isValid ? (
        <div className={styles.purchaseActions}>
          <button className={styles.secondaryButton} onClick={addToRequestCart} type="button">
            Thêm vào giỏ yêu cầu
          </button>
          <button className={styles.button} onClick={continueToRequestCart} type="button">
            {needsContact ? "Gửi yêu cầu tư vấn" : "Gửi yêu cầu ngay"}
          </button>
        </div>
      ) : (
        <button className={`${styles.button} ${styles.disabledButton}`} disabled type="button">
          Nhập số lượng hợp lệ để tiếp tục
        </button>
      )}
      {cartNotice ? (
        <p className={cartNotice.startsWith("Đã thêm") ? styles.purchaseNotice : styles.quantityError} role={cartNotice.startsWith("Đã thêm") ? "status" : "alert"}>
          {cartNotice}
        </p>
      ) : null}
    </section>
  );
}
