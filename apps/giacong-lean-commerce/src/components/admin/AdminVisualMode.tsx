"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { AdminClientError, fetchAdmin, type AdminSession } from "@/lib/admin-client";
import { isAdminSessionReady } from "@/lib/admin-visual-contract";
import { AdminUnsavedContext, type AdminUnsavedState } from "./AdminUnsavedGuard";

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
  const [unsavedRevision, setUnsavedRevision] = useState(0);
  const [unsavedSaving, setUnsavedSaving] = useState(false);
  const unsavedRegistrationsRef = useRef(new Map<string, AdminUnsavedState>());

  const updateUnsavedState = useCallback(() => {
    const registrations = [...unsavedRegistrationsRef.current.values()];
    setUnsavedSaving(registrations.some((registration) => registration.saving));
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
  }, []);

  return (
    <AdminVisualContext.Provider value={{ session, status }}>
      <AdminUnsavedContext.Provider
        value={{
          isDirty: () => [...unsavedRegistrationsRef.current.values()].some((registration) => registration.isDirty()),
          revision: unsavedRevision,
          saving: unsavedSaving,
          register: registerUnsaved,
          unregister: unregisterUnsaved,
        }}
      >
        {children}
      </AdminUnsavedContext.Provider>
    </AdminVisualContext.Provider>
  );
}
