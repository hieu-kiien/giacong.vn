export const STAGING_DIRECT_QA_MODE = "readonly-public-qa";
export const STAGING_ADMIN_PREVIEW_MODE = "access-protected-admin-preview";
export const STAGING_G2_PREVIEW_MODE = "access-protected-g2-preview";
export const STAGING_G3_PREVIEW_MODE = "access-protected-g3-preview";

const safeContactProbeRequestId = "00000000-0000-4000-8000-000000000001";
const safeContactProbeSnapshot = "0".repeat(64);

export function allowsStagingDirectQaRequest(request: Request, mode: string | undefined): boolean {
  const url = requestUrl(request);
  if (!url) return false;

  if (!isWorkersDev(url)) return true;

  const pathname = url.pathname;
  const normalizedMode = mode?.trim();
  if (normalizedMode === STAGING_ADMIN_PREVIEW_MODE) {
    return isAdminApiPath(pathname);
  }
  if (normalizedMode === STAGING_G2_PREVIEW_MODE) {
    if (isAdminApiPath(pathname)) return true;
    if (isAdminUiPath(pathname)) return false;
    const method = request.method.toUpperCase();
    return method === "GET" || method === "HEAD";
  }
  if (normalizedMode === STAGING_G3_PREVIEW_MODE) {
    const method = request.method.toUpperCase();
    if (method === "GET" && isLeadAdminApiPath(pathname)) return true;
    if (method !== "POST") return false;
    return pathname === "/api/gui-yeu-cau/xac-thuc" || pathname === "/api/contact";
  }
  if (normalizedMode !== STAGING_DIRECT_QA_MODE) return false;
  if (isAdminPath(pathname)) return false;

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return true;

  return method === "POST" && pathname === "/api/gui-yeu-cau/xac-thuc";
}

export async function allowsStagingDirectQaRuntimeRequest(
  request: Request,
  mode: string | undefined,
): Promise<boolean> {
  if (allowsStagingDirectQaRequest(request, mode)) return true;

  const url = requestUrl(request);
  if (!url || !isWorkersDev(url) || mode?.trim() !== STAGING_DIRECT_QA_MODE) return false;
  if (request.method.toUpperCase() !== "POST" || url.pathname !== "/api/contact") return false;

  const body = await request.clone().text();
  if (body === "{bad json") return true;

  try {
    const payload = JSON.parse(body);
    return payload?.source === "staging-deep-qa"
      && payload?.requestId === safeContactProbeRequestId
      && payload?.snapshotToken === safeContactProbeSnapshot
      && payload?.email === "qa@example.com"
      && payload?.name === "Staging QA"
      && payload?.phone === "0868408115"
      && payload?.message === "staging QA only"
      && Array.isArray(payload?.lines)
      && payload.lines.length === 1
      && payload.lines[0]?.parentSlug === "bot-gao-lut-xay-min"
      && payload.lines[0]?.variantSku === "B2B-DEMO-BGL-05"
      && payload.lines[0]?.quantity === 25;
  } catch {
    return false;
  }
}

function requestUrl(request: Request): URL | null {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
}

function isWorkersDev(url: URL): boolean {
  return url.hostname.toLowerCase().endsWith(".workers.dev");
}

function isAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

function isLeadAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin/leads" || pathname.startsWith("/api/admin/leads/");
}

function isAdminUiPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminPath(pathname: string): boolean {
  return isAdminUiPath(pathname) || isAdminApiPath(pathname);
}
