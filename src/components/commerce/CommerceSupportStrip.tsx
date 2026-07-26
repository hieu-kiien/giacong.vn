import Link from "next/link";

import { CommerceRail } from "@/components/commerce/CommerceRail";
import {
  COMMERCE_CONTACT_CHANNELS,
  COMMERCE_QUOTE_LABEL,
  COMMERCE_REQUEST_HREF,
} from "@/components/commerce/commerce-navigation";

/**
 * B2B support strip: the pale green band above the page end.
 *
 * It is in normal flow rather than fixed, so it cannot cover the last row of a
 * product grid the way a pinned bar would. The topology asks for it near the bottom
 * of the viewport; the floating contact cluster is what stays pinned.
 */
export function CommerceSupportStrip() {
  return (
    <aside aria-labelledby="commerce-support-strip-title" className="border-t border-commerce-border bg-commerce-support-strip">
      <CommerceRail className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="text-base font-bold text-commerce-body" id="commerce-support-strip-title">
            Cần báo giá theo số lượng lớn?
          </p>
          <p className="text-sm text-commerce-secondary">
            Gửi danh sách mặt hàng, chúng tôi phản hồi trong giờ làm việc.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {COMMERCE_CONTACT_CHANNELS.map((channel) => (
            <a
              className="flex commerce-target items-center rounded-commerce-control px-3 text-sm font-bold text-commerce-brand-dark hover:bg-white focus-visible:commerce-focus-ring"
              href={channel.href}
              key={channel.kind}
              {...(channel.isExternal ? { rel: "noreferrer", target: "_blank" } : {})}
            >
              {channel.label}
              <span className="sr-only"> — {channel.contact}</span>
            </a>
          ))}
          <Link
            className="flex commerce-target items-center justify-center rounded-commerce-control bg-commerce-brand px-4 text-sm font-bold text-white transition-colors hover:bg-commerce-brand-dark focus-visible:commerce-focus-ring motion-reduce:transition-none"
            href={COMMERCE_REQUEST_HREF}
            prefetch={false}
          >
            {COMMERCE_QUOTE_LABEL}
          </Link>
        </div>
      </CommerceRail>
    </aside>
  );
}
