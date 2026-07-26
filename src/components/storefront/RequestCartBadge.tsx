"use client";

import { ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";

import { REQUEST_CART_STORAGE_KEY, readRequestCart } from "@/lib/request-cart-storage";

/**
 * Minimal request-cart hook for the header. It only ever reads the line count
 * through the locked storage contract, so no price, total or PII reaches the
 * chrome. `/gui-yeu-cau` is not built yet, so this stays a status readout rather
 * than a link the audit would (correctly) flag as dead.
 */
export function RequestCartBadge() {
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    const sync = () => setLineCount(readRequestCart(window.localStorage).state.lines.length);
    sync();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === REQUEST_CART_STORAGE_KEY) sync();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <p
      aria-live="polite"
      className="flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-white"
      data-request-cart-count={lineCount}
    >
      <ClipboardList aria-hidden="true" className="size-5" />
      <span>
        Giỏ yêu cầu
        <span className="ml-1.5 inline-flex min-w-6 justify-center rounded-full bg-white px-1.5 text-brand-800">
          {lineCount}
        </span>
      </span>
    </p>
  );
}
