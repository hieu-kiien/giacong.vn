import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { D1DatabaseLike } from "./admin-data";

export type NavigationMenuKey = "primary" | "footer";

export interface PublishedNavigationItem {
  id: string;
  capturedMenuId: string | null;
  href: string;
  isActive: boolean;
  label: string;
  menuKey: NavigationMenuKey;
  sortOrder: number;
}

export interface AdminNavigationItem {
  id: string;
  capturedMenuId: string | null;
  draftHref: string;
  draftIsActive: boolean;
  draftLabel: string;
  draftSortOrder: number;
  publishedHref: string;
  publishedIsActive: boolean;
  publishedLabel: string;
  publishedSortOrder: number;
  menuKey: NavigationMenuKey;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
  dirty: boolean;
}

export class SiteNavigationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationValidationError";
  }
}

export class SiteNavigationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationConflictError";
  }
}

export class SiteNavigationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationNotFoundError";
  }
}

export const defaultPrimaryNavigation: readonly PublishedNavigationItem[] = [
  { id: "home", capturedMenuId: "menu-item-4618", href: "/", isActive: true, label: "Home", menuKey: "primary", sortOrder: 10 },
  { id: "about", capturedMenuId: "menu-item-5498", href: "/gioi-thieu-ve-gia-cong/", isActive: true, label: "Về Giacong.vn", menuKey: "primary", sortOrder: 20 },
  { id: "products", capturedMenuId: "menu-item-1742", href: "/san-pham/", isActive: true, label: "Mua hàng", menuKey: "primary", sortOrder: 30 },
  { id: "services", capturedMenuId: "menu-item-5166", href: "/thue-gia-cong/", isActive: true, label: "Thuê gia công", menuKey: "primary", sortOrder: 40 },
  { id: "news", capturedMenuId: "menu-item-1541", href: "/tin-tuc/", isActive: true, label: "Tin tức", menuKey: "primary", sortOrder: 50 },
  { id: "contact", capturedMenuId: "menu-item-1542", href: "/lien-he/", isActive: true, label: "Liên hệ", menuKey: "primary", sortOrder: 60 },
];

const capturedNavigationAliases: Readonly<Record<string, readonly string[]>> = {
  "menu-item-4618": ["menu-item-5465"],
  "menu-item-5498": ["menu-item-5496"],
  "menu-item-5166": ["menu-item-5466"],
  "menu-item-1541": ["menu-item-5477"],
  "menu-item-1542": ["menu-item-5478"],
};

export async function listAdminSiteNavigation(database: D1DatabaseLike): Promise<AdminNavigationItem[]> {
  const rows = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      published_label, published_href, published_sort_order, published_is_active,
      version, updated_by, updated_at, published_by, published_at
    FROM site_navigation_items
    ORDER BY menu_key ASC, draft_sort_order ASC, id ASC
    LIMIT 100
  `).all<SiteNavigationRow>();
  return rows.results.map(toAdminNavigationItem);
}

export async function getAdminSiteNavigation(
  database: D1DatabaseLike,
  id: string,
): Promise<AdminNavigationItem | null> {
  const normalizedId = normalizeNavigationId(id);
  const row = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      published_label, published_href, published_sort_order, published_is_active,
      version, updated_by, updated_at, published_by, published_at
    FROM site_navigation_items
    WHERE id = ?
    LIMIT 1
  `).bind(normalizedId).first<SiteNavigationRow>();
  return row ? toAdminNavigationItem(row) : null;
}

export async function createAdminSiteNavigation(
  database: D1DatabaseLike,
  input: {
    actorSubject: string;
    capturedMenuId?: unknown;
    href: unknown;
    isActive?: unknown;
    label: unknown;
    menuKey: unknown;
    sortOrder?: unknown;
  },
): Promise<AdminNavigationItem> {
  const menuKey = normalizeMenuKey(input.menuKey);
  const label = normalizeText(input.label, "label", 120);
  const href = normalizeHref(input.href);
  const capturedMenuId = normalizeCapturedMenuId(input.capturedMenuId);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  const isActive = normalizeBoolean(input.isActive, true);
  const id = crypto.randomUUID();

  await database.prepare(`
    INSERT INTO site_navigation_items (
      id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      published_label, published_href, published_sort_order, published_is_active,
      updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    menuKey,
    capturedMenuId,
    label,
    href,
    sortOrder,
    isActive ? 1 : 0,
    label,
    href,
    sortOrder,
    isActive ? 1 : 0,
    input.actorSubject,
  ).run();
  await writeNavigationAudit(database, input.actorSubject, "site_navigation.created", id, { menuKey });
  const item = await getAdminSiteNavigation(database, id);
  if (!item) throw new SiteNavigationNotFoundError("Không thể đọc mục điều hướng vừa tạo.");
  return item;
}

export async function updateAdminSiteNavigation(
  database: D1DatabaseLike,
  input: {
    actorSubject: string;
    expectedVersion: number;
    href: unknown;
    id: string;
    isActive: unknown;
    label: unknown;
    sortOrder: unknown;
  },
): Promise<AdminNavigationItem> {
  const id = normalizeNavigationId(input.id);
  const label = normalizeText(input.label, "label", 120);
  const href = normalizeHref(input.href);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  const isActive = normalizeBoolean(input.isActive);
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new SiteNavigationValidationError("expectedVersion không hợp lệ.");
  }
  const current = await getAdminSiteNavigation(database, id);
  if (!current) throw new SiteNavigationNotFoundError("Không tìm thấy mục điều hướng.");
  if (current.version !== input.expectedVersion) {
    throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }

  const result = await database.prepare(`
    UPDATE site_navigation_items
    SET draft_label = ?, draft_href = ?, draft_sort_order = ?, draft_is_active = ?,
      version = version + 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).bind(
    label,
    href,
    sortOrder,
    isActive ? 1 : 0,
    input.actorSubject,
    id,
    input.expectedVersion,
  ).run();
  if (!hasChanged(result)) throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  await writeNavigationAudit(database, input.actorSubject, "site_navigation.updated", id, {
    expectedVersion: input.expectedVersion,
  });
  const updated = await getAdminSiteNavigation(database, id);
  if (!updated) throw new SiteNavigationNotFoundError("Không thể đọc mục điều hướng vừa cập nhật.");
  return updated;
}

export async function publishAdminSiteNavigation(
  database: D1DatabaseLike,
  input: { actorSubject: string; expectedVersion: number; id: string },
): Promise<AdminNavigationItem> {
  const id = normalizeNavigationId(input.id);
  const current = await getAdminSiteNavigation(database, id);
  if (!current) throw new SiteNavigationNotFoundError("Không tìm thấy mục điều hướng.");
  if (current.version !== input.expectedVersion) {
    throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  }

  const result = await database.prepare(`
    UPDATE site_navigation_items
    SET published_label = draft_label, published_href = draft_href,
      published_sort_order = draft_sort_order, published_is_active = draft_is_active,
      version = version + 1,
      published_by = ?, published_at = CURRENT_TIMESTAMP,
      updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).bind(input.actorSubject, input.actorSubject, id, input.expectedVersion).run();
  if (!hasChanged(result)) throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  await writeNavigationAudit(database, input.actorSubject, "site_navigation.published", id, {
    previousPublishedHref: current.publishedHref,
  });
  const published = await getAdminSiteNavigation(database, id);
  if (!published) throw new SiteNavigationNotFoundError("Không thể đọc mục điều hướng vừa phát hành.");
  return published;
}

export async function publishAllAdminSiteNavigation(
  database: D1DatabaseLike,
  input: { actorSubject: string },
): Promise<{ published: AdminNavigationItem[]; skipped: number }> {
  const rows = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      published_label, published_href, published_sort_order, published_is_active,
      version, updated_by, updated_at, published_by, published_at
    FROM site_navigation_items
    WHERE draft_label <> published_label
      OR draft_href <> published_href
      OR draft_sort_order <> published_sort_order
      OR draft_is_active <> published_is_active
    ORDER BY menu_key ASC, draft_sort_order ASC, id ASC
  `).all<SiteNavigationRow>();
  const published: AdminNavigationItem[] = [];
  let skipped = 0;
  for (const row of rows.results) {
    const result = await database.prepare(`
      UPDATE site_navigation_items
      SET published_label = draft_label, published_href = draft_href,
        published_sort_order = draft_sort_order, published_is_active = draft_is_active,
        version = version + 1,
        published_by = ?, published_at = CURRENT_TIMESTAMP,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `).bind(input.actorSubject, input.actorSubject, row.id, row.version).run();
    if (!hasChanged(result)) {
      skipped++;
      continue;
    }
    await writeNavigationAudit(database, input.actorSubject, "site_navigation.published", row.id, { bulkPublish: true });
    const updated = await getAdminSiteNavigation(database, row.id);
    if (updated) published.push(updated);
  }
  return { published, skipped };
}

export async function getPublishedSiteNavigation(): Promise<PublishedNavigationItem[]> {
  try {
    const database = await getSiteDatabase();
    const rows = await database.prepare(`
      SELECT id, captured_menu_id, published_href, published_is_active,
        published_label, published_sort_order, menu_key
      FROM site_navigation_items
      ORDER BY menu_key ASC, published_sort_order ASC, id ASC
    `).all<PublishedNavigationRow>();
    return rows.results.map((row) => ({
      capturedMenuId: row.captured_menu_id,
      href: row.published_href,
      id: row.id,
      isActive: row.published_is_active === 1,
      label: row.published_label,
      menuKey: normalizeMenuKey(row.menu_key),
      sortOrder: row.published_sort_order,
    }));
  } catch (error) {
    console.warn("Published site navigation unavailable; using committed defaults.", error);
    return [...defaultPrimaryNavigation];
  }
}

export function applyNavigationToMarkup(
  markup: string,
  items: readonly PublishedNavigationItem[],
  activeCapturedMenuId?: string,
): string {
  const primaryItems = items
    .filter((item) => item.menuKey === "primary")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  let result = markup;

  for (const item of primaryItems) {
    if (!item.capturedMenuId) continue;
    const id = escapeRegExp(item.capturedMenuId);
    const withActive = activeCapturedMenuId === item.capturedMenuId;
    const pattern = new RegExp(
      `(<li\\b[^>]*\\bid=["']${id}["'][^>]*>\\s*<a\\b)([^>]*)(>)([\\s\\S]*?)(</a>)`,
      "gi",
    );
    result = result.replace(pattern, (_match, opening: string, attributes: string, close: string, inner: string, anchorClose: string) => {
      const nextAttributes = replaceAttribute(attributes, "href", item.href);
      const nextInner = preserveNavigationIcons(inner) + escapeHtml(item.label);
      return `${opening}${nextAttributes}${close}${nextInner}${preserveDropdownIcon(inner)}${anchorClose}`;
    });
    const openingPattern = new RegExp(`(<li\\b[^>]*\\bid=["']${id}["'][^>]*)(>)`, "gi");
    result = result.replace(openingPattern, (_match, opening: string, close: string) => {
      let next = opening
        .replace(/\s(?:current-menu-item|current_page_item|current-menu-parent|active)\b/gi, "")
        .replace(/\saria-current=(['"])page\1/gi, "")
        .replace(/\shidden\b/gi, "");
      next = updateClassTokens(next, ["current-menu-item", "current_page_item", "current-menu-parent", "active", "hidden"], [
        ...(!item.isActive ? ["hidden"] : []),
        ...(withActive ? ["active", "current-menu-item"] : []),
      ]);
      if (withActive) next += ' aria-current="page"';
      return `${next}${close}`;
    });
  }

  // The captured desktop and mobile menus use different WordPress IDs. Reuse
  // the same sanitizer for mobile aliases so one published menu controls both.
  for (const item of primaryItems) {
    if (!item.capturedMenuId) continue;
    for (const alias of capturedNavigationAliases[item.capturedMenuId] ?? []) {
      result = applyNavigationToMarkup(
        result,
        [{ ...item, capturedMenuId: alias }],
        activeCapturedMenuId === item.capturedMenuId ? alias : undefined,
      );
    }
  }

  const customItems = primaryItems.filter((item) => item.isActive && !item.capturedMenuId);
  if (customItems.length > 0) {
    const customMarkup = customItems.map((item) => (
      `<li class="menu-item menu-item-design-default managed-navigation-item"><a href="${escapeAttribute(item.href)}" class="nav-top-link">${escapeHtml(item.label)}</a></li>`
    )).join("\n");
    result = result.replace(/(<ul\b[^>]*class=["'][^"']*header-nav-main[^"']*["'][^>]*>)([\s\S]*?)(<\/ul>)/i, `$1$2${customMarkup}$3`);
    result = result.replace(/(<ul\b[^>]*class=["'][^"']*\bnav-sidebar\b[^"']*["'][^>]*>)([\s\S]*?)(<\/ul>)/i, `$1$2${customMarkup}$3`);
  }
  return reorderManagedNavigationLists(result, primaryItems);
}

function reorderManagedNavigationLists(markup: string, items: readonly PublishedNavigationItem[]): string {
  const sortById = new Map(items.filter((item) => item.capturedMenuId).map((item) => [item.capturedMenuId as string, item]));
  if (sortById.size < 2) return markup;
  const openingPattern = /<ul\b[^>]*\bclass=(['"])[^'"]*\bheader-nav-main\b[^'"]*\1[^>]*>/gi;
  let cursor = 0;
  let result = "";
  let match: RegExpExecArray | null;
  while ((match = openingPattern.exec(markup))) {
    const openingEnd = openingPattern.lastIndex;
    const closing = findMatchingUl(markup, openingEnd);
    if (!closing) break;
    const body = markup.slice(openingEnd, closing.start);
    result += markup.slice(cursor, openingEnd);
    result += reorderDirectManagedItems(body, sortById);
    result += markup.slice(closing.start, closing.end);
    cursor = closing.end;
    openingPattern.lastIndex = closing.end;
  }
  return result ? result + markup.slice(cursor) : markup;
}

function reorderDirectManagedItems(body: string, sortById: Map<string, PublishedNavigationItem>): string {
  const listItems = extractDirectListItems(body);
  const managed = listItems
    .map((item) => ({ ...item, navigation: readCapturedMenuItem(item.markup, sortById) }))
    .filter((item): item is ListItem & { navigation: PublishedNavigationItem } => Boolean(item.navigation));
  if (managed.length < 2) return body;
  const sorted = [...managed].sort((left, right) => left.navigation.sortOrder - right.navigation.sortOrder || left.navigation.id.localeCompare(right.navigation.id));
  let cursor = 0;
  let result = "";
  managed.forEach((slot, index) => {
    result += body.slice(cursor, slot.start);
    result += sorted[index].markup;
    cursor = slot.end;
  });
  return result + body.slice(cursor);
}

function readCapturedMenuItem(markup: string, sortById: Map<string, PublishedNavigationItem>): PublishedNavigationItem | undefined {
  const id = markup.match(/^<li\b[^>]*\bid=(['"])([^'"]+)\1/i)?.[2];
  return id ? sortById.get(id) : undefined;
}

interface ListItem {
  end: number;
  markup: string;
  start: number;
}

function extractDirectListItems(body: string): ListItem[] {
  const items: ListItem[] = [];
  const tagPattern = /<\/?li\b[^>]*>/gi;
  let depth = 0;
  let start = -1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(body))) {
    const tag = match[0];
    if (/^<li\b/i.test(tag)) {
      if (depth === 0) start = match.index;
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        items.push({ end: tagPattern.lastIndex, markup: body.slice(start, tagPattern.lastIndex), start });
        start = -1;
      }
    }
  }
  return items;
}

function findMatchingUl(markup: string, startAt: number): { end: number; start: number } | null {
  const tagPattern = /<\/?ul\b[^>]*>/gi;
  tagPattern.lastIndex = startAt;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(markup))) {
    if (/^<ul\b/i.test(match[0])) {
      depth++;
    } else {
      depth--;
      if (depth === 0) return { end: tagPattern.lastIndex, start: match.index };
    }
  }
  return null;
}

function toAdminNavigationItem(row: SiteNavigationRow): AdminNavigationItem {
  return {
    capturedMenuId: row.captured_menu_id,
    dirty: row.draft_label !== row.published_label
      || row.draft_href !== row.published_href
      || row.draft_sort_order !== row.published_sort_order
      || row.draft_is_active !== row.published_is_active,
    draftHref: row.draft_href,
    draftIsActive: row.draft_is_active === 1,
    draftLabel: row.draft_label,
    draftSortOrder: row.draft_sort_order,
    id: row.id,
    menuKey: normalizeMenuKey(row.menu_key),
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    publishedHref: row.published_href,
    publishedIsActive: row.published_is_active === 1,
    publishedLabel: row.published_label,
    publishedSortOrder: row.published_sort_order,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    version: row.version,
  };
}

function normalizeNavigationId(value: string): string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(value)) {
    throw new SiteNavigationValidationError("id điều hướng không hợp lệ.");
  }
  return value;
}

function normalizeMenuKey(value: unknown): NavigationMenuKey {
  if (value === "primary" || value === "footer") return value;
  throw new SiteNavigationValidationError("menuKey không hợp lệ.");
}

function normalizeText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new SiteNavigationValidationError(`${field} phải là chuỗi.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[<>]/.test(normalized)) {
    throw new SiteNavigationValidationError(`${field} không hợp lệ.`);
  }
  return normalized;
}

function normalizeHref(value: unknown): string {
  if (typeof value !== "string") throw new SiteNavigationValidationError("href phải là URL.");
  const normalized = value.trim();
  if (!isSafeHref(normalized)) throw new SiteNavigationValidationError("href chỉ được dùng URL nội bộ hoặc http(s).");
  return normalized;
}

function isSafeHref(value: string): boolean {
  if (!value || value.startsWith("//")) return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function normalizeCapturedMenuId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,99}$/i.test(value)) {
    throw new SiteNavigationValidationError("capturedMenuId không hợp lệ.");
  }
  return value;
}

function normalizeSortOrder(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100_000) {
    throw new SiteNavigationValidationError("sortOrder không hợp lệ.");
  }
  return number;
}

function normalizeBoolean(value: unknown, fallback?: boolean): boolean {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") throw new SiteNavigationValidationError("isActive phải là boolean.");
  return value;
}

async function getSiteDatabase(): Promise<D1DatabaseLike> {
  const { env } = await getCloudflareContext({ async: true });
  const database = (env as unknown as { GIACONG_VN_CATALOG?: D1DatabaseLike }).GIACONG_VN_CATALOG;
  if (!database) throw new Error("Missing GIACONG_VN_CATALOG binding.");
  return database;
}

async function writeNavigationAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  action: string,
  entityId: string,
  metadata: unknown,
): Promise<void> {
  await database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, 'site_navigation', ?, ?)
  `).bind(crypto.randomUUID(), actorSubject, action, entityId, JSON.stringify(metadata)).run();
}

interface SiteNavigationRow {
  id: string;
  menu_key: NavigationMenuKey;
  captured_menu_id: string | null;
  draft_label: string;
  draft_href: string;
  draft_sort_order: number;
  draft_is_active: number;
  published_label: string;
  published_href: string;
  published_sort_order: number;
  published_is_active: number;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
}

interface PublishedNavigationRow {
  id: string;
  menu_key: NavigationMenuKey;
  captured_menu_id: string | null;
  published_label: string;
  published_href: string;
  published_sort_order: number;
  published_is_active: number;
}

function preserveNavigationIcons(inner: string): string {
  return (inner.match(/<img\b[^>]*>/gi) ?? []).join("");
}

function preserveDropdownIcon(inner: string): string {
  return inner.match(/<i\b[^>]*icon-angle-down[^>]*>[\s\S]*?<\/i>/i)?.[0] ?? "";
}

function replaceAttribute(attributes: string, name: string, value: string): string {
  const escaped = escapeAttribute(value);
  const pattern = new RegExp(`\\s${name}=(['"])[^'"]*\\1`, "i");
  return pattern.test(attributes)
    ? attributes.replace(pattern, ` ${name}="${escaped}"`)
    : `${attributes} ${name}="${escaped}"`;
}

function updateClassTokens(attributes: string, remove: readonly string[], add: readonly string[]): string {
  const classPattern = /\sclass=(['"])([^'"]*)\1/i;
  const classMatch = attributes.match(classPattern);
  const removeSet = new Set(remove);
  const tokens = (classMatch?.[2] ?? "")
    .split(/\s+/)
    .filter((token) => token && !removeSet.has(token));
  for (const token of add) {
    if (token && !tokens.includes(token)) tokens.push(token);
  }
  const classValue = escapeAttribute(tokens.join(" "));
  if (classMatch) return attributes.replace(classPattern, ` class="${classValue}"`);
  return classValue ? `${attributes} class="${classValue}"` : attributes;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasChanged(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return true;
  const meta = (result as { meta?: { changes?: unknown } }).meta;
  return meta?.changes === undefined || Number(meta.changes) > 0;
}
