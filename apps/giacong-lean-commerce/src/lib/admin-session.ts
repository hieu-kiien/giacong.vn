import { adminFailure, adminSuccess } from "./admin-api.ts";
import type { AdminAdmissionResult } from "./admin-access.ts";
import { isAdminRole } from "./admin-permissions.ts";

export interface AdminSessionDependencies {
  admit(request: Request): Promise<AdminAdmissionResult>;
  requestId(): string;
  /** Resolves an active D1 member; an absent member must remain blocked. */
  resolveRole?(subject: string, email: string | null): Promise<AdminSessionRoleResolution | null>;
}

export interface AdminSessionRoleResolution {
  memberId: string;
  role: string;
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
  // Public demo actors are owners by contract; Access actors must resolve to an active D1 member.
  let role = "owner";
  let memberId: string | undefined;
  if (admission.actor.publicAdmin) {
    role = "owner";
  } else if (!dependencies.resolveRole) {
    return adminFailure(
      requestId,
      503,
      "INTERNAL_ERROR",
      "Không thể xác minh quyền admin lúc này.",
    );
  } else {
    try {
      const resolved = await dependencies.resolveRole(admission.actor.subject, admission.actor.email ?? null);
      if (!resolved || !isAdminRole(resolved.role)) {
        return adminFailure(
          requestId,
          403,
          "FORBIDDEN",
          "Tài khoản chưa được cấp quyền trong admin.",
        );
      }
      role = resolved.role;
      memberId = resolved.memberId;
    } catch {
      return adminFailure(
        requestId,
        503,
        "INTERNAL_ERROR",
        "Không thể xác minh quyền admin lúc này.",
      );
    }
  }

  return adminSuccess(requestId, {
    authenticated: true,
    ...(admission.actor.email ? { email: admission.actor.email } : {}),
    ...(memberId ? { memberId } : {}),
    role,
    subject: admission.actor.subject,
  });
}
