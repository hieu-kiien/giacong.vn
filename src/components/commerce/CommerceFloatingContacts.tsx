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
 * Floating contact cluster, bottom-right on desktop.
 *
 * The container is `pointer-events-none` and only the links re-enable pointer
 * events, so the cluster cannot swallow a click on the page behind it — the
 * topology's requirement that floating contacts never cover primary content. It is
 * a narrow column pinned to one corner rather than an overlay.
 *
 * Each row shows the reference itself next to the icon, so the target is legible
 * without hovering and works when icons fail to load.
 */
export function CommerceFloatingContacts() {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2 max-sm:bottom-3 max-sm:right-3">
      <p className="sr-only" id="commerce-floating-contacts-label">
        Liên hệ nhanh
      </p>
      <ul aria-labelledby="commerce-floating-contacts-label" className="flex flex-col items-end gap-2">
        {COMMERCE_CONTACT_CHANNELS.map((channel) => (
          <li key={channel.kind}>
            <a
              className="pointer-events-auto group flex commerce-target items-center gap-2 rounded-full border border-commerce-border bg-white px-3 shadow-commerce-card transition-colors hover:bg-commerce-active-surface focus-visible:commerce-focus-ring motion-reduce:transition-none"
              href={channel.href}
              {...(channel.isExternal ? { rel: "noreferrer", target: "_blank" } : {})}
            >
              <CommerceIcon className="text-commerce-brand-dark" icon={CHANNEL_ICON[channel.kind]} size="md" />
              <span className="text-sm font-semibold text-commerce-body max-sm:sr-only">
                {channel.label}
                <span className="block text-xs font-normal text-commerce-secondary">{channel.contact}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
