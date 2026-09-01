import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { findAdminMember, getAdminDatabase } from "@/lib/admin-data";
import { handleAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAdminSession(request, {
    admit: admitRuntimeAdminRequest,
    requestId: () => crypto.randomUUID(),
    resolveRole: async (subject, email) => {
      const member = await findAdminMember(getAdminDatabase(), subject, email ?? undefined);
      return member ? { memberId: member.id, role: member.role } : null;
    },
  });
}
