"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { REQUEST_CART_CHANNELS, buildHandoffMessage, channelHref } from "@/lib/request-cart-channels";
import type { RequestCartChannel } from "@/lib/request-cart-channels";
import type { ResolvedRequestCart } from "@/types/request-cart";

interface RequestAcceptedProps {
  cart: ResolvedRequestCart;
  reference: string;
}

type CopyState = { channel: string; status: "copied" | "manual" } | null;

export function RequestAccepted({ cart, reference }: RequestAcceptedProps) {
  const [copyState, setCopyState] = useState<CopyState>(null);
  const manualRef = useRef<HTMLTextAreaElement | null>(null);
  const message = buildHandoffMessage(reference, cart);

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
        <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl">Đã tiếp nhận yêu cầu đặt hàng</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Chúng tôi sẽ liên hệ để xác nhận số lượng và báo giá. Vui lòng lưu Mã bên dưới để đối chiếu.
        </p>
        <p className="mt-4 text-base text-neutral-900">
          <span className="text-neutral-700">Mã: </span>
          <strong className="font-mono text-xl tracking-wide" data-request-reference>{reference}</strong>
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          {`${cart.lineCount} dòng · ${cart.requestType}`}
        </p>
      </div>

      <section aria-labelledby="kenh-lien-he" className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
        <h3 className="text-lg font-bold text-neutral-900" id="kenh-lien-he">Cần trao đổi nhanh?</h3>
        <p className="mt-2 text-sm text-neutral-700">
          Gửi kèm Mã qua kênh bạn thuận tiện. Với Zalo và Messenger, nội dung được sao chép trước để bạn dán vào cuộc trò chuyện.
        </p>
        <p className="mt-2 text-sm text-[#8a3a06]">Các kênh dưới đây là dữ liệu demo, đang chờ chủ dự án xác nhận.</p>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {REQUEST_CART_CHANNELS.map((channel) => (
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
          {copyState?.status === "copied" ? "Đã sao chép nội dung kèm Mã." : null}
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

      <Link
        className="mt-6 inline-flex min-h-11! items-center rounded-md border border-neutral-300 px-5 text-sm font-semibold text-neutral-800! hover:border-commerce-brand hover:text-commerce-brand-dark! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
        data-cta
        href="/san-pham/"
      >
        Tiếp tục xem sản phẩm
      </Link>
    </div>
  );
}
