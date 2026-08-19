export const STAGING_DIRECT_QA_MODE = "readonly-public-qa";

export function allowsStagingDirectQaRequest(request: Request, mode: string | undefined): boolean {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  if (!url.hostname.toLowerCase().endsWith(".workers.dev")) return true;
  if (mode?.trim() !== STAGING_DIRECT_QA_MODE) return false;

  const pathname = url.pathname;
  if (
    pathname === "/admin"
    || pathname.startsWith("/admin/")
    || pathname === "/api/admin"
    || pathname.startsWith("/api/admin/")
  ) {
    return false;
  }

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return true;

  return method === "POST" && pathname === "/api/gui-yeu-cau/xac-thuc";
}
