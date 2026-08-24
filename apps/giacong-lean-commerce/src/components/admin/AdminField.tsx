"use client";

// Labeled form field: one wrapper keeps label, control, hint and error text
// consistent across every admin form. Pass aria-describedby={`${id}-error`} on
// the control itself when wiring server-side field errors.

import type { ReactNode } from "react";

interface AdminFieldProps {
  children: ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  optional?: boolean;
}

export function AdminField({ children, error, hint, id, label, optional = false }: AdminFieldProps) {
  return (
    <div className={`admin-field${error ? " has-error" : ""}`}>
      <label className="admin-field-label" htmlFor={id}>
        {label}
        {optional ? <span className="admin-field-optional"> (tùy chọn)</span> : null}
      </label>
      {children}
      {hint ? <p className="admin-field-hint" id={`${id}-hint`}>{hint}</p> : null}
      {error ? <p aria-live="polite" className="admin-field-error" id={`${id}-error`} role="alert">{error}</p> : null}
    </div>
  );
}
