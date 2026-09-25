import type { AdminRole } from "./admin-data";

export const ADMIN_CAPABILITIES = [
  "dashboard.read",
  "catalog.read",
  "catalog.write",
  "content.read",
  "content.write",
  "content.publish",
  "navigation.read",
  "navigation.write",
  "navigation.publish",
  "pages.read",
  "pages.write",
  "pages.publish",
  "members.read",
  "members.write",
  "media.read",
  "media.write",
  "news.read",
  "news.write",
  "services.read",
  "services.write",
  "leads.read",
  "leads.write",
  "crm.read",
  "crm.write",
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

// The sole active role is Admin toàn quyền. Keep the existing persisted owner
// key so current accounts, owner safety guards and audit history remain valid.
export function isAdminRole(value: string): value is "owner" {
  return value === "owner";
}

export function canManage(role: AdminRole | string, capability: AdminCapability): boolean {
  return isAdminRole(role) && ADMIN_CAPABILITIES.includes(capability);
}

export function canManageCatalog(role: AdminRole | string): boolean {
  return canManage(role, "catalog.write");
}

export function canManageLeads(role: AdminRole | string): boolean {
  return canManage(role, "leads.write");
}

export function canManageCrm(role: AdminRole | string): boolean {
  return canManage(role, "crm.write");
}

export function canManageMedia(role: AdminRole | string): boolean {
  return canManage(role, "media.write");
}

export function canManageMembers(role: AdminRole | string): boolean {
  return canManage(role, "members.write");
}

export function canManageNews(role: AdminRole | string): boolean {
  return canManage(role, "news.write");
}

export function canManageNavigation(role: AdminRole | string): boolean {
  return canManage(role, "navigation.write");
}

export function canManagePages(role: AdminRole | string): boolean {
  return canManage(role, "pages.write");
}

export function canManageServices(role: AdminRole | string): boolean {
  return canManage(role, "services.write");
}

export function canManageSiteContent(role: AdminRole | string): boolean {
  return canManage(role, "content.write");
}

export function canPublishSiteContent(role: AdminRole | string): boolean {
  return canManage(role, "content.publish");
}

export function canPublishNavigation(role: AdminRole | string): boolean {
  return canManage(role, "navigation.publish");
}

export function canPublishPages(role: AdminRole | string): boolean {
  return canManage(role, "pages.publish");
}
