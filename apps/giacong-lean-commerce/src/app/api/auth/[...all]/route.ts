import { toNextJsHandler } from "better-auth/next-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1DatabaseLike } from "@/lib/admin-data";
import { isCustomerEmailRegistrationAllowed } from "@/lib/customer-registration-policy";
import {
  CustomerAuthConfigurationError,
  CustomerAuthOriginError,
  getCustomerAuthForRequest,
} from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

function authErrorResponse(status: 403 | 503, code: "AUTH_ORIGIN_FORBIDDEN" | "AUTH_NOT_CONFIGURED"): Response {
  return Response.json(
    { ok: false, code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleAuthRequest(request: Request, method: "GET" | "POST"): Promise<Response> {
  try {
    const handlers = toNextJsHandler(getCustomerAuthForRequest(request));
    if (method === "POST" && new URL(request.url).pathname.replace(/\/$/, "").endsWith("/sign-up/email")) {
      const database = (getCloudflareContext().env as unknown as { GIACONG_VN_CATALOG?: D1DatabaseLike }).GIACONG_VN_CATALOG;
      if (!database) throw new CustomerAuthConfigurationError();
      let allowed: boolean;
      try {
        allowed = await isCustomerEmailRegistrationAllowed(database);
      } catch {
        return authErrorResponse(503, "AUTH_NOT_CONFIGURED");
      }
      if (!allowed) {
        return Response.json({ code: "EMAIL_PASSWORD_SIGN_UP_DISABLED", message: "Email sign-up is disabled." }, {
          status: 403, headers: { "Cache-Control": "no-store" },
        });
      }
    }
    return method === "GET" ? await handlers.GET(request) : await handlers.POST(request);
  } catch (error) {
    if (error instanceof CustomerAuthOriginError) {
      return authErrorResponse(403, "AUTH_ORIGIN_FORBIDDEN");
    }
    if (error instanceof CustomerAuthConfigurationError) {
      return authErrorResponse(503, "AUTH_NOT_CONFIGURED");
    }
    throw error;
  }
}

export function GET(request: Request): Promise<Response> {
  return handleAuthRequest(request, "GET");
}

export function POST(request: Request): Promise<Response> {
  return handleAuthRequest(request, "POST");
}
