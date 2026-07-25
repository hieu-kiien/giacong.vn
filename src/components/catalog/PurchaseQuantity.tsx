"use client";

import { useState } from "react";

import styles from "@/components/catalog/catalog.module.css";
import { formatVnd } from "@/lib/format-vnd";
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
  const [quantity, setQuantity] = useState(minimumOrderQuantity);
  const isValid = Number.isInteger(quantity)
    && quantity >= minimumOrderQuantity
    && (quantity - minimumOrderQuantity) % quantityStep === 0;
  const needsContact = isValid && quantity >= contactFromQuantity;
  const unitPrice = isValid && !needsContact
    ? [...tierPrices].reverse().find((tier) => tier.minQuantity <= quantity)?.price
    : undefined;
  const requestHref = `/lien-he/?${new URLSearchParams({
    intent: needsContact ? "quote" : "order",
    product: parentSlug,
    quantity: String(quantity),
    variant_sku: variantSku,
  })}`;

  return (
    <section className={styles.purchase} aria-labelledby="purchase-title">
      <h2 className={styles.purchaseTitle} id="purchase-title">Chọn số lượng cần tư vấn</h2>
      <p className={styles.purchaseRule}>
        Số lượng tối thiểu {minimumOrderQuantity} {unit}, tăng mỗi lần {quantityStep} {unit}.
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
        <a className={styles.button} href={requestHref}>
          {needsContact ? "Yêu cầu tư vấn số lượng lớn" : `Yêu cầu tư vấn ${quantity} ${unit} ${productName}`}
        </a>
      ) : (
        <button className={`${styles.button} ${styles.disabledButton}`} disabled type="button">
          Nhập số lượng hợp lệ để tiếp tục
        </button>
      )}
    </section>
  );
}
