import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AdminAccessConfig {
  adminHostname: string;
  policyAudience: string;
  teamDomain: string;
}

export interface AdminActor {
  subject: string;
}

export type AdminAdmissionFailureCode = "FORBIDDEN" | "INTERNAL_ERROR" | "NOT_FOUND";

export type AdminAdmissionResult =
  | { actor: AdminActor; ok: true }
  | {
      code: AdminAdmissionFailureCode;
      message: string;
      ok: false;
      status: 401 | 403 | 404 | 500;
    };

interface VerifiedAccessClaims {
  subject: string;
}

export type AccessTokenVerifier = (
  token: string,
  config: NormalizedAdminAccessConfig,
) => Promise<VerifiedAccessClaims>;

export interface NormalizedAdminAccessConfig {
  adminHostname: string;
  adminOrigin: string;
  policyAudience: string;
  teamDomain: string;
}

const mutationMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const jwksByTeamDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Admits a request only when it targets the exact admin host, is same-origin for
 * mutations, and carries a cryptographically valid Cloudflare Access JWT.
 */
export async function admitAdminRequest(
  request: Request,
  rawConfig: AdminAccessConfig,
  verifyToken: AccessTokenVerifier = verifyCloudflareAccessToken,
): Promise<AdminAdmissionResult> {
  const config = normalizeAdminAccessConfig(rawConfig);
  if (!config) {
    return failure(500, "INTERNAL_ERROR", "Cấu hình quản trị chưa sẵn sàng.");
  }

  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return failure(404, "NOT_FOUND", "Không tìm thấy.");
  }

  if (requestUrl.protocol !== "https:" || requestUrl.hostname.toLowerCase() !== config.adminHostname) {
    return failure(404, "NOT_FOUND", "Không tìm thấy.");
  }

  if (mutationMethods.has(request.method.toUpperCase())) {
    const origin = request.headers.get("origin")?.trim() ?? "";
    if (origin !== config.adminOrigin) {
      return failure(403, "FORBIDDEN", "Yêu cầu quản trị không được phép.");
    }
  }

  const token = request.headers.get("cf-access-jwt-assertion")?.trim() ?? "";
  if (!token) {
    return failure(401, "FORBIDDEN", "Cần xác thực quản trị.");
  }

  try {
    const claims = await verifyToken(token, config);
    if (!claims.subject) {
      return failure(401, "FORBIDDEN", "Phiên quản trị không hợp lệ.");
    }
    return { actor: { subject: claims.subject }, ok: true };
  } catch {
    return failure(401, "FORBIDDEN", "Phiên quản trị không hợp lệ.");
  }
}

/**
 * Verifies Cloudflare Access signature and registered claims against the exact
 * Zero Trust team issuer and application audience. Algorithms are allow-listed
 * to prevent accepting an attacker-selected JWT algorithm.
 */
export async function verifyCloudflareAccessToken(
  token: string,
  config: NormalizedAdminAccessConfig,
): Promise<VerifiedAccessClaims> {
  const jwks = getRemoteJwks(config.teamDomain);
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ["RS256"],
    audience: config.policyAudience,
    issuer: config.teamDomain,
  });

  const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!subject) throw new Error("Access JWT missing subject");
  return { subject };
}

export function normalizeAdminAccessConfig(
  config: AdminAccessConfig,
): NormalizedAdminAccessConfig | null {
  const adminHostname = config.adminHostname.trim().toLowerCase();
  const policyAudience = config.policyAudience.trim();
  if (!validHostname(adminHostname) || !validAudience(policyAudience)) return null;

  let teamUrl: URL;
  try {
    teamUrl = new URL(config.teamDomain.trim());
  } catch {
    return null;
  }

  if (
    teamUrl.protocol !== "https:"
    || teamUrl.username
    || teamUrl.password
    || teamUrl.search
    || teamUrl.hash
    || (teamUrl.pathname !== "/" && teamUrl.pathname !== "")
  ) {
    return null;
  }

  const teamDomain = teamUrl.origin;
  return {
    adminHostname,
    adminOrigin: `https://${adminHostname}`,
    policyAudience,
    teamDomain,
  };
}

function getRemoteJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksByTeamDomain.get(teamDomain);
  if (cached) return cached;

  const jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  jwksByTeamDomain.set(teamDomain, jwks);
  return jwks;
}

function validHostname(value: string): boolean {
  if (!value || value.length > 253 || value.includes(":")) return false;
  return value.split(".").every((label) => (
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ));
}

function validAudience(value: string): boolean {
  return value.length >= 16 && value.length <= 256 && /^[A-Za-z0-9._~:-]+$/.test(value);
}

function failure(
  status: 401 | 403 | 404 | 500,
  code: AdminAdmissionFailureCode,
  message: string,
): AdminAdmissionResult {
  return { code, message, ok: false, status };
}
