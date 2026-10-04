"use client";

import { Building2, ChevronDown, ClipboardList, ExternalLink, History, Image as ImageIcon, LayoutDashboard, LayoutTemplate, LogOut, Menu, Newspaper, Package, PanelTop, PenLine, Settings2, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { AdminClientError, fetchAdmin, getInitials, type AdminSession } from "@/lib/admin-client";
import { isAdminNavItemActive, isStagingAdminHost } from "@/lib/admin-navigation";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { AdminUnsavedContext, type AdminUnsavedState, shouldBlockUnsavedNavigation, shouldBypassUnsavedClick } from "@/components/admin/AdminUnsavedGuard";
import { AdminToastProvider } from "@/components/admin/AdminToast";
import { canManage, type AdminCapability } from "@/lib/admin-permissions";
import { customerAuthClient } from "@/lib/customer-auth-client";

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
  /** Reachable by URL and used for the page title, but not listed in the sidebar. */
  hidden?: boolean;
  ownerOnly?: boolean;
}

interface AdminNavGroup {
  id: "operations" | "content" | "website" | "system";
  displayTitle: string;
  items: ReadonlyArray<AdminNavItem>;
}

const navGroups: ReadonlyArray<AdminNavGroup> = [
  {
    id: "operations",
    displayTitle: "BÁN HÀNG",
    items: [
      { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, readCapability: "dashboard.read" },
      { href: "/admin/yeu-cau", label: "Yêu cầu mua hàng", icon: ClipboardList, readCapability: "leads.read" },
      { href: "/admin/khach-hang", label: "Khách hàng", icon: Building2, readCapability: "crm.read" },
    ],
  },
  {
    id: "content",
    displayTitle: "NỘI DUNG",
    items: [
      { href: "/admin/san-pham", label: "Sản phẩm", icon: Package, readCapability: "catalog.read" },
      { href: "/admin/dich-vu", label: "Dịch vụ gia công", icon: Settings2, readCapability: "services.read" },
      { href: "/admin/tin-tuc", label: "Tin tức", icon: Newspaper, readCapability: "news.read" },
      { href: "/admin/media", label: "Thư viện ảnh", icon: ImageIcon, readCapability: "media.read" },
    ],
  },
  {
    id: "website",
    displayTitle: "WEBSITE",
    items: [
      { href: "/admin/noi-dung", label: "Nội dung & thương hiệu", icon: PenLine, readCapability: "content.read" },
      { href: "/admin/thiet-ke", label: "Thiết kế trang", icon: LayoutTemplate, readCapability: "pages.read", hidden: true },
      { href: "/admin/dieu-huong", label: "Menu", icon: PanelTop, readCapability: "navigation.read" },
    ],
  },
  {
    id: "system",
    displayTitle: "HỆ THỐNG",
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

// The admin host (admin.example / admin-staging.example) serves the admin only,
// so "Xem trang web" must point at the matching public host.
function resolveStorefrontHref(location: Pick<Location, "hostname" | "port" | "protocol">): string {
  const publicHost = location.hostname.replace(/^admin(-staging)?\./, (_match, staging: string | undefined) => (staging ? "staging." : ""));
  if (publicHost === location.hostname) return "/";
  return `${location.protocol}//${publicHost}${location.port ? `:${location.port}` : ""}/`;
}
const getStorefrontHrefSnapshot = () => resolveStorefrontHref(window.location);
const getServerStorefrontHrefSnapshot = () => "/";

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const sidebarRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);
  const isStagingHost = useSyncExternalStore(subscribeToBrowserLocation, getStagingHostSnapshot, getServerStagingHostSnapshot);
  const storefrontHref = useSyncExternalStore(subscribeToBrowserLocation, getStorefrontHrefSnapshot, getServerStorefrontHrefSnapshot);
  const [pendingNav, setPendingNav] = useState<{ href: string } | { history: true } | { logout: true } | null>(null);
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setNavigatingHref(null);
    setUserMenuOpen(false);
  }
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

  useEffect(() => {
    if (!userMenuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  useLayoutEffect(() => {
    currentHrefRef.current = window.location.href;
    currentHistoryStateRef.current = window.history.state;
  }, [pathname, fullHref]);

  useEffect(() => {
    pendingRef.current = pendingNav;
  }, [pendingNav]);

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

  async function signOutAccount() {
    setLogoutError("");
    try {
      const result = await customerAuthClient.signOut();
      if (result.error) throw result.error;
      window.location.assign(new URL("/tai-khoan/dang-nhap/?next=admin", window.location.origin).toString());
    } catch {
      setLogoutError("Chưa thể đăng xuất. Hãy thử lại.");
      setUserMenuOpen(true);
    }
  }

  function handleLogoutClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    if (session?.authMethod === "account") {
      event.preventDefault();
      let dirty = false;
      try {
        dirty = unsavedIsDirtyRef.current();
      } catch {
        dirty = false;
      }
      if (shouldBlockUnsavedNavigation({ isDirty: dirty, saving: unsavedSavingRef.current, hasPending: pendingRef.current !== null })) {
        if (pendingRef.current) return;
        const nextPending = { logout: true } as const;
        pendingRef.current = nextPending;
        setPendingNav(nextPending);
        return;
      }
      void signOutAccount();
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

  async function confirmPendingNav() {
    const pending = pendingNav;
    setPendingNav(null);
    pendingRef.current = null;
    if (!pending) return;
    setMobileOpen(false);
    if ("logout" in pending) {
      pendingHistoryRef.current = null;
      if (session?.authMethod === "account") {
        await signOutAccount();
        return;
      }
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
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden && canManage(session.role, item.readCapability) && (!item.ownerOnly || session.role === "owner")) }))
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
                <div className="admin-nav-group" key={group.id}>
                  <p className="admin-nav-label">{group.displayTitle}</p>
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
                <Link className="admin-storefront-link" href={storefrontHref} rel="noreferrer" target="_blank">
                  Xem trang web
                  <ExternalLink aria-hidden="true" size={14} />
                </Link>
                {isStagingHost ? <span className="admin-environment-badge" data-testid="badge-admin-environment">BẢN THỬ</span> : null}
                <div
                  className="admin-user-menu"
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && userMenuOpen) {
                      event.preventDefault();
                      setUserMenuOpen(false);
                      userMenuTriggerRef.current?.focus();
                    }
                  }}
                  ref={userMenuRef}
                >
                  <button
                    aria-expanded={userMenuOpen}
                    aria-controls="admin-account-popover"
                    aria-label={`${session.email ?? session.subject} · Menu tài khoản quản trị`}
                    className="admin-user-trigger"
                    id="admin-account-trigger"
                    onClick={() => setUserMenuOpen((value) => !value)}
                    ref={userMenuTriggerRef}
                    type="button"
                  >
                    <span
                      aria-label={`Tài khoản ${session.email ?? session.subject}`}
                      className="admin-avatar"
                      title={session.email ?? session.subject}
                    >
                      {getInitials(session.email ?? session.subject)}
                    </span>
                    <span className="admin-user-trigger-name">
                      {session.email ?? session.subject}
                    </span>
                    <ChevronDown aria-hidden="true" className={`admin-user-chevron${userMenuOpen ? " is-open" : ""}`} size={14} />
                  </button>
                  <div
                    aria-hidden={!userMenuOpen}
                    className={`admin-user-popover${userMenuOpen ? " is-open" : ""}`}
                    id="admin-account-popover"
                    inert={!userMenuOpen}
                  >
                    <div className="admin-user-popover-header">
                      <div className="admin-user-popover-identity">
                        <strong className="admin-user-popover-name">
                          {session.email ?? session.subject}
                        </strong>
                      </div>
                      <span className="admin-live-dot">Kết nối trực tiếp</span>
                      <span className="admin-role-label">
                        Vai trò: {roleLabels[session.role] ?? "Tài khoản được cấp quyền"}
                      </span>
                    </div>
                    <div className="admin-user-popover-divider" />
                    <div className="admin-user-popover-actions">
                      {logoutError ? <p className="admin-access-detail" role="alert">{logoutError}</p> : null}
                      <a
                        className="admin-user-popover-logout"
                        data-testid="link-admin-logout"
                        href={session.authMethod === "account" ? "/tai-khoan/dang-nhap/?next=admin" : CLOUDFLARE_ACCESS_LOGOUT_PATH}
                        onClick={(e) => {
                          setUserMenuOpen(false);
                          handleLogoutClick(e);
                        }}
                      >
                        <span>Đăng xuất</span>
                        <LogOut aria-hidden="true" size={14} />
                      </a>
                    </div>
                  </div>
                </div>
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
        <div className="admin-access-card admin-access-card--auth">
          <span className="admin-skeleton admin-access-skeleton admin-access-skeleton--brand" />
          <span className="admin-skeleton admin-access-skeleton admin-access-skeleton--title" />
          <span className="admin-skeleton admin-access-skeleton admin-access-skeleton--line-wide" />
          <span className="admin-skeleton admin-access-skeleton admin-access-skeleton--line-short" />
        </div>
      </div>
    </div>
  );
}

function AdminAccessScreen({ brandName, status, error, onRetry }: { brandName: string; status: "blocked" | "unavailable"; error: AdminClientError | null; onRetry: () => void }) {
  const router = useRouter();
  const [logoutError, setLogoutError] = useState("");
  const isBlocked = status === "blocked";
  const isAccountMembershipDenied = isBlocked && error?.status === 403 && error.code === "ADMIN_MEMBERSHIP_REQUIRED";
  const isAccessMembershipDenied = isBlocked && error?.status === 403 && error.code === "FORBIDDEN";
  const isNetworkError = error?.code === "NETWORK_ERROR";
  const showLoginLink = isBlocked || isNetworkError;
  const title = isAccountMembershipDenied || isAccessMembershipDenied
    ? "Tài khoản chưa được cấp quyền admin"
    : isBlocked
      ? "Đăng nhập khu vực quản trị"
      : isNetworkError
        ? "Chưa thể xác minh phiên đăng nhập"
        : "Khu vực quản trị chưa sẵn sàng";
  const description = isAccountMembershipDenied
    ? "Tài khoản website này chưa được cấp quyền admin. Hãy đăng xuất và dùng tài khoản đã được người quản trị cấp quyền."
    : isAccessMembershipDenied
      ? "Danh tính Cloudflare Access hiện tại chưa được cấp quyền quản trị. Hãy đăng xuất hoặc dùng tài khoản admin đã được cấp quyền."
      : isBlocked
        ? "Dùng tài khoản website đã được cấp quyền admin để tiếp tục vào khu vực vận hành nội bộ."
        : isNetworkError
          ? "Chưa thể kiểm tra phiên hiện tại. Bạn có thể tiếp tục đăng nhập hoặc thử kiểm tra lại kết nối."
          : "Không thể kết nối tới khu vực quản trị lúc này. Hãy kiểm tra kết nối và thử lại.";

  async function signOutWebsiteAccount() {
    setLogoutError("");
    try {
      const result = await customerAuthClient.signOut();
      if (result.error) throw result.error;
      window.location.assign(new URL("/tai-khoan/dang-nhap/?next=admin", window.location.origin).toString());
    } catch {
      setLogoutError("Chưa thể đăng xuất. Hãy thử lại.");
    }
  }

  return (
    <div className="admin-app">
      <div className="admin-access-page" aria-live="polite">
        <section className="admin-access-card admin-access-card--auth" aria-labelledby="admin-access-title">
          <Link className="admin-brand" href="/admin">
            <span className="admin-brand-mark" aria-hidden="true">{`${brandName.slice(0, 1).toUpperCase()}.`}</span>
            <span className="admin-brand-copy"><strong>{brandName}</strong><span>Khu vực vận hành</span></span>
          </Link>
          <div className="admin-kicker">TRUY CẬP NỘI BỘ</div>
          <h1 className="admin-access-title" id="admin-access-title">{title}</h1>
          <p>{description}</p>
          {error ? (
            <details className="admin-access-detail">
              <summary className="admin-access-detail__summary">
                Chi tiết kỹ thuật
              </summary>
              <div className="admin-access-detail__body">
                {error.code ? `${error.code} · ` : ""}{error.message}
              </div>
            </details>
          ) : null}
          <div className="admin-editor-actions">
            {isAccessMembershipDenied ? (
              <a
                className="admin-button admin-button-quiet"
                data-testid="link-admin-access-logout"
                href={CLOUDFLARE_ACCESS_LOGOUT_PATH}
              >
                Đăng xuất tài khoản hiện tại
                <LogOut aria-hidden="true" size={14} />
              </a>
            ) : null}
            {isAccountMembershipDenied ? (
              <button
                className="admin-button admin-button-quiet"
                data-testid="button-admin-account-logout"
                onClick={() => void signOutWebsiteAccount()}
                type="button"
              >
                Đăng xuất tài khoản hiện tại
                <LogOut aria-hidden="true" size={14} />
              </button>
            ) : null}
            {showLoginLink ? (
              <Link
                className="admin-button admin-button-primary"
                data-testid="link-admin-account-login"
                href="/tai-khoan/dang-nhap/?next=admin"
              >
                Đăng nhập tài khoản website
              </Link>
            ) : null}
            {logoutError ? <p className="admin-access-detail" role="alert">{logoutError}</p> : null}
            <button className="admin-button admin-button-quiet" data-testid="button-retry-admin-session" onClick={onRetry} type="button">
              Kiểm tra lại phiên
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}