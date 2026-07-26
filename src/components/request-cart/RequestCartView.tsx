"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatVnd } from "@/lib/format-vnd";
import {
  REQUEST_CART_REVALIDATE_ENDPOINT,
  buildRevalidateBody,
  driftNotice,
  hydrationNotice,
  parseRevalidateResponse,
} from "@/lib/request-cart-client";
import { RequestAccepted } from "@/components/request-cart/RequestAccepted";
import { RequestForm } from "@/components/request-cart/RequestForm";
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

export function RequestCartView() {
  const [cart, setCart] = useState<RequestCartState | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedRequestCart | null>(null);
  const [drift, setDrift] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<{ cart: ResolvedRequestCart; reference: string } | null>(null);
  const lastResolved = useRef<ResolvedRequestCart | null>(null);

  /*
   * This is deliberately post-hydration: localStorage is unavailable during the server render,
   * so the first client render must stay neutral and then mirror the browser-owned cart.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const read = readRequestCart(window.localStorage);
    setStorageNotice(hydrationNotice(read));
    setCart(read.state);
  }, []);

  const linesKey = cart ? JSON.stringify(toRequestCartKeys(cart)) : "";

  useEffect(() => {
    if (!cart || cart.lines.length === 0) {
      setResolved(null);
      setError(null);
      setPending(false);
      lastResolved.current = null;
      return;
    }

    const controller = new AbortController();
    setPending(true);
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
  /* eslint-enable react-hooks/set-state-in-effect */

  const commitQuantity = useCallback((variantSku: string, raw: string) => {
    if (!cart) return;
    const quantity = Number(raw);
    const mutation = setRequestCartQuantity(cart, variantSku, quantity);
    if (mutation.status !== "ok") {
      setDrafts((current) => ({ ...current, [variantSku]: String(cart.lines.find((line) => line.variantSku === variantSku)?.quantity ?? "") }));
      return;
    }
    writeRequestCart(window.localStorage, mutation.state);
    setDrafts((current) => {
      const next = { ...current };
      delete next[variantSku];
      return next;
    });
    setCart(mutation.state);
  }, [cart]);

  const removeLine = useCallback((variantSku: string) => {
    if (!cart) return;
    const next = removeRequestCartLine(cart, variantSku);
    writeRequestCart(window.localStorage, next);
    setDrafts((current) => {
      const remaining = { ...current };
      delete remaining[variantSku];
      return remaining;
    });
    setCart(next);
  }, [cart]);

  /**
   * Only a 202 clears the cart: any other outcome keeps every line so nothing is silently lost.
   * The priced cart is kept in component state so the accepted panel can still summarise it.
   */
  const acceptRequest = useCallback((reference: string, submitted: ResolvedRequestCart) => {
    const empty = emptyRequestCart();
    writeRequestCart(window.localStorage, empty);
    setAccepted({ cart: submitted, reference });
    setResolved(null);
    setDrift(null);
    setError(null);
    lastResolved.current = null;
    setCart(empty);
  }, []);

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
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8" id="catalog-main">
      {/*
        The captured Flatsome CSS is unlayered, so its bare `a` and `input:focus` rules outrank
        Tailwind's `@layer utilities`. The `!` modifier is what makes our colour, underline and
        focus-ring utilities actually apply on this page.
      */}
      <nav aria-label="Đường dẫn" className="mb-3 text-sm text-neutral-700">
        <Link
          className="text-neutral-700! underline! hover:text-[#327600]! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
          href="/san-pham/"
        >
          Sản phẩm
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Giỏ yêu cầu</span>
      </nav>
      <h1 className="text-[28px] font-bold leading-tight text-neutral-900 sm:text-[36px]">Giỏ yêu cầu đặt hàng</h1>
      <span aria-hidden="true" className="mt-3 block h-1 w-16 rounded-full bg-[#b54708]" />
      <p className="mt-3 max-w-2xl text-sm text-neutral-700 sm:text-base">
        Đơn giá và tạm tính bên dưới do hệ thống tính lại theo dữ liệu mới nhất, không lấy từ máy của bạn.
      </p>

      {storageNotice ? (
        <p className="mt-4 rounded-md border border-[#b54708] bg-[#fff6ed] px-4 py-3 text-sm text-[#8a3a06]" role="status">
          {storageNotice}
        </p>
      ) : null}

      {accepted !== null ? (
        <RequestAccepted cart={accepted.cart} reference={accepted.reference} />
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
                  className="mt-3 min-h-11! rounded-md bg-[#327600]! px-4 text-sm font-semibold text-white! hover:bg-[#285f00]! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
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
              <ul className="flex flex-col gap-4">
                {resolved.lines.map((line) => (
                  <CartLine
                    draft={drafts[line.variantSku]}
                    key={`${line.parentSlug}-${line.variantSku}`}
                    line={line}
                    onCommit={commitQuantity}
                    onDraft={(value) => setDrafts((current) => ({ ...current, [line.variantSku]: value }))}
                    onRemove={removeLine}
                  />
                ))}
              </ul>
            ) : null}
          </section>

          {resolved ? <CartSummary cart={resolved} pending={pending} onRefresh={() => setRefreshNonce((value) => value + 1)} /> : null}
        </div>
        {resolved ? (
          <RequestForm
            cart={resolved}
            onAccepted={(reference) => acceptRequest(reference, resolved)}
            onConflict={applyConflict}
          />
        ) : null}
        </>
      )}
    </main>
  );
}

// Rendered from the last resolved cart, which is captured before the cart is cleared.

function EmptyCart() {
  return (
    <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
      <p className="text-base font-semibold text-neutral-900">Giỏ yêu cầu đang trống.</p>
      <p className="mt-2 text-sm text-neutral-700">Chọn sản phẩm và số lượng để thêm vào giỏ yêu cầu.</p>
      <Link
        className="mt-4 inline-flex min-h-11! items-center rounded-md bg-[#327600]! px-5 text-sm font-semibold text-white! hover:bg-[#285f00]! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
        data-cta
        href="/san-pham/"
      >
        Xem sản phẩm
      </Link>
    </div>
  );
}

interface CartLineProps {
  draft: string | undefined;
  line: ResolvedRequestCartLine;
  onCommit: (variantSku: string, raw: string) => void;
  onDraft: (value: string) => void;
  onRemove: (variantSku: string) => void;
}

function CartLine({ draft, line, onCommit, onDraft, onRemove }: CartLineProps) {
  const blocking = line.adjustments.filter((adjustment) => adjustment.code !== "PRICE_ON_REQUEST");
  const priceNote = line.adjustments.find((adjustment) => adjustment.code === "PRICE_ON_REQUEST");
  const label = line.productName || line.variantSku;
  const quantityId = `so-luong-${line.variantSku}`;

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4" data-cart-line={line.variantSku}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-neutral-900">{line.productName || "Sản phẩm không còn tồn tại"}</p>
          <p className="mt-1 text-sm text-neutral-700">
            {line.variantLabel ? line.variantLabel : "Biến thể không xác định"}
            <span className="text-neutral-500"> · SKU {line.variantSku}</span>
          </p>
        </div>
        <button
          aria-label={`Xóa ${label}${line.variantLabel ? ` - ${line.variantLabel}` : ""} khỏi giỏ yêu cầu`}
          className="min-h-11! rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-800! hover:border-red-400 hover:text-red-700! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
          onClick={() => onRemove(line.variantSku)}
          type="button"
        >
          Xóa
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div data-cart-quantity>
          <label className="block text-sm font-medium text-neutral-800" htmlFor={quantityId}>
            {`Số lượng${line.unit ? ` (${line.unit})` : ""}`}
          </label>
          <input
            className="mt-1 h-11! w-28 rounded-md border border-neutral-300 px-3 text-base text-neutral-900 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
            id={quantityId}
            inputMode="numeric"
            min={line.minimumOrderQuantity ?? 1}
            onBlur={(event) => onCommit(line.variantSku, event.target.value)}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommit(line.variantSku, event.currentTarget.value);
              }
            }}
            step={line.quantityStep ?? 1}
            type="number"
            value={draft ?? String(line.quantity)}
          />
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

interface CartSummaryProps {
  cart: ResolvedRequestCart;
  onRefresh: () => void;
  pending: boolean;
}

/**
 * Sticky only from `lg`, and never taller than the viewport, so it can never hide its own
 * controls or the content beside it. Below `lg` it stays in flow.
 */
function CartSummary({ cart, onRefresh, pending }: CartSummaryProps) {
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
      <button
        className="mt-4 min-h-11! w-full rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-800! hover:border-[#5aa400] hover:text-[#327600]! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]! disabled:border-neutral-200 disabled:text-neutral-600! disabled:opacity-100!"
        disabled={pending}
        onClick={onRefresh}
        type="button"
      >
        {pending ? "Đang cập nhật giá..." : "Làm mới giá"}
      </button>
    </aside>
  );
}
