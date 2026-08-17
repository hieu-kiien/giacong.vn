import { adminSuccess } from "./admin-api.ts";
import type { AdminGuardResult } from "./admin-guard.ts";

export function handleAdminSession(
  guard: Pick<AdminGuardResult, "actorSubject" | "member">,
  requestId: string,
): Response {
  return adminSuccess(requestId, {
    authenticated: true,
    subject: guard.actorSubject,
    role: guard.member.role,
    member: {
      id: guard.member.id,
      displayName: guard.member.displayName,
      email: guard.member.email,
      role: guard.member.role,
    },
  });
}
