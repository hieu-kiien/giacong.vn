"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buildHandoffMessage } from "@/lib/request-cart-channels";
import { formatVnd } from "@/lib/format-vnd";
import type { RequestCartContact } from "@/lib/request-cart-client";
import type { ResolvedRequestCart } from "@/types/request-cart";

interface RequestAcceptedProps {
  cart: ResolvedRequestCart;
  contact: RequestCartContact | null;
  contactZaloUrl?: string;
  receivedAt: string;
  reference: string;
  onStartNewRequest: () => void;
}

type CopyState = "copied" | "manual" | null;

export function RequestAccepted({ cart, contact, contactZaloUrl, receivedAt, onStartNewRequest, reference }: RequestAcceptedProps) {
  const [copyState, setCopyState] = useState<CopyState>(null);
  const manualRef = useRef<HTMLTextAreaElement | null>(null);
  const message = buildHandoffMessage(reference, cart);
  const zaloHref = safeZaloHref(contactZaloUrl);

  useEffect(() => {
    if (copyState === "manual") {
      manualRef.current?.focus();
      manualRef.current?.select();
    }
  }, [copyState]);

  /** Available only after persistence succeeds; the Zalo URL contains no customer data. */
  const openZalo = async () => {
    if (!zaloHref) return;
    window.open(zaloHref, "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  };

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-[#16883e] bg-[#f2fbf5] p-4 sm:p-6">
        <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl">Yêu cầu {reference} đã được tiếp nhận</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Đây là yêu cầu báo giá, chưa phải báo giá cuối hoặc đơn hàng đã xác nhận. Vui lòng lưu mã để đối chiếu khi trao đổi.
        </p>
        <dl className="mt-4 grid gap-3 text-sm text-neutral-900 sm:grid-cols-2">
          <div>
            <dt className="text-neutral-600">Mã yêu cầu</dt>
            <dd className="mt-1 font-mono text-xl font-bold tracking-wide" data-request-reference>{reference}</dd>
          </div>
          <div>
            <dt className="text-neutral-600">Thời gian tiếp nhận</dt>
            <dd className="mt-1 font-medium">{formatReceivedAt(receivedAt)}</dd>
          </div>
          <div>
            <dt className="text-neutral-600">Nội dung</dt>
            <dd className="mt-1 font-medium">{`${cart.lineCount} dòng sản phẩm`}</dd>
          </div>
        </dl>
      </div>

      {contact ? <RequestCustomerSummary contact={contact} /> : null}
      <RequestLinesSummary cart={cart} />

      <section aria-labelledby="kenh-lien-he" className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
        <h3 className="text-lg font-bold text-neutral-900" id="kenh-lien-he">Trao đổi tiếp qua Zalo</h3>
        <p className="mt-2 text-sm text-neutral-700">
          Yêu cầu đã được lưu. Mở Zalo và gửi tóm tắt kèm mã yêu cầu để nhân viên xác nhận, báo giá.
        </p>
        {zaloHref ? (
          <button
            className="mt-4 flex min-h-12! w-full items-center justify-between gap-3 rounded-md bg-commerce-brand-dark! px-4 text-left text-sm font-semibold text-white! hover:brightness-90 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]! sm:w-auto"
            data-channel="zalo"
            onClick={() => void openZalo()}
            type="button"
          >
            <span>Sao chép tóm tắt và mở Zalo</span>
            <span className="font-normal">Zalo cửa hàng</span>
          </button>
        ) : (
          <p className="mt-4 rounded-md border border-[#b54708] bg-[#fff6ed] px-3 py-2 text-sm text-[#8a3a06]" role="alert">
            Yêu cầu đã được lưu nhưng cửa hàng chưa cấu hình đường dẫn Zalo.
          </p>
        )}
        <p aria-live="polite" className="mt-3 text-sm text-neutral-800" data-copy-status role="status">
          {copyState === "copied" ? "Đã sao chép tóm tắt yêu cầu, không gồm thông tin cá nhân." : null}
          {copyState === "manual" ? "Không sao chép được tự động. Hãy chọn và sao chép nội dung bên dưới." : null}
        </p>
        {copyState === "manual" ? (
          <textarea
            aria-label="Tóm tắt yêu cầu cần sao chép"
            className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm text-neutral-900 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
            data-copy-fallback
            readOnly
            ref={manualRef}
            rows={6}
            value={message}
          />
        ) : null}
      </section>

      <Link
        className="mt-6 inline-flex min-h-11! items-center rounded-md border border-neutral-300 px-5 text-sm font-semibold text-neutral-800! hover:border-commerce-brand hover:text-commerce-brand-dark! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
        data-cta
        href="/san-pham/"
        onClick={onStartNewRequest}
      >
        Tiếp tục xem sản phẩm
      </Link>
    </div>
  );
}

function safeZaloHref(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:"
      || !(hostname === "zalo.me" || hostname.endsWith(".zalo.me"))
      || url.username
      || url.password
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function RequestCustomerSummary({ contact }: { contact: RequestCartContact }) {
  return (
    <section aria-labelledby="thong-tin-rfq" className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
      <h3 className="text-lg font-bold text-neutral-900" id="thong-tin-rfq">Thông tin đã gửi</h3>
      <dl className="mt-4 grid gap-3 text-sm text-neutral-800 sm:grid-cols-2">
        <SummaryItem label="Họ và tên" value={contact.name} />
        <SummaryItem label="Điện thoại" value={contact.phone} />
        <SummaryItem label="Email" value={contact.email} />
        <SummaryItem label="Công ty" value={contact.companyName || "—"} />
        <SummaryItem label="Tỉnh/thành giao hàng" value={contact.deliveryLocation} />
        <SummaryItem label="Địa chỉ nhận hàng" value={contact.address || "—"} />
        <SummaryItem label="Hóa đơn VAT" value={vatInvoiceLabel(contact.vatInvoice)} />
        <SummaryItem label="Thời gian cần hàng" value={contact.neededBy || "—"} />
      </dl>
    </section>
  );
}

function RequestLinesSummary({ cart }: { cart: ResolvedRequestCart }) {
  const hasPricedLines = cart.lines.some((line) => line.lineTotal !== null);

  return (
    <section aria-labelledby="danh-sach-rfq" className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-neutral-900" id="danh-sach-rfq">Danh sách sản phẩm</h3>
        <span className="text-sm text-neutral-600">{cart.lineCount} dòng</span>
      </div>
      <ul className="mt-4 grid gap-3">
        {cart.lines.map((line) => (
          <li className="rounded-md border border-neutral-200 p-3" data-request-line={line.variantSku} key={`${line.parentSlug}-${line.variantSku}`}>
            <p className="font-semibold text-neutral-900">{line.productName || "Sản phẩm không còn tồn tại"}</p>
            <p className="mt-1 text-sm text-neutral-700">{conciseVariantLabel(line.productName, line.variantLabel)} · SKU {line.variantSku}</p>
            <dl className="mt-3 grid gap-2 text-sm text-neutral-800 sm:grid-cols-3">
              <SummaryItem label="Số lượng" value={`${line.quantity} ${line.unit}`} />
              <SummaryItem label="Đơn giá tham khảo" value={line.unitPrice === null ? "Liên hệ báo giá" : formatVnd(line.unitPrice)} />
              <SummaryItem label="Tạm tính dòng" value={line.lineTotal === null ? "Liên hệ báo giá" : formatVnd(line.lineTotal)} />
            </dl>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-neutral-200 pt-3 text-right">
        <p className="text-sm text-neutral-700">Tạm tính hàng hóa</p>
        <p className="text-xl font-bold text-neutral-900">{hasPricedLines ? formatVnd(cart.pricedSubtotal) : "Liên hệ báo giá"}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Nhân viên sẽ trao đổi qua Zalo để xác nhận quy cách và khả năng cung ứng. Giá cuối cùng, VAT và phí vận chuyển sẽ được chốt trong báo giá.
          {cart.hasPriceOnRequest ? " Một số dòng chưa có giá niêm yết và sẽ được báo riêng." : ""}
        </p>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-600">{label}</dt>
      <dd className="mt-0.5 font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function conciseVariantLabel(productName: string, variantLabel: string): string {
  const prefix = `${productName} — `;
  return productName && variantLabel.startsWith(prefix) ? variantLabel.slice(prefix.length) : variantLabel;
}

function vatInvoiceLabel(value: string): string {
  if (value === "yes") return "Có";
  if (value === "no") return "Không";
  return "Chưa chọn";
}

function formatReceivedAt(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Vừa xong";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(timestamp));
}
