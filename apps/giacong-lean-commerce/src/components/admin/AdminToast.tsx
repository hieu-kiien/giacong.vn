"use client";

// Toast notifications for admin mutations use a status role for routine feedback
// and an alert role for failures; native browser dialog boxes are forbidden.

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appendAdminToast, type AdminToastItem } from "@/lib/admin-toast-state";

export type AdminToast = AdminToastItem;

interface AdminToastContextValue {
  showToast: (kind: AdminToast["kind"], message: string) => void;
}

const AdminToastContext = createContext<AdminToastContextValue>({ showToast: () => undefined });

const AUTO_DISMISS_MS = 4_500;

export function useAdminToast(): AdminToastContextValue {
  return useContext(AdminToastContext);
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const nextId = useRef(1);
  const timeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timeout = timeouts.current.get(id);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      timeouts.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((kind: AdminToast["kind"], message: string) => {
    const id = nextId.current++;
    setToasts((current) => appendAdminToast(current, { id, kind, message }));
    if (kind !== "error") {
      const timeout = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timeouts.current.set(id, timeout);
    }
  }, [dismiss]);

  useEffect(() => () => {
    for (const timeout of timeouts.current.values()) clearTimeout(timeout);
    timeouts.current.clear();
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div className="admin-toast-stack">
        {toasts.map(({ id, kind, message }) => (
          <div className={`admin-toast admin-toast-${kind}`} key={id} role={kind === "error" ? "alert" : "status"}>
            <span aria-hidden="true" className="admin-toast-icon">
              {kind === "success" ? <CheckCircle2 size={16} /> : kind === "error" ? <AlertTriangle size={16} /> : <Info size={16} />}
            </span>
            <span className="admin-toast-message">{message}</span>
            <button aria-label="Đóng thông báo" className="admin-toast-close" onClick={() => dismiss(id)} type="button">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}
