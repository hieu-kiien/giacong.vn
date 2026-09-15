"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { REQUEST_CART_CHANNELS, buildHandoffMessage, channelHref } from "@/lib/request-cart-channels";
import { formatVnd } from "@/lib/format-vnd";
import type { RequestCartContact } from "@/lib/request-cart-client";
import type { RequestCartChannel } from "@/lib/request-cart-channels";
import type { ResolvedRequestCart } from "@/types/request-cart";

interface RequestAcceptedProps {
  cart: ResolvedRequestCart;
  contact: RequestCartContact;
  receivedAt: string;
  reference: string;
  onStartNewRequest: () => void;
}

type CopyState = { channel: string; status: "copied" | "manual" } | null;

export function RequestAccepted({ cart, contact, receivedAt, onStartNewRequest, reference }: RequestAcceptedProps) {
  const [copyState, setCopyState] = useState<CopyState>(null);
  const manualRef = useRef<HTMLTextAreaElement | null>(null);
  const message = buildHandoffMessage(reference, cart);
  const confirmedChannels = REQUEST_CART_CHANNELS.filter((channel) => !channel.demo);

  /**
   * Chat channels cannot receive text through a URL, so the content is copied first and the
   * link opened second. A blocked clipboard falls back to a selectable textarea rather than
   * opening the chat with nothing to paste.
   */
  const openChannel = async (channel: RequestCartChannel) => {
    if (!channel.copyFirst) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(message);
      copied = true;
    } catch {
      copied = false;
    }
    setCopyState({ channel: channel.id, status: copied ? "copied" : "manual" });
    if (!copied) {
      manualRef.current?.focus();
      manualRef.current?.select();
      return;
    }
    window.open(channel.href, "_blank", "noopener,noreferrer");
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
            <dd className="mt-1 font-medium">{`${cart.lineCount} dòng · ${cart.requestType}`}</dd>
          </div>
        </dl>
      </div>

      <RequestCustomerSummary contact={contact} />
      <RequestLinesSummary cart={cart} />

      {confirmedChannels.length > 0 ? (
        <section aria-labelledby="kenh-lien-he" className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
          <h3 className="text-lg font-bold text-neutral-900" id="kenh-lien-he">Cần trao đổi nhanh?</h3>
          <p className="mt-2 text-sm text-neutral-700">
            Gửi kèm mã yêu cầu qua kênh bạn thuận tiện. Với Zalo và Messenger, nội dung được sao chép trước để bạn dán vào cuộc trò chuyện.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {confirmedChannels.map((channel) => (
              <li key={channel.id}>
                {channel.copyFirst ? (
                  <button
                    className="flex min-h-12! w-full items-center justify-between gap-3 rounded-md border border-neutral-300 px-4 text-left text-sm font-semibold text-neutral-900! hover:border-commerce-brand hover:text-commerce-brand-dark! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
                    data-channel={channel.id}
                    onClick={() => void openChannel(channel)}
                    type="button"
                  >
                    <span>{`Sao chép nội dung và mở ${channel.label}`}</span>
                    <span className="font-normal text-neutral-600">{channel.contact}</span>
                  </button>
                ) : (
                  <a
                    className="flex min-h-12! w-full items-center justify-between gap-3 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900! hover:border-commerce-brand hover:text-commerce-brand-dark! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
                    data-channel={channel.id}
                    data-cta
                    href={channelHref(channel, reference, message)}
                  >
                    <span>{channel.label}</span>
                    <span className="font-normal text-neutral-600">{channel.contact}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>

          <p aria-live="polite" className="mt-3 text-sm text-neutral-800" data-copy-status role="status">
            {copyState?.status === "copied" ? "Đã sao chép nội dung kèm mã yêu cầu." : null}
            {copyState?.status === "manual" ? "Không sao chép được tự động. Vui lòng chọn và sao chép nội dung bên dưới." : null}
          </p>
          {copyState?.status === "manual" ? (
            <textarea
              aria-label="Nội dung cần sao chép"
              className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm text-neutral-900 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
              data-copy-fallback
              readOnly
              ref={manualRef}
              rows={6}
              value={message}
            />
          ) : null}
        </section>
      ) : (
        <p className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          Nếu cần bổ sung thông tin, bạn có thể tiếp tục qua trang <Link className="font-semibold text-commerce-brand-dark underline" href="/lien-he/">Liên hệ</Link>.
        </p>
      )}

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
        <p className="text-xl font-bold text-neutral-900">{formatVnd(cart.pricedSubtotal)}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Giá cuối cùng, VAT, tồn kho và phí vận chuyển sẽ được xác nhận trong báo giá.
          {cart.hasPriceOnRequest ? " Một số dòng được báo giá riêng theo số lượng." : ""}
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
