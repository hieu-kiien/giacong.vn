import { adminFailure, adminSuccess } from "./admin-api.ts";
import type { AdminAdmissionResult } from "./admin-access.ts";

export interface AdminSessionDependencies {
  admit(request: Request): Promise<AdminAdmissionResult>;
  requestId(): string;
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

  return adminSuccess(requestId, {
    authenticated: true,
    subject: admission.actor.subject,
  });
}
