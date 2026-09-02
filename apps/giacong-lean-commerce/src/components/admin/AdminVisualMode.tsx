"use client";

import { CircleAlert, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { AdminClientError, fetchAdmin, type AdminSession } from "@/lib/admin-client";
import { isAdminSessionReady } from "@/lib/admin-visual-contract";

import { AdminVisualEditor } from "./AdminVisualEditor";

export type AdminVisualStatus = "loading" | "ready" | "blocked" | "unavailable";

export interface AdminVisualContextValue {
  session: AdminSession | null;
  status: AdminVisualStatus;
}

const AdminVisualContext = createContext<AdminVisualContextValue>({ session: null, status: "unavailable" });

export function useAdminVisualContext(): AdminVisualContextValue {
  return useContext(AdminVisualContext);
}

interface AdminVisualModeProps {
  children: ReactNode;
}

export function AdminVisualMode({ children }: AdminVisualModeProps) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<AdminVisualStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void fetchAdmin<AdminSession>("/api/admin/session", controller.signal)
      .then((data) => {
        if (!isAdminSessionReady(data)) {
          setStatus("blocked");
          return;
        }
        setSession(data);
        setStatus("ready");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (reason instanceof AdminClientError && [401, 403, 404].includes(reason.status)) {
          setStatus("blocked");
          return;
        }
        setStatus("unavailable");
      });

    return () => controller.abort();
  }, [attempt]);

  return (
    <AdminVisualContext.Provider value={{ session, status }}>
      <>
        <AdminVisualStatusBar
          onRetry={() => {
            setSession(null);
            setStatus("loading");
            setAttempt((value) => value + 1);
          }}
          role={session?.role}
          status={status}
        />
        {status === "ready" && session ? <AdminVisualEditor session={session} /> : null}
        {children}
      </>
    </AdminVisualContext.Provider>
  );
}

function AdminVisualStatusBar({
  onRetry,
  role,
  status,
}: {
  onRetry: () => void;
  role?: string;
  status: AdminVisualStatus;
}) {
  const copy = getStatusCopy(status, role);

  return (
    <div
      aria-label="Trạng thái storefront quản trị"
      aria-live="polite"
      className={`admin-visual-mode-banner admin-visual-mode-banner--${status}`}
      data-testid={`admin-visual-${status}`}
      role={status === "ready" ? "region" : "status"}
    >
      <div className="admin-visual-mode-copy">
        <StatusIcon status={status} />
        <span>
          <strong>{copy.title}</strong>
          <small>{copy.detail}</small>
        </span>
      </div>
      {status === "ready" ? (
        <Link className="admin-visual-mode-link" href="/admin">
          Trung tâm quản trị
          <ExternalLink aria-hidden="true" size={14} />
        </Link>
      ) : status === "loading" ? (
        <span aria-hidden="true" className="admin-visual-mode-pending">Đang xác nhận…</span>
      ) : (
        <button className="admin-visual-mode-retry" onClick={onRetry} type="button">
          <RefreshCw aria-hidden="true" size={14} />
          Thử lại
        </button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: AdminVisualStatus }) {
  if (status === "ready") return <ShieldCheck aria-hidden="true" size={18} />;
  if (status === "loading") return <LoaderCircle aria-hidden="true" className="admin-visual-mode-spinner" size={18} />;
  return <CircleAlert aria-hidden="true" size={18} />;
}

function getStatusCopy(status: AdminVisualStatus, role?: string) {
  if (status === "loading") {
    return {
      detail: "Đang xác nhận bạn có thể xem storefront ở chế độ quản trị.",
      title: "Đang kiểm tra quyền quản trị",
    };
  }
  if (status === "blocked") {
    return {
      detail: "Cloudflare Access chưa xác nhận phiên quản trị. Nội dung vẫn chỉ ở chế độ xem.",
      title: "Chưa được cấp quyền quản trị",
    };
  }
  if (status === "unavailable") {
    return {
      detail: "Không thể kiểm tra phiên quản trị. Nội dung vẫn chỉ ở chế độ xem.",
      title: "Không thể kiểm tra phiên quản trị",
    };
  }
  return {
    detail: `Đang xem storefront với vai trò ${getRoleLabel(role)}. Có thể chỉnh sửa vùng được hỗ trợ.`,
    title: "Chế độ quản trị",
  };
}

function getRoleLabel(role?: string): string {
  const labels: Record<string, string> = {
    catalog_manager: "quản lý catalog",
    content_manager: "quản lý nội dung",
    owner: "chủ sở hữu",
    sales_manager: "quản lý yêu cầu",
    viewer: "người xem",
  };
  return labels[role ?? ""] ?? "tài khoản được cấp quyền";
}
