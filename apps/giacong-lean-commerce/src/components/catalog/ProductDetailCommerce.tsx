"use client";

import { useState } from "react";

import { AdminCatalogContextualAction } from "@/components/admin/AdminCatalogContextualAction";
import { ProductPurchasePanel } from "@/components/catalog/ProductPurchasePanel";
import styles from "@/components/catalog/product-detail.module.css";
import { buildProductDetailFacts } from "@/lib/product-detail-view";
import type { ProductDetailView } from "@/lib/product-detail-view";

interface ProductDetailCommerceProps {
  editingCartVariantSku: string | null;
  initialVariantSku: string | null;
  productId: number;
  variantQueryWarning: boolean;
  view: ProductDetailView;
}

/**
 * Keeps the purchase controls and the compact ordering facts on one variant
 * state. The detail page is server-rendered, while this small boundary owns the
 * only interaction that can change the selected SKU.
 */
export function ProductDetailCommerce({ editingCartVariantSku, initialVariantSku, productId, variantQueryWarning, view }: ProductDetailCommerceProps) {
  const requestedSku = initialVariantSku ?? view.defaultVariantSku;
  const fallbackVariant = view.variants.find((variant) => variant.sku === view.defaultVariantSku) ?? view.variants[0];
  const initialVariant = view.variants.find((variant) => variant.sku === requestedSku) ?? fallbackVariant;
  const [selectedSku, setSelectedSku] = useState(initialVariant?.sku ?? view.defaultVariantSku);
  const selectedVariant = view.variants.find((variant) => variant.sku === selectedSku) ?? fallbackVariant;
  const facts = selectedVariant ? buildProductDetailFacts(view, selectedVariant) : view.facts;

  return (
    <>
      <div className={styles.commercial}>
        {view.categoryLabel ? <p className={styles.category}>{view.categoryLabel}</p> : null}
        <h1 className={styles.title}>{view.name}</h1>
        <AdminCatalogContextualAction productId={productId} />
        <p className={styles.identity}>
          <span>SKU: {view.sku}</span>
          <span>{view.variantChoices.length} quy cách</span>
        </p>
        {view.shortDescription ? <p className={styles.lede}>{view.shortDescription}</p> : null}

        <ProductPurchasePanel
          editingCartVariantSku={editingCartVariantSku}
          initialVariantSku={initialVariantSku}
          onVariantChange={setSelectedSku}
          variantQueryWarning={variantQueryWarning}
          view={view}
        />
      </div>

      <aside aria-label="Thông tin đặt hàng" className={styles.factsPanel}>
        <h2 className={styles.factsTitle}>Thông tin đặt hàng</h2>
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <ul className={styles.assurances}>
          <li>
            <strong>Thông tin minh bạch</strong>
            <span>Quy cách và điều kiện mua được hiển thị rõ ràng.</span>
          </li>
          <li>
            <strong>Hỗ trợ đặt hàng</strong>
            <span>Gửi yêu cầu để được tư vấn theo nhu cầu thực tế.</span>
          </li>
          <li>
            <strong>Bảo mật thông tin</strong>
            <span>Thông tin chỉ dùng để xử lý yêu cầu của bạn.</span>
          </li>
        </ul>
      </aside>
    </>
  );
}
