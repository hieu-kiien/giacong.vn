/** The dedicated staging admin hostname starts at the authenticated admin entry. */
export function getStagingAdminEntryRedirect(request: Request): string | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  if (url.hostname !== "admin-staging.kienhieu.id.vn" || url.pathname !== "/") return null;
  url.pathname = "/admin/";
  return url.href;
}
