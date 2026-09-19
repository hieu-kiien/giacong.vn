"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatVnd } from "@/lib/format-vnd";
import {
  REQUEST_CART_ACCEPTED_STORAGE_KEY,
  REQUEST_CART_REVALIDATE_ENDPOINT,
  buildRevalidateBody,
  driftNotice,
  hydrationNotice,
  parseAcceptedRequest,
  parseRevalidateResponse,
  serializeAcceptedRequest,
} from "@/lib/request-cart-client";
import { RequestAccepted } from "@/components/request-cart/RequestAccepted";
import { RequestForm } from "@/components/request-cart/RequestForm";
import type { AcceptedRequestSnapshot, RequestCartContact } from "@/lib/request-cart-client";
import {
  emptyRequestCart,
  readRequestCart,
  removeRequestCartLine,
  setRequestCartQuantity,
  toRequestCartKeys,
  writeRequestCart,
} from "@/lib/request-cart-storage";
import type { RequestCartState, ResolvedRequestCart, ResolvedRequestCartLine } from "@/types/request-cart";

const REVALIDATE_FAILURE_MESSAGE = "Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.";

interface RequestCartViewProps {
  contactEmail?: string;
}

export function RequestCartView({ contactEmail }: RequestCartViewProps = {}) {
  const [cart, setCart] = useState<RequestCartState | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedRequestCart | null>(null);
  const [drift, setDrift] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [accepted, setAccepted] = useState<AcceptedRequestSnapshot | null>(null);
  const lastResolved = useRef<ResolvedRequestCart | null>(null);

  /*
   * This is deliberately post-hydration: localStorage is unavailable during the server render,
   * so the first client render must stay neutral and then mirror the browser-owned cart.
   */
  useEffect(() => {
    const read = readRequestCart(window.localStorage);
    queueMicrotask(() => {
      setStorageNotice(hydrationNotice(read));
      setCart(read.state);
    });
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(REQUEST_CART_ACCEPTED_STORAGE_KEY);
      const restored = parseAcceptedRequest(stored);
      if (restored) setAccepted(restored);
      else if (stored) window.sessionStorage.removeItem(REQUEST_CART_ACCEPTED_STORAGE_KEY);
    } catch {
      // A blocked or full session store must not hide the live cart.
    }
  }, []);

  const linesKey = cart ? JSON.stringify(toRequestCartKeys(cart)) : "";

  useEffect(() => {
    if (!cart || cart.lines.length === 0) {
      queueMicrotask(() => {
        setResolved(null);
        setError(null);
        setPending(false);
        lastResolved.current = null;
      });
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setPending(true);
    });
    void (async () => {
      try {
        const response = await fetch(REQUEST_CART_REVALIDATE_ENDPOINT, {
          body: JSON.stringify(buildRevalidateBody(toRequestCartKeys(cart))),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (controller.signal.aborted) return;

        const result = parseRevalidateResponse(response.status, body);
        if (result.status === "ok") {
          setDrift(driftNotice(lastResolved.current, result.cart));
          lastResolved.current = result.cart;
          setResolved(result.cart);
          setError(null);
        } else {
          setResolved(null);
          setError(result.message);
        }
      } catch {
        if (controller.signal.aborted) return;
        setResolved(null);
        setError(REVALIDATE_FAILURE_MESSAGE);
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    })();

    return () => controller.abort();
    // `linesKey` is the value identity of the cart lines; `cart` itself changes on every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, refreshNonce]);

  const changeQuantity = useCallback((variantSku: string, quantity: number) => {
    if (!cart) return;
    const mutation = setRequestCartQuantity(cart, variantSku, quantity);
    if (mutation.status !== "ok") return;
    writeRequestCart(window.localStorage, mutation.state);
    setCart(mutation.state);
  }, [cart]);

  const removeLine = useCallback((variantSku: string) => {
    if (!cart) return;
    const next = removeRequestCartLine(cart, variantSku);
    writeRequestCart(window.localStorage, next);
    setCart(next);
  }, [cart]);

  /**
   * Only a 202 clears the cart: any other outcome keeps every line so nothing is silently lost.
   * The priced cart is kept in component state so the accepted panel can still summarise it.
   */
  const acceptRequest = useCallback((
    result: { contact: RequestCartContact; receivedAt: string; reference: string },
    submitted: ResolvedRequestCart,
  ) => {
    const empty = emptyRequestCart();
    writeRequestCart(window.localStorage, empty);
    const snapshot: AcceptedRequestSnapshot = {
      cart: submitted,
      contact: result.contact,
      receivedAt: result.receivedAt,
      reference: result.reference,
    };
    try {
      window.sessionStorage.setItem(REQUEST_CART_ACCEPTED_STORAGE_KEY, serializeAcceptedRequest(snapshot));
    } catch {
      // The live success state remains available even if browser storage is unavailable.
    }
    setAccepted(snapshot);
    setResolved(null);
    setDrift(null);
    setError(null);
    lastResolved.current = null;
    setCart(empty);
  }, []);

  const startNewRequest = useCallback(() => {
    try {
      window.sessionStorage.removeItem(REQUEST_CART_ACCEPTED_STORAGE_KEY);
    } catch {
      // Ignore storage restrictions; clearing the live view is still safe.
    }
    setAccepted(null);
  }, []);

  useEffect(() => {
    if (!cart || cart.lines.length === 0 || !accepted) return;
    startNewRequest();
  }, [accepted, cart, startNewRequest]);

  /** A 409 repaints from the server's fresh snapshot instead of the state the customer saw. */
  const applyConflict = useCallback((fresh: ResolvedRequestCart | null) => {
    if (!fresh) {
      setRefreshNonce((value) => value + 1);
      return;
    }
    lastResolved.current = fresh;
    setResolved(fresh);
    setDrift(null);
  }, []);

  const lines = cart?.lines ?? [];

  return (
    <div className="w-full py-8" data-motion-section="request-cart">
      <p className="mt-3 max-w-2xl text-sm text-neutral-700 sm:text-base">
        Giá và tạm tính được hệ thống kiểm tra khi bạn thay đổi số lượng và trước khi gửi yêu cầu.
      </p>

      {storageNotice ? (
        <p className="mt-4 rounded-md border border-[#b54708] bg-[#fff6ed] px-4 py-3 text-sm text-[#8a3a06]" role="status">
          {storageNotice}
        </p>
      ) : null}

      {accepted !== null ? (
        <RequestAccepted
          cart={accepted.cart}
          contact={accepted.contact}
          contactEmail={contactEmail}
          receivedAt={accepted.receivedAt}
          reference={accepted.reference}
          onStartNewRequest={startNewRequest}
        />
      ) : cart === null ? (
        <p className="mt-6 text-sm text-neutral-700" role="status">Đang đọc giỏ yêu cầu...</p>
      ) : lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section aria-label="Dòng trong giỏ yêu cầu" className="min-w-0">
            {drift ? (
              <p className="mb-4 rounded-md border border-[#b54708] bg-[#fff6ed] px-4 py-3 text-sm text-[#8a3a06]" role="status">
                {drift}
              </p>
            ) : null}
            {error ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3" role="alert">
                <p className="text-sm text-red-800">{error}</p>
                <button
                  className="mt-3 min-h-11! rounded-md bg-commerce-brand-dark! px-4 text-sm font-semibold text-white! hover:brightness-90 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
                  onClick={() => setRefreshNonce((value) => value + 1)}
                  type="button"
                >
                  Thử lại
                </button>
              </div>
            ) : null}
            {!error && !resolved && pending ? (
              <p className="text-sm text-neutral-700" role="status">Đang xác thực giỏ yêu cầu...</p>
            ) : null}
            {resolved ? (
              <ul className="flex flex-col gap-4 list-none!">
                {resolved.lines.map((line) => (
                  <CartLine
                    key={`${line.parentSlug}-${line.variantSku}`}
                    line={line}
                    onChangeQuantity={changeQuantity}
                    onRemove={removeLine}
                  />
                ))}
              </ul>
            ) : null}
          </section>

          {resolved ? <CartSummary cart={resolved} /> : null}
        </div>
        {resolved ? (
          <RequestForm
            cart={resolved}
            onAccepted={(result) => acceptRequest(result, resolved)}
            onConflict={applyConflict}
          />
        ) : null}
        </>
      )}
    </div>
  );
}

// Rendered from the last resolved cart, which is captured before the cart is cleared.

function EmptyCart() {
  return (
    <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
      <p className="text-base font-semibold text-neutral-900">Giỏ yêu cầu đang trống.</p>
      <p className="mt-2 text-sm text-neutral-700">Chọn sản phẩm và số lượng để thêm vào yêu cầu báo giá.</p>
      <Link
        className="mt-4 inline-flex min-h-11! items-center rounded-md bg-commerce-brand-dark! px-5 text-sm font-semibold text-white! hover:brightness-90 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
        data-cta
        href="/san-pham/"
      >
        Xem sản phẩm
      </Link>
    </div>
  );
}

interface CartLineProps {
  line: ResolvedRequestCartLine;
  onChangeQuantity: (variantSku: string, quantity: number) => void;
  onRemove: (variantSku: string) => void;
}

function CartLine({ line, onChangeQuantity, onRemove }: CartLineProps) {
  const blocking = line.adjustments.filter((adjustment) => adjustment.code !== "PRICE_ON_REQUEST");
  const priceNote = line.adjustments.find((adjustment) => adjustment.code === "PRICE_ON_REQUEST");
  const label = line.productName || line.variantSku;
  const variantLabel = conciseVariantLabel(line.productName, line.variantLabel);
  const quantityStep = line.quantityStep ?? 1;
  const minimumQuantity = line.minimumOrderQuantity ?? 1;
  const canDecrease = line.quantity - quantityStep >= minimumQuantity;

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4" data-cart-line={line.variantSku}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {line.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={line.productName || "Sản phẩm trong giỏ yêu cầu"} className="size-20 shrink-0 rounded-md border border-neutral-200 object-cover" data-cart-image loading="lazy" src={line.imageUrl} />
          ) : (
            <div aria-label="Chưa có ảnh sản phẩm" className="size-20 shrink-0 rounded-md border border-neutral-200 bg-neutral-100" data-cart-image />
          )}
          <div className="min-w-0">
            <p className="text-base font-semibold text-neutral-900">{line.productName || "Sản phẩm không còn tồn tại"}</p>
            <p className="mt-1 text-sm text-neutral-700">
              {variantLabel || "Biến thể không xác định"}
              <span className="text-neutral-500"> · SKU {line.variantSku}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex min-h-11! items-center rounded-md border border-commerce-brand px-3 text-sm font-medium text-commerce-brand-dark! hover:bg-[#eff8e8] focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
            href={`/san-pham/${line.parentSlug}/?variant=${encodeURIComponent(line.variantSku)}&editCart=${encodeURIComponent(line.variantSku)}`}
          >
            Chỉnh sản phẩm
          </Link>
          <button
            aria-label={`Xóa ${label}${line.variantLabel ? ` - ${line.variantLabel}` : ""} khỏi giỏ yêu cầu`}
            className="min-h-11! rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-800! hover:border-red-400 hover:text-red-700! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
            onClick={() => onRemove(line.variantSku)}
            type="button"
          >
            Xóa
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div data-cart-quantity>
          <p className="block text-sm font-medium text-neutral-800">
            {`Số lượng${line.unit ? ` (${line.unit})` : ""}`}
          </p>
          <div className="mt-1 inline-flex h-11 overflow-hidden rounded-md border border-neutral-300 bg-white">
            <button aria-label={`Giảm số lượng ${label}`} className="min-h-11! w-11 border-r border-neutral-300 text-lg font-semibold text-neutral-800! hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400!" disabled={!canDecrease} onClick={() => onChangeQuantity(line.variantSku, line.quantity - quantityStep)} type="button">−</button>
            <output className="flex min-w-16 items-center justify-center px-3 text-base font-semibold text-neutral-900">{line.quantity}</output>
            <button aria-label={`Tăng số lượng ${label}`} className="min-h-11! w-11 border-l border-neutral-300 text-lg font-semibold text-neutral-800! hover:bg-neutral-50" onClick={() => onChangeQuantity(line.variantSku, line.quantity + quantityStep)} type="button">+</button>
          </div>
        </div>
        <p className="text-sm text-neutral-700">
          <span className="block text-neutral-600">Đơn giá</span>
          <span className="text-base font-semibold text-neutral-900" data-cart-unit-price>
            {line.unitPrice === null ? "Liên hệ báo giá" : formatVnd(line.unitPrice)}
          </span>
        </p>
        {line.lineTotal === null ? null : (
          <p className="text-sm text-neutral-700">
            <span className="block text-neutral-600">Thành tiền</span>
            <span className="text-base font-semibold text-neutral-900" data-cart-line-total>{formatVnd(line.lineTotal)}</span>
          </p>
        )}
      </div>

      {priceNote ? (
        <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
          {priceNote.message}
        </p>
      ) : null}
      {blocking.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2" data-cart-line-warning>
          {blocking.map((adjustment) => (
            <li className="rounded-md border border-[#b54708] bg-[#fff6ed] px-3 py-2 text-sm text-[#8a3a06]" key={adjustment.code}>
              {adjustment.message}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function conciseVariantLabel(productName: string, variantLabel: string): string {
  const prefix = `${productName} — `;
  return productName && variantLabel.startsWith(prefix) ? variantLabel.slice(prefix.length) : variantLabel;
}

interface CartSummaryProps {
  cart: ResolvedRequestCart;
}

/**
 * Sticky only from `lg`, and never taller than the viewport, so it can never hide its own
 * controls or the content beside it. Below `lg` it stays in flow.
 */
function CartSummary({ cart }: CartSummaryProps) {
  return (
    <aside
      aria-label="Tạm tính giỏ yêu cầu"
      className="rounded-lg border border-neutral-200 bg-white p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
    >
      <h2 className="text-lg font-bold text-neutral-900">Tạm tính</h2>
      <dl aria-live="polite" className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-neutral-700">Số dòng</dt>
          <dd className="font-medium text-neutral-900">{cart.lineCount}</dd>
        </div>
        {cart.totalQuantity === null || !cart.uniformUnit ? null : (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-neutral-700">Tổng số lượng</dt>
            <dd className="font-medium text-neutral-900">{`${cart.totalQuantity} ${cart.uniformUnit}`}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-2">
          <dt className="text-neutral-700">Tạm tính</dt>
          <dd className="text-xl font-bold text-neutral-900" data-cart-subtotal>{formatVnd(cart.pricedSubtotal)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-neutral-600">Tạm tính chưa gồm phí vận chuyển và chưa phải là báo giá cuối.</p>
      {cart.hasPriceOnRequest ? (
        <p className="mt-2 text-sm text-[#8a3a06]">
          Tạm tính chưa gồm dòng chưa có giá; những dòng đó sẽ được báo giá riêng.
        </p>
      ) : null}
      {cart.isSubmittable ? null : (
        <p className="mt-3 rounded-md border border-[#b54708] bg-[#fff6ed] px-3 py-2 text-sm text-[#8a3a06]" data-cart-blocked role="status">
          Vui lòng sửa hoặc xóa dòng chưa hợp lệ trước khi gửi yêu cầu.
        </p>
      )}
    </aside>
  );
}
