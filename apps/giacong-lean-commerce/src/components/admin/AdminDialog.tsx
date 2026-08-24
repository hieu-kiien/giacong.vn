"use client";

// Modal + confirm dialog. Destructive actions (delete, archive, publish) must go
// through AdminConfirmDialog so the audit trail and the keyboard/AT behaviour stay
// consistent; native browser dialog boxes are forbidden.

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface AdminModalProps {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
  title: string;
  width?: "narrow" | "wide";
}

export function AdminModal({ children, labelledBy, onClose, title, width = "narrow" }: AdminModalProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    surfaceRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={`admin-modal admin-modal-${width}`}
        onClick={(event) => event.stopPropagation()}
        ref={surfaceRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="admin-modal-header">
          <h2 id={labelledBy}>{title}</h2>
          <button aria-label="Đóng" className="admin-toast-close" onClick={onClose} type="button">
            <X size={14} />
          </button>
        </header>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );
}

export interface AdminConfirmDialogProps {
  cancelLabel?: string;
  confirmKind?: "danger" | "primary";
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  onDismiss: () => void;
  title: string;
}

export function AdminConfirmDialog({
  cancelLabel = "Hủy",
  confirmKind = "danger",
  confirmLabel,
  message,
  onConfirm,
  onDismiss,
  title,
}: AdminConfirmDialogProps) {
  return (
    <AdminModal labelledBy="admin-confirm-title" onClose={onDismiss} title={title} width="narrow">
      <p className="admin-confirm-message">{message}</p>
      <footer className="admin-modal-footer">
        <button className="admin-button admin-button-quiet" onClick={onDismiss} type="button">{cancelLabel}</button>
        <button
          className={`admin-button ${confirmKind === "danger" ? "admin-button-danger" : "admin-button-primary"}`}
          data-testid="button-confirm-dialog"
          onClick={() => {
            onConfirm();
            onDismiss();
          }}
          type="button"
        >
          {confirmLabel}
        </button>
      </footer>
    </AdminModal>
  );
}
