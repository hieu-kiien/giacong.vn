"use client";

// Toast notifications for admin mutations. Success/error feedback renders an
// aria-live stack that auto-dismisses; native browser dialog boxes are forbidden.

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface AdminToast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

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

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((kind: AdminToast["kind"], message: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, kind, message }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="admin-toast-stack">
        {toasts.map(({ id, kind, message }) => (
          <div className={`admin-toast admin-toast-${kind}`} key={id} role="status">
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
