"use client";

import { Building2, ClipboardList, ExternalLink, History, Image as ImageIcon, LayoutDashboard, LayoutTemplate, LogOut, Menu, Newspaper, Package, PanelTop, PenLine, Settings2, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { AdminClientError, fetchAdmin, getInitials, type AdminSession } from "@/lib/admin-client";
import { isAdminNavItemActive, isStagingAdminHost } from "@/lib/admin-navigation";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminUnsavedContext, type AdminUnsavedState, shouldBlockUnsavedNavigation, shouldBypassUnsavedClick } from "@/components/admin/AdminUnsavedGuard";
import { AdminToastProvider } from "@/components/admin/AdminToast";
import { canManage, type AdminCapability } from "@/lib/admin-permissions";

interface AdminShellProps { brandName: string; children: ReactNode; }
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
    label: "Vận hành",
    items: [
      { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, readCapability: "dashboard.read" },
      { href: "/admin/yeu-cau", label: "Yêu cầu báo giá", icon: ClipboardList, readCapability: "leads.read" },
      { href: "/admin/khach-hang", label: "Khách hàng B2B", icon: Building2, readCapability: "crm.read" },
    ],
  },
  {
    label: "Chỉnh sửa website",
    items: [
      { href: "/admin/noi-dung", label: "Nội dung & thương hiệu", icon: PenLine, readCapability: "content.read" },
      { href: "/admin/thiet-ke", label: "Thiết kế trang", icon: LayoutTemplate, readCapability: "pages.read" },
      { href: "/admin/dieu-huong", label: "Menu", icon: PanelTop, readCapability: "navigation.read" },
    ],
  },
  {
    label: "Hàng hóa",
    items: [
      { href: "/admin/san-pham", label: "Sản phẩm", icon: Package, readCapability: "catalog.read" },
      { href: "/admin/dich-vu", label: "Dịch vụ gia công", icon: Settings2, readCapability: "services.read" },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { href: "/admin/tin-tuc", label: "Tin tức", icon: Newspaper, readCapability: "news.read" },
      { href: "/admin/media", label: "Thư viện Media", icon: ImageIcon, readCapability: "media.read" },
    ],
  },
  {
    label: "Tài khoản & quyền",
    items: [
      { href: "/admin/thanh-vien", label: "Tài khoản quản trị & quyền", icon: UsersRound, readCapability: "members.read" },
      { href: "/admin/audit", label: "Lịch sử thay đổi", icon: History, readCapability: "members.read", ownerOnly: true },
    ],
  },
];

const roleLabels: Record<string, string> = {
  owner: "Admin toàn quyền",
};

const CLOUDFLARE_ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

const subscribeToBrowserLocation = () => () => undefined;
const getStagingHostSnapshot = () => isStagingAdminHost(window.location.hostname);
const getServerStagingHostSnapshot = () => false;

// Fix1.1: theo doi href day du (pathname+search+hash) ma khong can useSearchParams
// (tranh missing-suspense khi prerender). Patch push/replace de bat Next App Router
// navigations (pushState khong tu fire popstate), + popstate/hashchange cho Back/Forward/hash.
// Patch cung gan mot thu tu noi bo cho moi history entry. Thu tu nay chi dung de
// tinh huong/delta cua popstate; cac state noi bo cua Next duoc giu nguyen.
export const ADMIN_HISTORY_POSITION_KEY = "__adminHistoryPosition";

function isHistoryStateRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readAdminHistoryPosition(state: unknown): number | null {
  if (!isHistoryStateRecord(state)) return null;
  const position = state[ADMIN_HISTORY_POSITION_KEY];
  return typeof position === "number" && Number.isSafeInteger(position) ? position : null;
}

function withAdminHistoryPosition(state: unknown, position: number): Record<string, unknown> {
  const next = isHistoryStateRecord(state) ? { ...state } : {};
  next[ADMIN_HISTORY_POSITION_KEY] = position;
  return next;
}

function nextAdminHistoryPosition(state: unknown): number {
  return (readAdminHistoryPosition(state) ?? 0) + 1;
}

function subscribeToFullHref(onChange: () => void) {
  const origPush = window.history.pushState;
  const origReplace = window.history.replaceState;
  if (readAdminHistoryPosition(window.history.state) === null) {
    origReplace.call(window.history, withAdminHistoryPosition(window.history.state, 0), "", window.location.href);
  }
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  function patchedPush(this: History, ...args: Parameters<History["pushState"]>) {
    const [state, unused, url] = args;
    const result = origPush.call(this, withAdminHistoryPosition(state, nextAdminHistoryPosition(this.state)), unused, url);
    // Next may write history during useInsertionEffect; notify after its commit.
    queueMicrotask(onChange);
    return result;
  }
  function patchedReplace(this: History, ...args: Parameters<History["replaceState"]>) {
    const [state, unused, url] = args;
    const currentPosition = readAdminHistoryPosition(this.state) ?? readAdminHistoryPosition(state) ?? 0;
    const result = origReplace.call(this, withAdminHistoryPosition(state, currentPosition), unused, url);
    queueMicrotask(onChange);
    return result;
  }
  window.history.pushState = patchedPush as typeof window.history.pushState;
  window.history.replaceState = patchedReplace as typeof window.history.replaceState;
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    if (window.history.pushState === patchedPush) window.history.pushState = origPush;
    if (window.history.replaceState === patchedReplace) window.history.replaceState = origReplace;
  };
}

const getFullHrefSnapshot = () => window.location.href;
const getFullHrefServerSnapshot = () => "";

export type AdminHistoryPopDirection = "back" | "forward";
export interface AdminHistoryPopTransition {
  direction: AdminHistoryPopDirection;
  delta: number;
}

export function getAdminHistoryPopTransition(currentState: unknown, destinationState: unknown): AdminHistoryPopTransition {
  const currentPosition = readAdminHistoryPosition(currentState);
  const destinationPosition = readAdminHistoryPosition(destinationState);
  const delta = currentPosition !== null && destinationPosition !== null && destinationPosition !== currentPosition
    ? destinationPosition - currentPosition
    : -1;
  return { direction: delta < 0 ? "back" : "forward", delta };
}

interface AdminHistoryRecovery {
  delta: number;
  direction: AdminHistoryPopDirection;
  showHistoryDialog: boolean;
}

export function AdminShell({ brandName, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const fullHref = useSyncExternalStore(subscribeToFullHref, getFullHrefSnapshot, getFullHrefServerSnapshot);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "blocked" | "unavailable">("loading");
  const [error, setError] = useState<AdminClientError | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);
  const isStagingHost = useSyncExternalStore(subscribeToBrowserLocation, getStagingHostSnapshot, getServerStagingHostSnapshot);
  const [pendingNav, setPendingNav] = useState<{ href: string } | { history: true } | { logout: true } | null>(null);
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);
  const [historyDiscardKey, setHistoryDiscardKey] = useState(0);
  const [unsavedSaving, setUnsavedSaving] = useState(false);
  const [unsavedRevision, setUnsavedRevision] = useState(0);
  const unsavedRegistrationsRef = useRef(new Map<string, AdminUnsavedState>());
  const unsavedIsDirtyRef = useRef<() => boolean>(() => false);
  const unsavedSavingRef = useRef(false);
  const currentHrefRef = useRef<string | null>(null);
  const currentHistoryStateRef = useRef<Record<string, unknown> | null>(null);
  const pendingRef = useRef<{ href: string } | { history: true } | { logout: true } | null>(null);
  const pendingHistoryRef = useRef<{ delta: number; direction: AdminHistoryPopDirection } | null>(null);
  const allowPopRef = useRef(false);
  const historyDiscardRef = useRef<string | null>(null);
  const historyRecoveryRef = useRef<AdminHistoryRecovery | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    const trigger = menuTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar?.querySelector<HTMLButtonElement>("button")?.focus();
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    function onMenuKeyDown(event: KeyboardEvent) {
      // An unsaved-changes confirmation owns focus while it is open.
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
      } else if (event.key === "Tab" && sidebar) {
        const links = Array.from(sidebar.querySelectorAll<HTMLElement>('button, a[href]')).filter((el) => el.getClientRects().length > 0);
        const first = links[0];
        const last = links.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", onMenuKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", onMenuKeyDown);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [mobileOpen]);

  useLayoutEffect(() => {
    currentHrefRef.current = window.location.href;
    currentHistoryStateRef.current = window.history.state;
  }, [pathname, fullHref]);

  useEffect(() => {
    pendingRef.current = pendingNav;
  }, [pendingNav]);

  useEffect(() => {
    setNavigatingHref(null);
  }, [pathname]);

  const updateUnsavedState = useCallback(() => {
    unsavedIsDirtyRef.current = () => [...unsavedRegistrationsRef.current.values()].some((registration) => registration.isDirty());
    const saving = [...unsavedRegistrationsRef.current.values()].some((registration) => registration.saving);
    unsavedSavingRef.current = saving;
    setUnsavedSaving(saving);
    setUnsavedRevision((value) => value + 1);
  }, []);

  const registerUnsaved = useCallback((id: string, next: AdminUnsavedState) => {
    unsavedRegistrationsRef.current.set(id, next);
    updateUnsavedState();
  }, [updateUnsavedState]);

  const unregisterUnsaved = useCallback((id: string) => {
    unsavedRegistrationsRef.current.delete(id);
    updateUnsavedState();
  }, [updateUnsavedState]);

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
    const nextPending = { href: `${url.pathname}${url.search}${url.hash}` } as const;
    pendingRef.current = nextPending;
    setPendingNav(nextPending);
  }

  function handleLogoutClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    let dirty = false;
    try {
      dirty = unsavedIsDirtyRef.current();
    } catch {
      dirty = false;
    }
    const saving = unsavedSavingRef.current;
    if (!shouldBlockUnsavedNavigation({ isDirty: dirty, saving, hasPending: pendingRef.current !== null })) return;

    event.preventDefault();
    if (pendingRef.current) return;
    const nextPending = { logout: true } as const;
    pendingRef.current = nextPending;
    setPendingNav(nextPending);
  }

  useLayoutEffect(() => {
    function onPopState(event: PopStateEvent) {
      const recovery = historyRecoveryRef.current;
      if (recovery) {
        // Capture phase runs before Next Router and before the full-href subscriber.
        // Consume only the compensating pop used to restore the source entry.
        event.stopImmediatePropagation();
        historyRecoveryRef.current = null;
        if (recovery.showHistoryDialog) {
          const pendingHistory = { delta: recovery.delta, direction: recovery.direction } as const;
          pendingHistoryRef.current = pendingHistory;
          const nextPending = { history: true } as const;
          pendingRef.current = nextPending;
          setPendingNav((current) => current ?? nextPending);
        }
        return;
      }
      if (allowPopRef.current) {
        allowPopRef.current = false;
        const sourcePathname = historyDiscardRef.current;
        historyDiscardRef.current = null;
        if (sourcePathname === window.location.pathname) setHistoryDiscardKey((value) => value + 1);
        return;
      }

      let dirty = false;
      try {
        dirty = unsavedIsDirtyRef.current();
      } catch {
        dirty = false;
      }
      const hasPending = pendingRef.current !== null;
      const saving = unsavedSavingRef.current;
      const domDialogOpen = typeof document !== "undefined" && document.querySelector('[role="dialog"]') !== null;
      if (!shouldBlockUnsavedNavigation({ isDirty: dirty, saving, hasPending: false }) && !hasPending && !domDialogOpen) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const snapshotHref = currentHrefRef.current ?? window.location.href;
      const snapshotState = currentHistoryStateRef.current ?? window.history.state;
      const transition = getAdminHistoryPopTransition(snapshotState, window.history.state);
      historyRecoveryRef.current = {
        delta: transition.delta,
        direction: transition.direction,
        showHistoryDialog: !hasPending && !domDialogOpen,
      };
      pendingHistoryRef.current = { delta: transition.delta, direction: transition.direction };
      try {
        window.history.go(-transition.delta);
      } catch {
        historyRecoveryRef.current = null;
        pendingHistoryRef.current = null;
        historyDiscardRef.current = null;
        try {
          window.history.replaceState(snapshotState, "", snapshotHref);
        } catch {
          // Keep the dialog state if browser history restoration is unavailable.
        }
      }
    }
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, []);

  function dismissPendingNav() {
    pendingHistoryRef.current = null;
    pendingRef.current = null;
    setPendingNav(null);
  }

  function confirmPendingNav() {
    const pending = pendingNav;
    setPendingNav(null);
    pendingRef.current = null;
    if (!pending) return;
    setMobileOpen(false);
    if ("logout" in pending) {
      pendingHistoryRef.current = null;
      window.location.assign(new URL(CLOUDFLARE_ACCESS_LOGOUT_PATH, window.location.origin).toString());
      return;
    }
    if ("history" in pending) {
      const pendingHistory = pendingHistoryRef.current;
      pendingHistoryRef.current = null;
      historyDiscardRef.current = window.location.pathname;
      allowPopRef.current = true;
      window.history.go(pendingHistory?.delta ?? -1);
      return;
    }
    pendingHistoryRef.current = null;
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
    return <AdminAccessScreen brandName={brandName} status={status === "blocked" ? "blocked" : "unavailable"} error={error} onRetry={() => setAttempt((value) => value + 1)} />;
  }

  const visibleNavGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canManage(session.role, item.readCapability) && (!item.ownerOnly || session.role === "owner")) }))
    .filter((group) => group.items.length > 0);
  const currentNavItem = navGroups.flatMap((group) => group.items).find((item) => isAdminNavItemActive(pathname, item.href));

  return (
    <SessionContext.Provider value={{ session }}>
      <AdminUnsavedContext.Provider
        value={{ isDirty: () => unsavedIsDirtyRef.current(), revision: unsavedRevision, saving: unsavedSaving, register: registerUnsaved, unregister: unregisterUnsaved }}
      >
      <AdminToastProvider>
        <div className="admin-app">
          {navigatingHref ? (
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: "linear-gradient(90deg, #4d770f 0%, #b6d27c 50%, #4d770f 100%)",
                zIndex: 9999,
                boxShadow: "0 0 6px rgba(182, 210, 124, 0.8)",
              }}
            />
          ) : null}
        <div className="admin-shell">
          {mobileOpen ? <button aria-label="Đóng điều hướng" className="admin-nav-backdrop" data-testid="admin-nav-backdrop" onClick={() => setMobileOpen(false)} tabIndex={-1} type="button" /> : null}
          <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`} aria-label="Điều hướng admin" id="admin-navigation" onClickCapture={handleSidebarClickCapture} ref={sidebarRef}>
            <button aria-label="Đóng điều hướng" className="admin-nav-close" data-testid="button-close-admin-nav" onClick={() => setMobileOpen(false)} type="button"><X aria-hidden="true" size={20} /></button>
            <Link className="admin-brand" href="/admin" onClick={() => setMobileOpen(false)} prefetch={false}>
              <span className="admin-brand-mark" aria-hidden="true">{`${brandName.slice(0, 1).toUpperCase()}.`}</span>
              <span className="admin-brand-copy"><strong>{brandName}</strong><span>Khu vực vận hành</span></span>
            </Link>
            <nav aria-label="Các khu vực quản trị" className="admin-nav">
              {visibleNavGroups.map((group) => (
                <div className="admin-nav-group" key={group.label}>
                  <p className="admin-nav-label">{group.label}</p>
                  {group.items.map(({ href, icon: Icon, label }) => {
                    const isActive = isAdminNavItemActive(pathname, href);
                    const isPending = navigatingHref === href;
                    return <Link
                      aria-current={isActive ? "page" : undefined}
                      aria-busy={isPending ? "true" : undefined}
                      className="admin-nav-link"
                      data-pending={isPending ? "true" : undefined}
                      data-testid={`link-admin-${label}`}
                      href={href}
                      key={href}
                      onClick={() => {
                        setMobileOpen(false);
                        if (href !== pathname) {
                          setNavigatingHref(href);
                        }
                      }}
                      onMouseEnter={() => {
                        try {
                          router.prefetch(href);
                        } catch {}
                      }}
                      onFocus={() => {
                        try {
                          router.prefetch(href);
                        } catch {}
                      }}
                      prefetch={false}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                      {isPending ? (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: "#b6d27c",
                            marginLeft: "auto",
                          }}
                        />
                      ) : null}
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
          <main className="admin-main" inert={mobileOpen}>
            <header className="admin-topbar">
              <div className="admin-crumb">
                <button
                  aria-expanded={mobileOpen}
                  aria-controls="admin-navigation"
                  aria-label={mobileOpen ? "Đóng điều hướng" : "Mở điều hướng"}
                  className="admin-mobile-menu"
                  data-testid="button-toggle-admin-nav"
                  onClick={() => setMobileOpen((value) => !value)}
                  ref={menuTriggerRef}
                  type="button"
                >
                  {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                </button>
                <span>{brandName} / <strong>{currentNavItem?.label ?? "Quản trị"}</strong></span>
              </div>
              <div className="admin-topbar-meta">
                <Link className="admin-storefront-link" href="/" rel="noreferrer" target="_blank">
                  Xem trang web
                  <ExternalLink aria-hidden="true" size={14} />
                </Link>
                {isStagingHost ? <span className="admin-environment-badge" data-testid="badge-admin-environment">BẢN THỬ</span> : null}
                <span className="admin-live-dot">Kết nối trực tiếp</span>
                <span className="admin-role-label">Vai trò: {roleLabels[session.role] ?? "Tài khoản được cấp quyền"}</span>
                <span aria-label={`Tài khoản ${session.email ?? session.subject}`} className="admin-avatar" title={session.email ?? session.subject}>{getInitials(session.email ?? session.subject)}</span>
                <a
                  className="admin-storefront-link"
                  data-testid="link-admin-logout"
                  href={CLOUDFLARE_ACCESS_LOGOUT_PATH}
                  onClick={handleLogoutClick}
                >
                  Đăng xuất
                  <LogOut aria-hidden="true" size={14} />
                </a>
              </div>
            </header>
            <Fragment key={historyDiscardKey}>{children}</Fragment>
          </main>
        </div>
        </div>
        {pendingNav ? (
          <AdminConfirmDialog
            cancelLabel="Ở lại"
            confirmLabel={"logout" in pendingNav ? "Đăng xuất" : "Bỏ thay đổi"}
            message={"logout" in pendingNav
              ? "Còn thay đổi chưa lưu. Đăng xuất lúc này sẽ làm mất các thay đổi đó. Vẫn đăng xuất?"
              : "Còn thay đổi chưa lưu. Rời trang sẽ mất thay đổi. Vẫn rời trang?"}
            onConfirm={confirmPendingNav}
            onDismiss={dismissPendingNav}
            title={"logout" in pendingNav ? "Đăng xuất khỏi admin?" : "Bỏ thay đổi chưa lưu?"}
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

function AdminAccessScreen({ brandName, status, error, onRetry }: { brandName: string; status: "blocked" | "unavailable"; error: AdminClientError | null; onRetry: () => void }) {
  const isBlocked = status === "blocked";
  const showLoginLink = isBlocked || error?.code === "NETWORK_ERROR";
  return (
    <div className="admin-app">
      <div className="admin-access-page">
        <section className="admin-access-card" aria-labelledby="admin-access-title">
          <Link className="admin-brand" href="/admin">
            <span className="admin-brand-mark" aria-hidden="true">{`${brandName.slice(0, 1).toUpperCase()}.`}</span>
            <span className="admin-brand-copy"><strong>{brandName}</strong><span>Khu vực vận hành</span></span>
          </Link>
          <h1 id="admin-access-title">{isBlocked ? "Khu vực này cần Cloudflare Access" : "Admin chưa sẵn sàng"}</h1>
          <p>
            {isBlocked
              ? "Hãy chọn nút “Đăng nhập Cloudflare Access” bên dưới, hoàn tất xác minh, rồi quay lại trang này. Đường xem thử hoặc trang web không có phiên truy cập nội bộ."
              : error?.code === "NETWORK_ERROR"
                ? "Nếu bạn chưa đăng nhập, hãy chọn nút “Đăng nhập Cloudflare Access”. Nếu đã đăng nhập, hãy thử kiểm tra lại phiên."
                : "Không thể kết nối tới phiên admin lúc này. Kiểm tra lại kết nối mạng và thử lại."}
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
