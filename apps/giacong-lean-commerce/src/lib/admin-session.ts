import { adminFailure, adminSuccess } from "./admin-api.ts";
import type { AdminAdmissionResult } from "./admin-access.ts";

export interface AdminSessionDependencies {
  admit(request: Request): Promise<AdminAdmissionResult>;
  requestId(): string;
  /** Resolves the operator role for the session payload; defaults to "viewer". */
  resolveRole?(subject: string, email: string | null): Promise<string>;
}

export async function handleAdminSession(
  request: Request,
  dependencies: AdminSessionDependencies,
): Promise<Response> {
  const requestId = dependencies.requestId();
  const admission = await dependencies.admit(request);
  if (!admission.ok) {
    return adminFailure(
      requestId,
      admission.status,
      admission.code,
      admission.message,
    );
  }

  // The client gates write controls on this role, so it must always be present.
  // Public demo actors are owners by contract; Access actors resolve via D1.
  let role = "viewer";
  if (admission.actor.publicAdmin) {
    role = "owner";
  } else if (dependencies.resolveRole) {
    try {
      role = await dependencies.resolveRole(admission.actor.subject, admission.actor.email ?? null);
    } catch {
      role = "viewer";
    }
  }

  return adminSuccess(requestId, {
    authenticated: true,
    role,
    subject: admission.actor.subject,
  });
}
