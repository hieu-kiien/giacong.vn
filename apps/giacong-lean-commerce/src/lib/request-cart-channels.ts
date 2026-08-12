// Demo contact channels for the accepted-request handoff.
// Every value here is demo data from the master plan and must be replaced with real data
// before a public launch. Prepared content deliberately carries only the reference and the
// server-resolved lines: no name, phone or email ever leaves the page this way.
import type { ResolvedRequestCart } from "../types/request-cart.ts";

export interface RequestCartChannel {
  /** Demo data pending owner confirmation, per the master plan. */
  demo: true;
  /** Chat channels cannot receive text through a URL, so the content is copied first. */
  copyFirst: boolean;
  contact: string;
  href: string;
  id: "email" | "hotline" | "messenger" | "zalo";
  label: string;
}

export const REQUEST_CART_CHANNELS: readonly RequestCartChannel[] = [
  { contact: "06408115", copyFirst: true, demo: true, href: "https://zalo.me/06408115", id: "zalo", label: "Zalo" },
  { contact: "m.me/qtudepdai", copyFirst: true, demo: true, href: "https://m.me/qtudepdai", id: "messenger", label: "Messenger" },
  { contact: "qtu1053@gmail.com", copyFirst: false, demo: true, href: "mailto:qtu1053@gmail.com", id: "email", label: "Email" },
  { contact: "0868408115", copyFirst: false, demo: true, href: "tel:0868408115", id: "hotline", label: "Hotline" },
];

const MAX_MESSAGE_LENGTH = 1_800;

/** Chat-ready summary of an accepted request. Reference first, so truncation can never drop it. */
export function buildHandoffMessage(reference: string, cart: ResolvedRequestCart): string {
  const header = `Yêu cầu đặt hàng - Mã ${reference}`;
  const lines = cart.lines.map((line, index) => {
    const variant = line.variantLabel ? ` - ${line.variantLabel}` : "";
    const price = line.unitPrice === null ? "Liên hệ báo giá" : `${formatPlainVnd(line.unitPrice)} / ${line.unit}`;
    return `${index + 1}. ${line.productName}${variant}: ${line.quantity} ${line.unit} (${price})`;
  });

  const body = [header, "", ...lines].join("\n");
  if (body.length <= MAX_MESSAGE_LENGTH) return body;

  const kept: string[] = [];
  let length = header.length + 2;
  for (const line of lines) {
    if (length + line.length + 1 > MAX_MESSAGE_LENGTH - 40) break;
    kept.push(line);
    length += line.length + 1;
  }
  return [header, "", ...kept, `... và ${lines.length - kept.length} dòng khác.`].join("\n");
}

function formatPlainVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)} d`;
}

/** Builds the mailto/tel target, adding the reference to the channels whose URL can carry it. */
export function channelHref(channel: RequestCartChannel, reference: string, message: string): string {
  if (channel.id !== "email") return channel.href;
  const subject = encodeURIComponent(`Yêu cầu đặt hàng - Mã ${reference}`);
  return `${channel.href}?subject=${subject}&body=${encodeURIComponent(message)}`;
}
