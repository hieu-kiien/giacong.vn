const ADMIN_ROOT_PATH = "/admin";
const STAGING_ADMIN_HOSTNAME = "admin-staging.kienhieu.id.vn";

function normalizePath(pathname: string): string {
  const normalized = pathname.trim().replace(/\/+$/, "");
  return normalized || "/";
}

export function isAdminNavItemActive(pathname: string, href: string): boolean {
  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(href);

  if (targetPath === ADMIN_ROOT_PATH) return currentPath === ADMIN_ROOT_PATH;
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function isStagingAdminHost(hostname: string): boolean {
  return hostname.trim().toLowerCase() === STAGING_ADMIN_HOSTNAME;
}
