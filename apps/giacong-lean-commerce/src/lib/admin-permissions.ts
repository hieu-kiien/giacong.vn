import type { AdminRole } from "./admin-data";

export function canManageSiteContent(role: AdminRole): boolean {
  return role === "owner" || role === "content_manager";
}

export function canPublishSiteContent(role: AdminRole): boolean {
  return role === "owner" || role === "content_manager";
}