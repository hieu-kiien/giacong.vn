"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/components/catalog/catalog.module.css";
import {
  REQUEST_CART_STORAGE_KEY,
  readRequestCart,
  upsertRequestCartLine,
  writeRequestCart,
} from "@/lib/request-cart-storage";

interface CatalogCardPurchaseProps {
  productName: string;
  slug: string;
}

interface CardVariant {
  isAvailable: boolean;
  minimumOrderQuantity: number;
  sku: string;
}

type CardState = "idle" | "loading" | "error" | "added";

/**
 * A list response intentionally contains no variant rules. Resolve them only after
 * a customer asks to add: a single usable variant is safe to add at its MOQ, while
 * every other product goes to detail for an explicit choice.
 */
export function CatalogCardPurchase({ productName, slug }: CatalogCardPurchaseProps) {
  const router = useRouter();
  const [state, setState] = useState<CardState>("idle");

  async function addFromCard() {
    setState("loading");
    try {
      const response = await fetch(`/api/catalog/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      const variants = response.ok ? cardVariants(body) : null;
      if (!variants) throw new Error("catalog_unavailable");

      const availableVariants = variants.filter((variant) => variant.isAvailable);
      if (availableVariants.length !== 1) {
        router.push(`/san-pham/${encodeURIComponent(slug)}/`);
        return;
      }

      const variant = availableVariants[0];
      const storage = window.localStorage;
      const mutation = upsertRequestCartLine(readRequestCart(storage).state, {
        parentSlug: slug,
        quantity: variant.minimumOrderQuantity,
        variantSku: variant.sku,
      });
      if (mutation.status !== "ok") {
        setState("error");
        return;
      }
      writeRequestCart(storage, mutation.state);
      window.dispatchEvent(new StorageEvent("storage", {
        key: REQUEST_CART_STORAGE_KEY,
        newValue: storage.getItem(REQUEST_CART_STORAGE_KEY),
        storageArea: storage,
      }));
      setState("added");
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      <button
        className={styles.quickPreviewAction}
        disabled={state === "loading"}
        onClick={() => void addFromCard()}
        type="button"
      >
        {state === "loading" ? "Đang kiểm tra..." : "Thêm vào giỏ"}
      </button>
      <p aria-live="polite" className="screen-reader-text" role="status">
        {state === "added"
          ? `Đã thêm ${productName} vào giỏ yêu cầu.`
          : state === "error"
            ? "Không thể thêm sản phẩm lúc này. Vui lòng thử lại."
            : ""}
      </p>
    </div>
  );
}

function cardVariants(value: unknown): CardVariant[] | null {
  if (typeof value !== "object" || value === null || !("product" in value)) return null;
  const product = value.product;
  if (typeof product !== "object" || product === null || !("variants" in product) || !Array.isArray(product.variants)) return null;
  const variants: CardVariant[] = [];
  for (const item of product.variants) {
    if (typeof item !== "object" || item === null) return null;
    const variant = item as Record<string, unknown>;
    if (
      typeof variant.isAvailable !== "boolean"
      || typeof variant.minimumOrderQuantity !== "number"
      || !Number.isSafeInteger(variant.minimumOrderQuantity)
      || variant.minimumOrderQuantity < 1
      || typeof variant.sku !== "string"
      || variant.sku.length === 0
    ) return null;
    variants.push({
      isAvailable: variant.isAvailable,
      minimumOrderQuantity: variant.minimumOrderQuantity,
      sku: variant.sku,
    });
  }
  return variants;
}
