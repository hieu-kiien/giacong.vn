import { toNextJsHandler } from "better-auth/next-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1DatabaseLike } from "@/lib/admin-data";
import { isCustomerEmailRegistrationAllowed } from "@/lib/customer-registration-policy";
import { parseCustomerContact } from "@/lib/customer-contact-input";
import { saveCustomerContact } from "@/lib/customer-contact-data";
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
      // Only the account returned by Better Auth can own this registration profile.
      let raw: unknown;
      const text = await request.clone().text();
      if (text.length > 4096) return Response.json({ code: "INVALID_CONTACT", message: "Thông tin quá dài." }, { status: 413 });
      try { raw = JSON.parse(text); } catch { return Response.json({ code: "INVALID_CONTACT", message: "Thông tin không hợp lệ." }, { status: 400 }); }
      const contact = parseCustomerContact(raw);
      if (!contact.ok) return Response.json({ code: "INVALID_CONTACT", message: Object.values(contact.errors)[0] }, { status: 422 });
      const response = await handlers.POST(request);
      if (!response.ok) return response;
      const body: unknown = await response.clone().json();
      if (typeof body !== "object" || body === null || !("user" in body) ||
          typeof body.user !== "object" || body.user === null || !("id" in body.user) || typeof body.user.id !== "string") return response;
      try {
        await saveCustomerContact(database, body.user.id, contact.value);
      } catch {
        // The account already exists: keep the verification flow usable and let
        // the customer retry the missing profile from their verified account.
      }
      // Keep Better Auth's indistinguishable duplicate-signup response, including
      // its synthetic user ID. Profile persistence must not reveal account existence.
      return response;
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
