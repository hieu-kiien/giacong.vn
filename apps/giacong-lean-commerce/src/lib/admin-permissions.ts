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
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const readCapabilities = ADMIN_CAPABILITIES.filter((capability) => capability.endsWith(".read"));
const contentCapabilities: AdminCapability[] = [
  "dashboard.read",
  "catalog.read",
  "content.read",
  "content.write",
  "content.publish",
  "navigation.read",
  "navigation.write",
  "navigation.publish",
  "pages.read",
  "pages.write",
  "pages.publish",
  "media.read",
  "media.write",
  "news.read",
  "news.write",
  "services.read",
  "services.write",
];

const catalogCapabilities: AdminCapability[] = [
  "dashboard.read",
  "catalog.read",
  "catalog.write",
  "media.read",
  "media.write",
];

const salesCapabilities: AdminCapability[] = ["dashboard.read", "leads.read", "leads.write"];

const roleCapabilities: Record<AdminRole, ReadonlySet<AdminCapability>> = {
  owner: new Set(ADMIN_CAPABILITIES),
  content_manager: new Set(contentCapabilities),
  catalog_manager: new Set(catalogCapabilities),
  sales_manager: new Set(salesCapabilities),
  viewer: new Set(readCapabilities.filter((capability) => capability !== "members.read")),
};

export function isAdminRole(value: string): value is AdminRole {
  return value in roleCapabilities;
}

export function canManage(role: AdminRole | string, capability: AdminCapability): boolean {
  return isAdminRole(role) && roleCapabilities[role].has(capability);
}

export function canManageCatalog(role: AdminRole | string): boolean {
  return canManage(role, "catalog.write");
}

export function canManageLeads(role: AdminRole | string): boolean {
  return canManage(role, "leads.write");
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
