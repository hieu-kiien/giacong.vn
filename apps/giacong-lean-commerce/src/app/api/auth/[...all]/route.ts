import { toNextJsHandler } from "better-auth/next-js";
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
