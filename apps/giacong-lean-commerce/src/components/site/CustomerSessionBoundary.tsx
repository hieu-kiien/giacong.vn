"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { WEBSITE_SIGN_OUT_EVENT, WEBSITE_SIGN_OUT_KEY } from "@/lib/customer-session-events";

export function CustomerSessionBoundary({ children, userId }: { children: ReactNode; userId: string }) {
  const [revoked, setRevoked] = useState(false);
  const { data, isPending, refetch } = customerAuthClient.useSession();
  useEffect(() => {
    const onSignOut = () => setRevoked(true);
    const onStorage = (event: StorageEvent) => { if (event.key === WEBSITE_SIGN_OUT_KEY) onSignOut(); };
    const onResume = () => { void refetch(); };
    window.addEventListener(WEBSITE_SIGN_OUT_EVENT, onSignOut);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      window.removeEventListener(WEBSITE_SIGN_OUT_EVENT, onSignOut);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, [refetch]);
  if (revoked || (!isPending && !data?.user.emailVerified)) return <p>Phiên đăng nhập đã kết thúc. <Link href="/tai-khoan/dang-nhap/?next=%2Ftai-khoan%2F">Đăng nhập lại</Link></p>;
  if (isPending) return <p role="status">Đang kiểm tra tài khoản…</p>;
  if (data?.user.id !== userId) return <p>Tài khoản đăng nhập đã thay đổi. <button onClick={() => window.location.reload()} type="button">Xem tài khoản hiện tại</button></p>;
  return children;
}
