"use client";

import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { clampCommerceQuantity, stepCommerceQuantity } from "@/lib/commerce-ui";
import {
  REQUEST_CART_STORAGE_KEY,
  readRequestCart,
  upsertRequestCartLine,
  writeRequestCart,
} from "@/lib/request-cart-storage";
import type { CatalogCardPurchaseRule } from "@/components/catalog/catalog-listing";

interface CatalogCardPurchaseProps {
  parentSlug: string;
  productName: string;
  purchase: CatalogCardPurchaseRule;
}

type AddState =
  | { kind: "added"; quantity: number }
  | { kind: "idle" }
  | { kind: "limit" }
  | { kind: "rejected" };

/**
 * The only interactive part of a product card: quantity stepper plus
 * add-to-request-cart.
 *
 * It never computes money. The line it stores is the three-field key the storage
 * contract accepts, and unit price and totals are derived server-side when
 * `/gui-yeu-cau` revalidates the cart. Quantity moves through
 * `clampCommerceQuantity`/`stepCommerceQuantity`, so MOQ and step come from the
 * same rule the detail page uses.
 *
 * Rendered only when the catalog proved exactly one usable variant — a product
 * needing a choice gets a link to detail instead, so no fabricated variant key
 * can ever reach storage.
 */
export function CatalogCardPurchase({ parentSlug, productName, purchase }: CatalogCardPurchaseProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(() => clampCommerceQuantity(purchase.minimumOrderQuantity, purchase));
  const [state, setState] = useState<AddState>({ kind: "idle" });
  const needsQuote = quantity >= purchase.contactFromQuantity;

  function commit(next: number) {
    setQuantity(clampCommerceQuantity(next, purchase));
    setState({ kind: "idle" });
  }

  function addToRequestCart(): boolean {
    // Clamped here rather than relying on the input's blur firing first: an emptied
    // number field leaves `quantity` at 0, and the stored line must satisfy the
    // storage contract no matter which event order got us here.
    const requested = clampCommerceQuantity(quantity, purchase);
    setQuantity(requested);

    const storage = window.localStorage;
    // `readRequestCart` sanitises and always returns a usable state, so a corrupt
    // local cart repairs itself here rather than blocking the add.
    const mutation = upsertRequestCartLine(readRequestCart(storage).state, {
      parentSlug,
      quantity: requested,
      variantSku: purchase.variantSku,
    });

    if (mutation.status !== "ok") {
      setState({ kind: mutation.status === "line_limit" ? "limit" : "rejected" });
      return false;
    }

    writeRequestCart(storage, mutation.state);
    // `storage` events only reach *other* tabs, so the shared header badge would
    // not move on the tab that made the change. Dispatching the event the badge
    // already listens for keeps that contract intact without touching the header.
    window.dispatchEvent(new StorageEvent("storage", {
      key: REQUEST_CART_STORAGE_KEY,
      storageArea: storage,
    }));
    setState({ kind: "added", quantity: requested });
    return true;
  }

  function buyNow() {
    if (addToRequestCart()) router.push("/gui-yeu-cau/");
  }

  return (
    <div className="mt-auto grid gap-2 pt-3">
      {/*
        Wraps rather than shrinking: at 390 px a card is ~175 px wide, so the MOQ
        hint drops below the stepper instead of squeezing the controls under the
        44 px minimum target.
      */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex items-stretch rounded-commerce-control border border-commerce-border">
          <button
            aria-label={`Giảm ${purchase.quantityStep} ${purchase.unit}`}
            className="flex min-h-11 w-10 items-center justify-center rounded-l-commerce-control text-commerce-body hover:bg-commerce-active-surface disabled:opacity-40 focus-visible:commerce-focus-ring"
            disabled={quantity <= purchase.minimumOrderQuantity}
            onClick={() => commit(stepCommerceQuantity(quantity, -1, purchase))}
            type="button"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          {/*
            Labelled by attribute rather than a visually-hidden `<label>`: an
            `sr-only` box is a 1×1 scroll container, which reads as horizontal
            overflow to the layout audit while adding nothing here.
          */}
          <input
            aria-label={`Số lượng (${purchase.unit})`}
            className="min-h-11 w-12 border-x border-commerce-border text-center text-sm font-semibold text-commerce-body focus-visible:commerce-focus-ring"
            inputMode="numeric"
            min={purchase.minimumOrderQuantity}
            onBlur={(event) => commit(Number(event.target.value))}
            onChange={(event) => setQuantity(Number(event.target.value))}
            step={purchase.quantityStep}
            type="number"
            value={quantity}
          />
          <button
            aria-label={`Tăng ${purchase.quantityStep} ${purchase.unit}`}
            className="flex min-h-11 w-10 items-center justify-center rounded-r-commerce-control text-commerce-body hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
            onClick={() => commit(stepCommerceQuantity(quantity, 1, purchase))}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        <span className="text-xs text-commerce-secondary">
          Tối thiểu {purchase.minimumOrderQuantity} {purchase.unit}
        </span>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <button
          aria-label={`Thêm ${productName} vào giỏ yêu cầu`}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-commerce-control border border-commerce-brand px-3 text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
          onClick={addToRequestCart}
          title="Thêm vào giỏ yêu cầu"
          type="button"
        >
          <ShoppingCart aria-hidden="true" className="size-4" />
          <span className="sr-only">Thêm vào giỏ yêu cầu</span>
        </button>
        <button
          className="min-h-11 rounded-commerce-control bg-commerce-brand px-3 text-sm font-bold text-white hover:bg-commerce-brand-dark focus-visible:commerce-focus-ring"
          onClick={buyNow}
          type="button"
        >
          Mua ngay
        </button>
      </div>

      <p aria-live="polite" className="min-h-5 text-xs font-semibold">
        {state.kind === "added" ? (
          <span className="inline-flex items-center gap-1 text-commerce-brand-dark">
            <Check aria-hidden="true" className="size-3.5" />
            Đã thêm {state.quantity} {purchase.unit} vào giỏ yêu cầu.
          </span>
        ) : null}
        {state.kind === "limit" ? (
          <span className="text-commerce-price">Giỏ yêu cầu đã đủ số dòng cho phép.</span>
        ) : null}
        {state.kind === "rejected" ? (
          <span className="text-commerce-price">Chưa thêm được dòng này. Vui lòng thử lại.</span>
        ) : null}
        {state.kind === "idle" && needsQuote ? (
          <span className="text-commerce-secondary">
            Từ {purchase.contactFromQuantity} {purchase.unit} sẽ được báo giá riêng.
          </span>
        ) : null}
      </p>
    </div>
  );
}
