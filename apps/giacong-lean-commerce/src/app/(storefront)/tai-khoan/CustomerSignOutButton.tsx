"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { customerAuthClient } from "@/lib/customer-auth-client";
import { notifyWebsiteSignOut } from "@/lib/customer-session-events";
import { REQUEST_CART_ACCEPTED_STORAGE_KEY } from "@/lib/request-cart-client";
import styles from "./customer-account.module.css";

function responseHasError(response: unknown): boolean {
  return typeof response === "object" && response !== null && "error" in response && Boolean(response.error);
}

export function CustomerSignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setIsPending(true);
    setError("");

    try {
      const result = await customerAuthClient.signOut();
      if (responseHasError(result)) {
        setError("Chưa thể đăng xuất. Vui lòng thử lại.");
        setIsPending(false);
        return;
      }

      try {
        window.sessionStorage.removeItem(REQUEST_CART_ACCEPTED_STORAGE_KEY);
      } catch {
        // The auth session is already closed; keep sign-out working if storage is blocked.
      }
      notifyWebsiteSignOut();
      router.replace("/tai-khoan/dang-nhap/?next=%2Ftai-khoan%2F");
      router.refresh();
    } catch {
      setError("Chưa thể đăng xuất. Vui lòng thử lại.");
      setIsPending(false);
    }
  }

  return (
    <div>
      <button
        aria-busy={isPending}
        className={styles.signOut}
        disabled={isPending}
        onClick={handleSignOut}
        type="button"
      >
        {isPending ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
      {error ? <p className="text-small" role="alert">{error}</p> : null}
    </div>
  );
}
