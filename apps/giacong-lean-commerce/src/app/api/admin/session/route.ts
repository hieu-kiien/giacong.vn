import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { handleAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAdminSession(request, {
    admit: admitRuntimeAdminRequest,
    requestId: () => crypto.randomUUID(),
  });
}
