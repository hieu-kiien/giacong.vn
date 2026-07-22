"use client";

import { useState } from "react";

import { CatalogProductImage } from "@/components/catalog/CatalogProductImage";
import { formatVnd } from "@/components/catalog/CatalogProductCard";
import { PurchaseQuantity } from "@/components/catalog/PurchaseQuantity";
import styles from "@/components/catalog/catalog.module.css";
import type { CatalogProductDetail } from "@/types/catalog";

interface ProductConfiguratorProps {
  initialVariantSku: string | null;
  product: CatalogProductDetail;
  variantQueryWarning: boolean;
}

export function ProductConfigurator({ initialVariantSku, product, variantQueryWarning }: ProductConfiguratorProps) {
  const [selectedSku, setSelectedSku] = useState(initialVariantSku);
  const selectedVariant = product.variants.find((variant) => variant.sku === selectedSku) ?? null;
  const optionGroup = product.optionGroups[0];
  const selectedOptionId = selectedVariant?.optionValues[0]?.optionId;
  const selectionLabel = product.slug === "b2b-demo-bot-dinh-duong" ? "Hương vị" : "Lựa chọn";

  return (
    <div className={styles.detail}>
      <CatalogProductImage
        alt={selectedVariant?.name ?? product.name}
        className={styles.detailImage}
        imageUrl={selectedVariant?.imageUrl ?? product.imageUrl}
      />
      <div className={styles.detailCopy}>
        {product.category ? <span className={styles.category}>{product.category.name}</span> : null}
        <h1 className={styles.title}>{product.name}</h1>
        {product.shortDescription ? <p className={styles.description}>{product.shortDescription}</p> : null}

        <fieldset className={styles.variantSelector}>
          <legend>Chọn {selectionLabel}</legend>
          <div className={styles.variantOptions}>
            {optionGroup.options.map((option) => {
              const variant = product.variants.find((item) => item.id === option.variantIds[0]);
              if (!variant) return null;
              const reasonId = `variant-reason-${variant.id}`;
              return (
                <div className={styles.variantOption} key={option.id}>
                  <label className={`${styles.variantLabel} ${!variant.isAvailable ? styles.unavailableVariant : ""}`}>
                    <input
                      aria-describedby={!variant.isAvailable ? reasonId : undefined}
                      checked={selectedOptionId === option.id}
                      disabled={!variant.isAvailable}
                      name={`catalog-option-${optionGroup.attributeId}`}
                      onChange={() => setSelectedSku(variant.sku)}
                      type="radio"
                      value={option.id}
                    />
                    <span>{option.label}</span>
                  </label>
                  {!variant.isAvailable ? <span className={styles.variantReason} id={reasonId}>Tạm hết hàng</span> : null}
                </div>
              );
            })}
          </div>
        </fieldset>

        {variantQueryWarning && !selectedVariant ? (
          <p className={styles.quantityError} role="alert">
            Lựa chọn trong liên kết không còn khả dụng. Vui lòng chọn một lựa chọn khác.
          </p>
        ) : null}

        {selectedVariant ? (
          <div className={styles.variantCommerce} aria-live="polite">
            <p className={styles.selectedVariantName}>{selectedVariant.name}</p>
            <p className={styles.sku}>SKU: {selectedVariant.sku}</p>
            <span className={styles.price}>{formatVnd(selectedVariant.tierPrices[0].price)}</span>
            <table className={styles.facts}>
              <caption className="screen-reader-text">Thông tin đặt hàng của lựa chọn đã chọn</caption>
              <tbody>
                <tr><th scope="row">Số lượng đặt tối thiểu</th><td>{selectedVariant.minimumOrderQuantity} {selectedVariant.unit}</td></tr>
                <tr><th scope="row">Bước số lượng</th><td>{selectedVariant.quantityStep} {selectedVariant.unit}</td></tr>
                <tr><th scope="row">Đơn vị</th><td>{selectedVariant.unit}</td></tr>
              </tbody>
            </table>
            <PurchaseQuantity
              contactFromQuantity={selectedVariant.contactFromQuantity}
              key={selectedVariant.sku}
              minimumOrderQuantity={selectedVariant.minimumOrderQuantity}
              parentSlug={product.slug}
              productName={selectedVariant.name}
              quantityStep={selectedVariant.quantityStep}
              tierPrices={selectedVariant.tierPrices}
              unit={selectedVariant.unit}
              variantSku={selectedVariant.sku}
            />
            <section>
              <h2 className={styles.sectionTitle}>Giá theo số lượng</h2>
              <table className={styles.tierTable}>
                <caption className="screen-reader-text">Bảng giá theo số lượng của lựa chọn đã chọn</caption>
                <thead><tr><th scope="col">Số lượng từ</th><th scope="col">Đơn giá</th></tr></thead>
                <tbody>
                  {selectedVariant.tierPrices.map((tier) => <tr key={tier.minQuantity}><td>{tier.minQuantity} {selectedVariant.unit}</td><td>{formatVnd(tier.price)}</td></tr>)}
                  <tr><td>Từ {selectedVariant.contactFromQuantity} {selectedVariant.unit}</td><td><strong>Liên hệ</strong></td></tr>
                </tbody>
              </table>
            </section>
          </div>
        ) : (
          <div className={styles.selectionPrompt} role="status">
            Chọn {selectionLabel} để xem giá, số lượng tối thiểu và gửi yêu cầu mua hàng.
          </div>
        )}
      </div>
    </div>
  );
}
