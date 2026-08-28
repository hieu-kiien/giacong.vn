import type { NormalizedAdminAccessConfig } from "./admin-access";
import { isAdminRole } from "./admin-permissions.ts";

export interface AdminVisualSession {
  authenticated: unknown;
  role: unknown;
}

/**
 * Keeps the storefront host gate deliberately narrower than a route matcher:
 * only the exact, already-normalized admin hostnames can opt into admin UI.
 */
export function isAdminStorefrontHost(
  hostHeader: string | null,
  config: Pick<NormalizedAdminAccessConfig, "adminHostnames">,
): boolean {
  const host = normalizeHostHeader(hostHeader);
  return host !== "" && config.adminHostnames.includes(host);
}

export function isAdminSessionReady(session: AdminVisualSession): boolean {
  return session.authenticated === true
    && typeof session.role === "string"
    && isAdminRole(session.role);
}

function normalizeHostHeader(value: string | null): string {
  const hostHeader = value?.trim() ?? "";
  if (!hostHeader || hostHeader.includes(",") || hostHeader.includes(":")) return "";

  try {
    const parsed = new URL(`https://${hostHeader}`);
    if (
      parsed.port
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) {
      return "";
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}
