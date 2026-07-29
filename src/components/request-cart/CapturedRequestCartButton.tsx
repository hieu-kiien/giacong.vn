"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  REQUEST_CART_STORAGE_KEY,
  REQUEST_CART_UPDATED_EVENT,
  countRequestCartLines,
} from "@/lib/request-cart-storage";

import styles from "./CapturedRequestCartButton.module.css";

export function CapturedRequestCartButton() {
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    const sync = () => setLineCount(countRequestCartLines(window.localStorage));
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === REQUEST_CART_STORAGE_KEY) sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(REQUEST_CART_UPDATED_EVENT, sync);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(REQUEST_CART_UPDATED_EVENT, sync);
    };
  }, []);

  return (
    <div className={`phonering-alo-cart ${styles.container}`}>
      <Link
        aria-label={`Giỏ hàng, ${lineCount} sản phẩm`}
        className={styles.link}
        href="/gui-yeu-cau/"
      >
        <ShoppingCart aria-hidden="true" className={styles.icon} />
        {lineCount > 0 ? (
          <span aria-hidden="true" className={styles.count}>
            {lineCount > 99 ? "99+" : lineCount}
          </span>
        ) : null}
        <span aria-live="polite" className="screen-reader-text">
          {lineCount} sản phẩm trong giỏ hàng
        </span>
      </Link>
    </div>
  );
}
