"use client";

import { ClipboardList, ExternalLink, History, LayoutDashboard, LayoutTemplate, Menu, Newspaper, Package, PanelTop, PenLine, Settings2, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AdminClientError, fetchAdmin, getInitials, type AdminSession } from "@/lib/admin-client";
import { AdminToastProvider } from "@/components/admin/AdminToast";
import { canManage, type AdminCapability } from "@/lib/admin-permissions";

interface AdminShellProps { children: ReactNode; }
interface SessionContextValue { session: AdminSession | null; }
const SessionContext = createContext<SessionContextValue>({ session: null });

export function useAdminSession(): AdminSession {
  const value = useContext(SessionContext).session;
  // Client pages can be pre-rendered once before the shell finishes loading
  // its session. Keep that phase render-safe; AdminShell still gates children
  // until the real session has been verified.
  return value ?? { authenticated: false, subject: "", role: "viewer" };
}

interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  readCapability: AdminCapability;
  ownerOnly?: boolean;
}

interface AdminNavGroup {
  label: string;
  items: ReadonlyArray<AdminNavItem>;
}

const navGroups: ReadonlyArray<AdminNavGroup> = [
  {
    label: "Chỉnh sửa website",
    items: [
      { href: "/admin/noi-dung", label: "Nội dung & thương hiệu", icon: PenLine, readCapability: "content.read" },
      { href: "/admin/thiet-ke", label: "Thiết kế page", icon: LayoutTemplate, readCapability: "pages.read" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/san-pham", label: "Sản phẩm", icon: Package, readCapability: "catalog.read" },
      { href: "/admin/dich-vu", label: "Dịch vụ gia công", icon: Settings2, readCapability: "services.read" },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { href: "/admin/tin-tuc", label: "Tin tức", icon: Newspaper, readCapability: "news.read" },
      { href: "/admin/dieu-huong", label: "Điều hướng", icon: PanelTop, readCapability: "navigation.read" },
    ],
  },
  {
    label: "Yêu cầu khách hàng",
    items: [{ href: "/admin/yeu-cau", label: "Yêu cầu báo giá", icon: ClipboardList, readCapability: "leads.read" }],
  },
  {
    label: "Cài đặt",
    items: [{ href: "/admin", label: "Tổng quan", icon: LayoutDashboard, readCapability: "dashboard.read" }],
  },
  {
    label: "Tài khoản & quyền",
    items: [
      { href: "/admin/thanh-vien", label: "Thành viên & quyền", icon: UsersRound, readCapability: "members.read" },
      { href: "/admin/audit", label: "Lịch sử thay đổi", icon: History, readCapability: "members.read", ownerOnly: true },
    ],
  },
];

const roleLabels: Record<string, string> = {
  catalog_manager: "Quản lý catalog",
  content_manager: "Quản lý nội dung",
  owner: "Chủ sở hữu",
  sales_manager: "Quản lý yêu cầu",
  viewer: "Người xem",
};

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

  const visibleNavGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canManage(session.role, item.readCapability) && (!item.ownerOnly || session.role === "owner")) }))
    .filter((group) => group.items.length > 0);
  const currentNavItem = navGroups.flatMap((group) => group.items).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <SessionContext.Provider value={{ session }}>
      <AdminToastProvider>
        <div className="admin-app">
        <div className="admin-shell">
          <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`} aria-label="Điều hướng admin">
            <Link className="admin-brand" href="/admin" onClick={() => setMobileOpen(false)}>
              <span className="admin-brand-mark" aria-hidden="true">g.</span>
              <span className="admin-brand-copy"><strong>Giacong.vn</strong><span>Khu vực vận hành</span></span>
            </Link>
            <nav aria-label="Các khu vực quản trị" className="admin-nav">
              {visibleNavGroups.map((group) => (
                <div className="admin-nav-group" key={group.label}>
                  <p className="admin-nav-label">{group.label}</p>
                  {group.items.map(({ href, icon: Icon, label }) => (
                    <Link
                      aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
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
                </div>
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
                <span>Giacong.vn / <strong>{currentNavItem?.label ?? "Admin"}</strong></span>
              </div>
              <div className="admin-topbar-meta">
                <Link className="admin-storefront-link" href="/" rel="noreferrer" target="_blank">
                  Xem storefront
                  <ExternalLink aria-hidden="true" size={14} />
                </Link>
                <span className="admin-live-dot">Kết nối trực tiếp</span>
                <span className="admin-role-label">Vai trò: {roleLabels[session.role] ?? "Tài khoản được cấp quyền"}</span>
                <span aria-label={`Tài khoản ${session.subject}`} className="admin-avatar" title={session.subject}>{getInitials(session.subject)}</span>
              </div>
            </header>
            {children}
          </main>
        </div>
        </div>
      </AdminToastProvider>
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
          <span className="admin-brand-copy"><strong>Giacong.vn</strong><span>Khu vực vận hành</span></span>
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
        <div className="admin-editor-actions">
          {isBlocked ? (
            <a
              className="admin-button admin-button-primary"
              data-testid="link-admin-access-login"
              href="/cdn-cgi/access/login?redirect_url=%2Fadmin"
            >
              Đăng nhập Cloudflare Access
            </a>
          ) : null}
          <button className="admin-button admin-button-quiet" data-testid="button-retry-admin-session" onClick={onRetry} type="button">
            Thử kiểm tra lại
          </button>
        </div>
      </section>
    </div>
  );
}
