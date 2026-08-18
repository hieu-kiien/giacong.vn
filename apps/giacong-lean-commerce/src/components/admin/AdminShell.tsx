"use client";

import { ClipboardList, LayoutDashboard, Menu, Newspaper, Package, PenLine, Settings2, Tags, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AdminClientError, fetchAdmin, getInitials, type AdminSession } from "@/lib/admin-client";

interface AdminShellProps { children: ReactNode; }
interface SessionContextValue { session: AdminSession | null; }
const SessionContext = createContext<SessionContextValue>({ session: null });

export function useAdminSession(): AdminSession {
  const value = useContext(SessionContext).session;
  return value ?? { authenticated: false, subject: "", role: "viewer" };
}

const navItems = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/san-pham", label: "Sản phẩm", icon: Package },
  { href: "/admin/dich-vu", label: "Dịch vụ gia công", icon: Settings2 },
  { href: "/admin/tin-tuc", label: "Tin tức", icon: Newspaper },
  { href: "/admin/chuyen-muc-tin-tuc", label: "Chuyên mục tin tức", icon: Tags },
  { href: "/admin/yeu-cau", label: "Yêu cầu báo giá", icon: ClipboardList },
  { href: "/admin/noi-dung", label: "Nội dung & thương hiệu", icon: PenLine },
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "blocked" | "unavailable">("loading");
  const [error, setError] = useState<AdminClientError | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setStatus("loading");
      try {
        const data = await fetchAdmin<AdminSession>("/api/admin/session", controller.signal);
        if (!data.authenticated) {
          setStatus("blocked");
          setError(new AdminClientError("Phiên truy cập admin chưa được xác thực.", 401, "UNAUTHENTICATED"));
          return;
        }
        setSession(data);
        setStatus("ready");
      } catch (reason: unknown) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        const clientError = reason instanceof AdminClientError
          ? reason
          : new AdminClientError("Không thể kiểm tra phiên admin.", 0, "NETWORK_ERROR");
        setError(clientError);
        setStatus(clientError.status === 401 || clientError.status === 403 || clientError.status === 404 ? "blocked" : "unavailable");
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  if (status === "loading") return <AdminLoadingScreen />;
  if (status !== "ready" || !session) {
    return <AdminAccessScreen status={status === "blocked" ? "blocked" : "unavailable"} error={error} onRetry={() => setAttempt((value) => value + 1)} />;
  }

  return (
    <SessionContext.Provider value={{ session }}>
      <div className="admin-app">
        <div className="admin-shell">
          <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`} aria-label="Điều hướng admin">
            <Link className="admin-brand" href="/admin" onClick={() => setMobileOpen(false)}>
              <span className="admin-brand-mark" aria-hidden="true">g.</span>
              <span className="admin-brand-copy"><strong>Giacong.vn</strong><span>Operations console</span></span>
            </Link>
            <p className="admin-nav-label">Vận hành</p>
            <nav className="admin-nav">
              {navItems.map(({ href, icon: Icon, label }) => (
                <Link
                  aria-current={pathname === href ? "page" : undefined}
                  className="admin-nav-link"
                  data-testid={`link-admin-${label}`}
                  href={href}
                  key={href}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <div className="admin-sidebar-footer">
              <strong>Không gian nội bộ</strong>
              Dữ liệu hiển thị trực tiếp từ D1. Các thay đổi nội dung được quản lý qua quy trình phát hành.
            </div>
          </aside>
          <main className="admin-main">
            <header className="admin-topbar">
              <div className="admin-crumb">
                <button
                  aria-expanded={mobileOpen}
                  aria-label={mobileOpen ? "Đóng điều hướng" : "Mở điều hướng"}
                  className="admin-mobile-menu"
                  data-testid="button-toggle-admin-nav"
                  onClick={() => setMobileOpen((value) => !value)}
                  type="button"
                >
                  {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                </button>
                <span>Giacong.vn / <strong>{navItems.find((item) => item.href === pathname)?.label ?? "Admin"}</strong></span>
              </div>
              <div className="admin-topbar-meta">
                <span className="admin-live-dot">Kết nối trực tiếp</span>
                <span aria-label={`Tài khoản ${session.subject}`} className="admin-avatar" title={session.subject}>{getInitials(session.subject)}</span>
              </div>
            </header>
            {children}
          </main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}

function AdminLoadingScreen() {
  return (
    <div className="admin-access-page" aria-live="polite" data-testid="status-admin-session-loading">
      <div className="admin-access-card">
        <span className="admin-skeleton" style={{ display: "block", height: 34, marginBottom: 32, width: 180 }} />
        <span className="admin-skeleton" style={{ display: "block", height: 30, marginBottom: 14, width: "66%" }} />
        <span className="admin-skeleton" style={{ display: "block", height: 16, marginBottom: 8, width: "92%" }} />
        <span className="admin-skeleton" style={{ display: "block", height: 16, width: "78%" }} />
      </div>
    </div>
  );
}

function AdminAccessScreen({ status, error, onRetry }: { status: "blocked" | "unavailable"; error: AdminClientError | null; onRetry: () => void }) {
  const isBlocked = status === "blocked";
  return (
    <div className="admin-access-page">
      <section className="admin-access-card" aria-labelledby="admin-access-title">
        <Link className="admin-brand" href="/admin">
          <span className="admin-brand-mark" aria-hidden="true">g.</span>
          <span className="admin-brand-copy"><strong>Giacong.vn</strong><span>Operations console</span></span>
        </Link>
        <h1 id="admin-access-title">{isBlocked ? "Khu vực này cần Cloudflare Access" : "Admin chưa sẵn sàng"}</h1>
        <p>
          {isBlocked
            ? "Hãy mở console trên hostname admin đã được bảo vệ bằng Cloudflare Access. Host preview hoặc storefront không có phiên truy cập nội bộ."
            : "Không thể kết nối tới phiên admin lúc này. Kiểm tra hostname, binding runtime và thử lại."}
        </p>
        <div className="admin-access-detail">
          {error?.code ? `${error.code} · ` : ""}{error?.message ?? "Không nhận được phản hồi từ API session."}
        </div>
        <button className="admin-button admin-button-primary" data-testid="button-retry-admin-session" onClick={onRetry} type="button">
          Thử kiểm tra lại
        </button>
      </section>
    </div>
  );
}
