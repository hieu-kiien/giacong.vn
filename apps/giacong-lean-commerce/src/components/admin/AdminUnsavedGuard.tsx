"use client";

import { createContext, useContext, useEffect, useId } from "react";

export interface AdminUnsavedState {
  isDirty: () => boolean;
  saving: boolean;
}

export interface AdminUnsavedContextValue extends AdminUnsavedState {
  revision: number;
  register: (id: string, next: AdminUnsavedState) => void;
  unregister: (id: string) => void;
}

export const AdminUnsavedContext = createContext<AdminUnsavedContextValue>({
  isDirty: () => false,
  saving: false,
  revision: 0,
  register: () => undefined,
  unregister: () => undefined,
});

export function useAdminUnsaved(): AdminUnsavedContextValue {
  return useContext(AdminUnsavedContext);
}

export function useRegisterAdminUnsaved(isDirty: () => boolean, saving: boolean): void {
  const { register, unregister } = useContext(AdminUnsavedContext);
  const id = useId();
  useEffect(() => {
    register(id, { isDirty, saving });
    return () => unregister(id);
  }, [id, isDirty, saving, register, unregister]);
  useEffect(() => {
    function preventDraftLoss(event: BeforeUnloadEvent) {
      if (isDirty() || saving) event.preventDefault();
    }
    window.addEventListener("beforeunload", preventDraftLoss);
    return () => window.removeEventListener("beforeunload", preventDraftLoss);
  }, [isDirty, saving]);
}

export interface UnsavedClickSignal {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  href: string | null;
  metaKey: boolean;
  shiftKey: boolean;
  target: string | null;
  origin: string | null;
  currentOrigin: string | null;
}

export function shouldBypassUnsavedClick(signal: UnsavedClickSignal): boolean {
  if (signal.ctrlKey || signal.metaKey || signal.shiftKey || signal.altKey) return true;
  if (signal.button !== 0) return true;
  if (signal.target === "_blank") return true;
  const href = signal.href ?? "";
  if (href.length === 0 || href.startsWith("#")) return true;
  if (signal.origin !== null && signal.currentOrigin !== null && signal.origin !== signal.currentOrigin) return true;
  return false;
}

export interface UnsavedBlockArgs {
  hasPending: boolean;
  isDirty: boolean;
  saving: boolean;
}

export function shouldBlockUnsavedNavigation(args: UnsavedBlockArgs): boolean {
  if (args.hasPending) return false;
  return args.isDirty || args.saving;
}
