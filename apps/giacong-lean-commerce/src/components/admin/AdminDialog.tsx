"use client";

// Modal + confirm dialog. Destructive actions (delete, archive, publish) must go
// through AdminConfirmDialog so the audit trail and the keyboard/AT behaviour stay
// consistent; native browser dialog boxes are forbidden.

import { X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface AdminModalProps {
  children: ReactNode;
  describedBy?: string;
  labelledBy: string;
  onClose: () => void;
  title: string;
  width?: "narrow" | "wide";
}

export function AdminModal({ children, describedBy, labelledBy, onClose, title, width = "narrow" }: AdminModalProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!mounted) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const surface = surfaceRef.current;

    function getFocusableElements(): HTMLElement[] {
      return surface ? Array.from(surface.querySelectorAll<HTMLElement>(focusableSelector)) : [];
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !surface) return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        surface.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === surface)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const firstFocusable = getFocusableElements()[0];
    (firstFocusable ?? surface)?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [mounted]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="admin-modal-overlay admin-app" onClick={onClose}>
      <div
        aria-describedby={describedBy}
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
    </div>,
    document.body,
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
    <AdminModal describedBy="admin-confirm-message" labelledBy="admin-confirm-title" onClose={onDismiss} title={title} width="narrow">
      <p className="admin-confirm-message" id="admin-confirm-message">{message}</p>
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
