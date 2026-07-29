"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";

import { COMMERCE_REQUEST_HREF } from "@/components/commerce/commerce-navigation";
import { CommerceIcon } from "@/components/commerce/CommerceIcon";
import { REQUEST_CART_STORAGE_KEY, countRequestCartLines } from "@/lib/request-cart-storage";

/**
 * Request-cart badge in the header: a white circle with green text at the
 * upper-right of the icon, as measured in the reference.
 *
 * It reads only the line count, through the locked storage contract, so no price,
 * total or customer detail ever reaches the chrome. The count is derived on the
 * client after mount — server-rendering it would ship a zero that then flickers,
 * because the store is `localStorage`.
 *
 * `countRequestCartLines`, not `readRequestCart`: the counting path is read-only. The
 * repairing read writes on repair and clears on reset, and because this badge is in the
 * shared chrome it mounts before `/gui-yeu-cau`'s own effect — so reading through that
 * path would consume a corrupt payload and leave the cart view with an empty cart and
 * no reset to explain.
 *
 * `data-request-cart-count` is the existing QA hook and keeps its name.
 */
export function CommerceRequestBadge() {
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    const sync = () => setLineCount(countRequestCartLines(window.localStorage));
    sync();
    // `key === null` is a whole-store clear, which also invalidates the count.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === REQUEST_CART_STORAGE_KEY) sync();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <Link
      aria-label={`Giỏ yêu cầu, ${lineCount} dòng`}
      className="relative flex commerce-target items-center justify-center rounded-commerce-control text-white transition-colors hover:bg-white/12 focus-visible:commerce-focus-ring motion-reduce:transition-none"
      data-request-cart-count={lineCount}
      href={COMMERCE_REQUEST_HREF}
    >
      <CommerceIcon icon={ClipboardList} size="lg" />
      {lineCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold leading-[18px] text-commerce-brand-dark"
        >
          {lineCount}
        </span>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {lineCount} dòng trong giỏ yêu cầu
      </span>
    </Link>
  );
}
