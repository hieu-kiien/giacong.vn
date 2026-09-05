"use client";

import { ClipboardList, ExternalLink, History, LayoutDashboard, LayoutTemplate, Menu, Newspaper, Package, PanelTop, PenLine, Settings2, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { AdminClientError, fetchAdmin, getInitials, type AdminSession } from "@/lib/admin-client";
import { isAdminNavItemActive } from "@/lib/admin-navigation";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminUnsavedContext, shouldBlockUnsavedNavigation, shouldBypassUnsavedClick } from "@/components/admin/AdminUnsavedGuard";
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


// Fix1.1: theo doi href day du (pathname+search+hash) ma khong can useSearchParams
// (tranh missing-suspense khi prerender). Patch push/replace de bat Next App Router
// navigations (pushState khong tu fire popstate), + popstate/hashchange cho Back/Forward/hash.
function subscribeToFullHref(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  const origPush = window.history.pushState;
  const origReplace = window.history.replaceState;
  function patchedPush(this: History, ...args: Parameters<History["pushState"]>) {
    const result = origPush.apply(this, args);
    onChange();
    return result;
  }
  function patchedReplace(this: History, ...args: Parameters<History["replaceState"]>) {
    const result = origReplace.apply(this, args);
    onChange();
    return result;
  }
  window.history.pushState = patchedPush as typeof window.history.pushState;
  window.history.replaceState = patchedReplace as typeof window.history.replaceState;
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    window.history.pushState = origPush;
    window.history.replaceState = origReplace;
  };
}
const getFullHrefSnapshot = () => window.location.href;
const getFullHrefServerSnapshot = () => "";

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const fullHref = useSyncExternalStore(subscribeToFullHref, getFullHrefSnapshot, getFullHrefServerSnapshot);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "blocked" | "unavailable">("loading");
  const [error, setError] = useState<AdminClientError | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingNav, setPendingNav] = useState<{ href: string } | { history: true } | null>(null);
  const [unsavedSaving, setUnsavedSaving] = useState(false);
  const unsavedIsDirtyRef = useRef<() => boolean>(() => false);
  const unsavedSavingRef = useRef(false);
  const pathnameRef = useRef<string | null>(null);
  const currentHrefRef = useRef<string | null>(null);
  const currentHistoryStateRef = useRef<unknown>(null);
  const pendingRef = useRef<{ href: string } | { history: true } | null>(null);
  const allowPopRef = useRef(false);

  useEffect(() => {
    currentHrefRef.current = window.location.href;
    currentHistoryStateRef.current = window.history.state;
    pathnameRef.current = window.location.href;
  }, [pathname, fullHref]);

  useEffect(() => {
    pendingRef.current = pendingNav;
  }, [pendingNav]);

  const registerUnsaved = useCallback((next: { isDirty: () => boolean; saving: boolean }) => {
    unsavedIsDirtyRef.current = next.isDirty;
    unsavedSavingRef.current = next.saving;
    setUnsavedSaving(next.saving);
  }, []);

  function handleSidebarClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(target instanceof HTMLAnchorElement)) return;
    if (target.target === "_blank") return;
    const rawHref = target.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#")) return;
    let url: URL;
    try {
      url = new URL(rawHref, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    const bypass = shouldBypassUnsavedClick({
      altKey: event.altKey,
      button: event.button,
      ctrlKey: event.ctrlKey,
      href: rawHref,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      target: target.target || null,
      origin: url.origin,
      currentOrigin: window.location.origin,
    });
    if (bypass) return;
    if (pendingRef.current) {
      event.preventDefault();
      return;
    }
    if (typeof document !== "undefined" && document.querySelector('[role="dialog"]')) {
      event.preventDefault();
      return;
    }
    let dirty = false;
    try {
      dirty = unsavedIsDirtyRef.current();
    } catch {
      dirty = false;
    }
    const saving = unsavedSavingRef.current;
    if (!shouldBlockUnsavedNavigation({ isDirty: dirty, saving, hasPending: pendingRef.current !== null })) return;
    event.preventDefault();
    setPendingNav({ href: `${url.pathname}${url.search}${url.hash}` });
  }

  useEffect(() => {
    function onPopState() {
      if (allowPopRef.current) {
        allowPopRef.current = false;
        return;
      }
      const hasSnapshot = currentHrefRef.current !== null;
      const snapshotHref = currentHrefRef.current ?? pathnameRef.current ?? window.location.href;
      const snapshotState = hasSnapshot ? currentHistoryStateRef.current : window.history.state;
      if (pendingRef.current) {
        try {
          window.history.pushState(snapshotState, "", snapshotHref);
        } catch {
          // ignore restore failure; dialog stays open (single-flight)
        }
        return;
      }
      if (typeof document !== "undefined" && document.querySelector('[role="dialog"]')) {
        try {
          window.history.pushState(snapshotState, "", snapshotHref);
        } catch {
          // ignore
        }
        return;
      }
      let dirty = false;
      try {
        dirty = unsavedIsDirtyRef.current();
      } catch {
        dirty = false;
      }
      const saving = unsavedSavingRef.current;
      if (!shouldBlockUnsavedNavigation({ isDirty: dirty, saving, hasPending: false })) return;
      try {
        window.history.pushState(snapshotState, "", snapshotHref);
      } catch {
        // ignore
      }
      setPendingNav({ history: true });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function dismissPendingNav() {
    setPendingNav(null);
  }

  function confirmPendingNav() {
    const pending = pendingNav;
    setPendingNav(null);
    if (!pending) return;
    setMobileOpen(false);
    if ("history" in pending) {
      allowPopRef.current = true;
      window.history.back();
      return;
    }
    router.push(pending.href);
  }

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
  const currentNavItem = navGroups.flatMap((group) => group.items).find((item) => isAdminNavItemActive(pathname, item.href));

  return (
    <SessionContext.Provider value={{ session }}>
      <AdminUnsavedContext.Provider
        value={{ isDirty: () => unsavedIsDirtyRef.current(), saving: unsavedSaving, register: registerUnsaved }}
      >
      <AdminToastProvider>
        <div className="admin-app">
        <div className="admin-shell">
          <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`} aria-label="Điều hướng admin" onClickCapture={handleSidebarClickCapture}>
            <Link className="admin-brand" href="/admin" onClick={() => setMobileOpen(false)}>
              <span className="admin-brand-mark" aria-hidden="true">g.</span>
              <span className="admin-brand-copy"><strong>Giacong.vn</strong><span>Khu vực vận hành</span></span>
            </Link>
            <nav aria-label="Các khu vực quản trị" className="admin-nav">
              {visibleNavGroups.map((group) => (
                <div className="admin-nav-group" key={group.label}>
                  <p className="admin-nav-label">{group.label}</p>
                  {group.items.map(({ href, icon: Icon, label }) => {
                    const isActive = isAdminNavItemActive(pathname, href);
                    return <Link
                      aria-current={isActive ? "page" : undefined}
                      className="admin-nav-link"
                      data-testid={`link-admin-${label}`}
                      href={href}
                      key={href}
                      onClick={() => setMobileOpen(false)}
                      prefetch={false}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  })}
                </div>
              ))}
            </nav>
            <div className="admin-sidebar-footer">
              <strong>Không gian nội bộ</strong>
              Dữ liệu hiển thị trực tiếp từ hệ thống. Các thay đổi nội dung được quản lý qua quy trình phát hành.
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
        {pendingNav ? (
          <AdminConfirmDialog
            cancelLabel="Ở lại"
            confirmLabel="Bỏ thay đổi"
            message="Còn thay đổi chưa lưu. Rời trang sẽ mất thay đổi. Vẫn rời trang?"
            onConfirm={confirmPendingNav}
            onDismiss={dismissPendingNav}
            title="Bỏ thay đổi chưa lưu?"
          />
        ) : null}
      </AdminToastProvider>
      </AdminUnsavedContext.Provider>
    </SessionContext.Provider>
  );
}

function AdminLoadingScreen() {
  return (
    <div className="admin-app">
      <div className="admin-access-page" aria-live="polite" data-testid="status-admin-session-loading">
        <div className="admin-access-card">
          <span className="admin-skeleton" style={{ display: "block", height: 34, marginBottom: 32, width: 180 }} />
          <span className="admin-skeleton" style={{ display: "block", height: 30, marginBottom: 14, width: "66%" }} />
          <span className="admin-skeleton" style={{ display: "block", height: 16, marginBottom: 8, width: "92%" }} />
          <span className="admin-skeleton" style={{ display: "block", height: 16, width: "78%" }} />
        </div>
      </div>
    </div>
  );
}

function AdminAccessScreen({ status, error, onRetry }: { status: "blocked" | "unavailable"; error: AdminClientError | null; onRetry: () => void }) {
  const isBlocked = status === "blocked";
  const showLoginLink = isBlocked || error?.code === "NETWORK_ERROR";
  return (
    <div className="admin-app">
      <div className="admin-access-page">
        <section className="admin-access-card" aria-labelledby="admin-access-title">
          <Link className="admin-brand" href="/admin">
            <span className="admin-brand-mark" aria-hidden="true">g.</span>
            <span className="admin-brand-copy"><strong>Giacong.vn</strong><span>Khu vực vận hành</span></span>
          </Link>
          <h1 id="admin-access-title">{isBlocked ? "Khu vực này cần Cloudflare Access" : "Admin chưa sẵn sàng"}</h1>
          <p>
            {isBlocked
              ? "Hãy chọn nút “Đăng nhập Cloudflare Access” bên dưới, hoàn tất xác minh, rồi quay lại trang này. Host preview hoặc storefront không có phiên truy cập nội bộ."
              : error?.code === "NETWORK_ERROR"
                ? "Nếu bạn chưa đăng nhập, hãy chọn nút “Đăng nhập Cloudflare Access”. Nếu đã đăng nhập, hãy thử kiểm tra lại phiên."
                : "Không thể kết nối tới phiên admin lúc này. Kiểm tra hostname, binding runtime và thử lại."}
          </p>
          <div className="admin-access-detail">
            {error?.code ? `${error.code} · ` : ""}{error?.message ?? "Không nhận được phản hồi từ API session."}
          </div>
          <div className="admin-editor-actions">
            {showLoginLink ? (
              <button
                className="admin-button admin-button-primary"
                data-testid="button-admin-access-login"
                onClick={() => window.location.reload()}
                type="button"
              >
                Đăng nhập Cloudflare Access
              </button>
            ) : null}
            <button className="admin-button admin-button-quiet" data-testid="button-retry-admin-session" onClick={onRetry} type="button">
              Thử kiểm tra lại
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
