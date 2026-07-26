import { Mail, MessageCircle, Phone, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CommerceIcon } from "@/components/commerce/CommerceIcon";
import {
  COMMERCE_CONTACT_CHANNELS,
  type CommerceContactKind,
} from "@/components/commerce/commerce-navigation";

/**
 * Line icons only. The chat channels are represented by generic message glyphs
 * rather than their vendors' brand marks, so no third-party logo asset ships.
 */
const CHANNEL_ICON: Record<CommerceContactKind, LucideIcon> = {
  email: Mail,
  hotline: Phone,
  messenger: Send,
  zalo: MessageCircle,
};

/**
 * Floating contact cluster in the desktop viewport's outer gutter.
 *
 * The 1,344px content rail leaves 48px on either side at the first supported
 * viewport where this cluster appears (1,440px). Keeping every link to 44px and
 * pinning the column flush-right lets it stay fixed without sitting over the last
 * product card. At narrower widths the same links live in the support strip in
 * normal flow.
 *
 * The container is `pointer-events-none` and only the links re-enable pointer
 * events, so the unused gutter never swallows a page click.
 */
export function CommerceFloatingContacts() {
  return (
    <div className="pointer-events-none fixed bottom-4 right-0 z-30 hidden flex-col items-end gap-2 min-[1440px]:flex">
      <p className="sr-only" id="commerce-floating-contacts-label">
        Liên hệ nhanh
      </p>
      <ul aria-labelledby="commerce-floating-contacts-label" className="flex flex-col items-end gap-2">
        {COMMERCE_CONTACT_CHANNELS.map((channel) => (
          <li key={channel.kind}>
            <a
              className="pointer-events-auto flex size-11 items-center justify-center rounded-l-full border border-r-0 border-commerce-border bg-white shadow-commerce-card transition-colors hover:bg-commerce-active-surface focus-visible:commerce-focus-ring motion-reduce:transition-none"
              href={channel.href}
              {...(channel.isExternal ? { rel: "noreferrer", target: "_blank" } : {})}
            >
              <CommerceIcon className="text-commerce-brand-dark" icon={CHANNEL_ICON[channel.kind]} size="md" />
              <span className="sr-only">
                {channel.label}
                {" — "}
                {channel.contact}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
