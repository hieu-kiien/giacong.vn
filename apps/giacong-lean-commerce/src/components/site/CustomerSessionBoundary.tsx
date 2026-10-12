"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { WEBSITE_SIGN_OUT_EVENT, WEBSITE_SIGN_OUT_KEY } from "@/lib/customer-session-events";
import { resolveCustomerSessionView } from "@/lib/customer-session-state";

export function CustomerSessionBoundary({ children, userId }: { children: ReactNode; userId: string }) {
  const [revoked, setRevoked] = useState(false);
  const { data, error, isPending, refetch } = customerAuthClient.useSession();
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
  const view = resolveCustomerSessionView({ revoked, pending: isPending, error, expectedUserId: userId, user: data?.user });
  if (view === "expired") return <p>Phiên đăng nhập đã kết thúc. <Link href="/tai-khoan/dang-nhap/?next=%2Ftai-khoan%2F">Đăng nhập lại</Link></p>;
  if (view === "pending") return <p role="status">Đang kiểm tra tài khoản…</p>;
  if (view === "unavailable") return <p role="alert">Chưa kiểm tra được tài khoản do lỗi kết nối. <button onClick={() => { void refetch(); }} type="button">Thử lại</button></p>;
  if (view === "changed") return <p>Tài khoản đăng nhập đã thay đổi. <button onClick={() => window.location.reload()} type="button">Xem tài khoản hiện tại</button></p>;
  return children;
}
