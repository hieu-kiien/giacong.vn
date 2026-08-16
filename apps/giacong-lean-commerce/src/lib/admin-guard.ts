import "server-only";

import { adminFailure, type AdminApiErrorCode } from "./admin-api.ts";
import { admitRuntimeAdminRequest } from "./admin-access-runtime";
import {
  findAdminMember,
  getAdminDatabase,
  type AdminMember,
  type D1DatabaseLike,
} from "./admin-data";

export interface AdminGuardResult {
  actorSubject: string;
  database: D1DatabaseLike;
  member: AdminMember;
}

export async function requireAdmin(
  request: Request,
): Promise<AdminGuardResult | Response> {
  const requestId = crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) {
    return adminFailure(requestId, admission.status, admission.code, admission.message);
  }

  try {
    const database = getAdminDatabase();
    const member = admission.actor.publicAdmin
      ? {
          id: "public-demo",
          accessSubject: admission.actor.subject,
          email: null,
          displayName: "Public demo",
          role: "owner" as const,
        }
      : await findAdminMember(database, admission.actor.subject, admission.actor.email);
    if (!member) {
      return adminFailure(
        requestId,
        403,
        "FORBIDDEN",
        "Tài khoản chưa được cấp quyền trong admin.",
      );
    }
    return {
      actorSubject: admission.actor.subject,
      database,
      member,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể truy cập dữ liệu admin.";
    return adminFailure(requestId, 503, "INTERNAL_ERROR" as AdminApiErrorCode, message);
  }
}