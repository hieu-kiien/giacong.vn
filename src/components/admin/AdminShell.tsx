"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, LogOut, Menu, Package } from "lucide-react";

interface Props { name: string; dashboard: boolean; catalog: boolean; landing: string; children: React.ReactNode }

export function AdminShell({ name, dashboard, catalog, landing, children }: Props) {
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const nav = [
    { href: "/quan-tri", label: "Tổng quan", icon: LayoutDashboard, visible: dashboard },
    { href: "/quan-tri/san-pham", label: "Danh mục", icon: Package, visible: catalog },
  ];
  useEffect(() => { if (open) navRef.current?.querySelector("a")?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      menuTriggerRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  async function logout() {
    setLogoutError("");
    try {
      const response = await fetch("/api/quan-tri/session", { method: "DELETE", headers: { Origin: window.location.origin } });
      if (response.status !== 204) return setLogoutError("Không thể đăng xuất lúc này. Vui lòng thử lại.");
      router.replace("/quan-tri/dang-nhap");
      router.refresh();
    } catch { setLogoutError("Không thể kết nối để đăng xuất. Vui lòng thử lại."); }
  }
  return <div className="min-h-dvh bg-[#f5f5ed] text-[#273326] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
    <a className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-white focus:p-3" href="#admin-main">Bỏ qua điều hướng</a>
    {logoutError && <p role="status" aria-live="polite" className="fixed inset-x-4 top-3 z-50 rounded bg-[#fff9ed] p-3 text-sm text-[#8b2c16] lg:inset-x-auto lg:right-6">{logoutError}</p>}
    <header className="flex h-14 items-center justify-between border-b border-[#d7d8c9] bg-[#fbfbf5] px-4 lg:hidden">
      <button ref={menuTriggerRef} aria-expanded={open} aria-controls="admin-nav" aria-label={open ? "Đóng menu quản trị" : "Mở menu quản trị"} className="rounded p-2 focus-visible:outline-2" onClick={() => setOpen((value) => !value)}><Menu aria-hidden /></button>
      <strong className="text-sm tracking-wide">GIA CÔNG · QUẢN TRỊ</strong>
      <button onClick={logout} className="rounded p-2" aria-label="Đăng xuất"><LogOut aria-hidden size={18} /></button>
    </header>
    <aside id="admin-nav" className={`${open ? "block" : "hidden"} fixed inset-x-0 top-14 z-40 border-b border-[#d7d8c9] bg-[#fbfbf5] p-3 lg:sticky lg:top-0 lg:block lg:min-h-dvh lg:border-b-0 lg:border-r`}>
      <div className="hidden px-3 py-6 lg:block"><p className="text-xs font-semibold tracking-[0.16em] text-[#667151]">GIA CÔNG</p><h1 className="mt-1 text-lg font-semibold">Quản trị B2B</h1></div>
      <nav ref={navRef} className="space-y-1">{nav.filter((item) => item.visible).map((item) => { const Icon = item.icon; const active = pathname === item.href || (item.href === "/quan-tri/san-pham" && pathname.startsWith("/quan-tri/san-pham/")); return <Link onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-[#dfe8bd] text-[#33470d]" : "hover:bg-[#eff0e5]"}`} href={item.href} key={item.href}><Icon size={17} aria-hidden />{item.label}</Link>; })}</nav>
      <div className="mt-6 border-t border-[#d7d8c9] px-3 pt-4 text-xs text-[#667151]"><p className="truncate">{name}</p><button onClick={logout} className="mt-3 inline-flex items-center gap-2 font-medium text-[#3f5712]"><LogOut size={16} aria-hidden />Đăng xuất</button></div>
    </aside>
    <div className="min-w-0"><header className="hidden h-14 items-center justify-between border-b border-[#d7d8c9] bg-[#fbfbf5] px-6 text-sm text-[#667151] lg:flex"><span>{landing === "/quan-tri" ? "Tổng quan" : "Danh mục"}</span><span>{name}</span></header><main id="admin-main" className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main></div>
  </div>;
}
