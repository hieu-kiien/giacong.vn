import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { D1DatabaseLike } from "./admin-data";
import {
  PageBuilderValidationError,
  parsePageBlocks,
  parsePageBlocksJson,
  serializePageBlocks,
  type PageBlock,
} from "./page-builder.ts";

export interface AdminSitePage {
  pageKey: string;
  routePath: string;
  title: string;
  draftEnabled: boolean;
  publishedEnabled: boolean;
  draftBlocks: PageBlock[];
  publishedBlocks: PageBlock[];
  draftSeoTitle: string;
  publishedSeoTitle: string;
  draftSeoDescription: string;
  publishedSeoDescription: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
  dirty: boolean;
}

export interface PublishedSitePage {
  pageKey: string;
  routePath: string;
  title: string;
  blocks: PageBlock[];
  seoTitle: string;
  seoDescription: string;
}

export class SitePageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SitePageValidationError";
  }
}

export class SitePageConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SitePageConflictError";
  }
}

export class SitePageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SitePageNotFoundError";
  }
}

export async function listAdminSitePages(database: D1DatabaseLike): Promise<AdminSitePage[]> {
  const rows = await database.prepare(`
    SELECT page_key, route_path, title,
      draft_enabled, published_enabled,
      draft_blocks_json, published_blocks_json,
      draft_seo_title, published_seo_title,
      draft_seo_description, published_seo_description,
      version, updated_by, updated_at, published_by, published_at
    FROM site_pages
    ORDER BY title COLLATE NOCASE ASC, page_key ASC
    LIMIT 100
  `).all<SitePageRow>();
  return rows.results.map(toAdminSitePage);
}

export async function getAdminSitePage(
  database: D1DatabaseLike,
  pageKey: string,
): Promise<AdminSitePage | null> {
  const normalizedKey = normalizePageKey(pageKey);
  const row = await database.prepare(`
    SELECT page_key, route_path, title,
      draft_enabled, published_enabled,
      draft_blocks_json, published_blocks_json,
      draft_seo_title, published_seo_title,
      draft_seo_description, published_seo_description,
      version, updated_by, updated_at, published_by, published_at
    FROM site_pages
    WHERE page_key = ?
    LIMIT 1
  `).bind(normalizedKey).first<SitePageRow>();
  return row ? toAdminSitePage(row) : null;
}

export async function createAdminSitePage(
  database: D1DatabaseLike,
  input: { actorSubject: string; pageKey: string; routePath: string; title: string },
): Promise<AdminSitePage> {
  const pageKey = normalizePageKey(input.pageKey);
  const routePath = normalizeRoutePath(input.routePath);
  const title = normalizeText(input.title, "title", 240, true);

  await database.prepare(`
    INSERT INTO site_pages (
      page_key, route_path, title,
      draft_enabled, published_enabled,
      draft_blocks_json, published_blocks_json,
      draft_seo_title, published_seo_title,
      draft_seo_description, published_seo_description,
      updated_by
    ) VALUES (?, ?, ?, 0, 0, '[]', '[]', '', '', '', '', ?)
  `).bind(pageKey, routePath, title, input.actorSubject).run();
  await writePageAudit(database, input.actorSubject, "site_page.created", pageKey, { routePath, title });
  const page = await getAdminSitePage(database, pageKey);
  if (!page) throw new SitePageNotFoundError("Không thể đọc page vừa tạo.");
  return page;
}

export async function updateAdminSitePage(
  database: D1DatabaseLike,
  input: {
    actorSubject: string;
    blocks: unknown;
    draftEnabled: boolean;
    expectedVersion: number;
    pageKey: string;
    seoDescription: unknown;
    seoTitle: unknown;
  },
): Promise<AdminSitePage> {
  const pageKey = normalizePageKey(input.pageKey);
  let blocks: PageBlock[];
  try {
    blocks = parsePageBlocks(input.blocks);
  } catch (error) {
    if (error instanceof PageBuilderValidationError) {
      throw new SitePageValidationError(error.message);
    }
    throw error;
  }
  const seoTitle = normalizeText(input.seoTitle, "seoTitle", 240, false);
  const seoDescription = normalizeText(input.seoDescription, "seoDescription", 1000, false);
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new SitePageValidationError("expectedVersion không hợp lệ.");
  }

  const current = await getAdminSitePage(database, pageKey);
  if (!current) throw new SitePageNotFoundError("Không tìm thấy page cần cập nhật.");
  if (current.version !== input.expectedVersion) {
    throw new SitePageConflictError("Page đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }

  const result = await database.prepare(`
    UPDATE site_pages
    SET draft_blocks_json = ?, draft_enabled = ?,
      draft_seo_title = ?, draft_seo_description = ?,
      version = version + 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE page_key = ? AND version = ?
  `).bind(
    serializePageBlocks(blocks),
    input.draftEnabled ? 1 : 0,
    seoTitle,
    seoDescription,
    input.actorSubject,
    pageKey,
    input.expectedVersion,
  ).run();
  if (!hasChanged(result)) throw new SitePageConflictError("Page đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  await writePageAudit(database, input.actorSubject, "site_page.updated", pageKey, {
    blockCount: blocks.length,
    draftEnabled: input.draftEnabled,
    expectedVersion: input.expectedVersion,
  });
  const updated = await getAdminSitePage(database, pageKey);
  if (!updated) throw new SitePageNotFoundError("Không thể đọc page vừa cập nhật.");
  return updated;
}

export async function publishAdminSitePage(
  database: D1DatabaseLike,
  input: { actorSubject: string; expectedVersion: number; pageKey: string },
): Promise<AdminSitePage> {
  const pageKey = normalizePageKey(input.pageKey);
  const current = await getAdminSitePage(database, pageKey);
  if (!current) throw new SitePageNotFoundError("Không tìm thấy page cần phát hành.");
  if (current.version !== input.expectedVersion) {
    throw new SitePageConflictError("Page đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  }

  const result = await database.prepare(`
    UPDATE site_pages
    SET published_blocks_json = draft_blocks_json,
      published_enabled = draft_enabled,
      published_seo_title = draft_seo_title,
      published_seo_description = draft_seo_description,
      version = version + 1,
      published_by = ?, published_at = CURRENT_TIMESTAMP,
      updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE page_key = ? AND version = ?
  `).bind(
    input.actorSubject,
    input.actorSubject,
    pageKey,
    input.expectedVersion,
  ).run();
  if (!hasChanged(result)) throw new SitePageConflictError("Page đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  await writePageAudit(database, input.actorSubject, "site_page.published", pageKey, {
    previousPublishedBlocks: current.publishedBlocks.length,
  });
  const published = await getAdminSitePage(database, pageKey);
  if (!published) throw new SitePageNotFoundError("Không thể đọc page vừa phát hành.");
  return published;
}

export async function getPublishedSitePage(routePath: string): Promise<PublishedSitePage | null> {
  let normalizedPath: string;
  try {
    normalizedPath = normalizeRoutePath(routePath);
  } catch {
    return null;
  }

  try {
    const database = await getSiteDatabase();
    const row = await database.prepare(`
      SELECT page_key, route_path, title, published_enabled,
        published_blocks_json, published_seo_title, published_seo_description
      FROM site_pages
      WHERE route_path = ? AND published_enabled = 1
      LIMIT 1
    `).bind(normalizedPath).first<PublishedSitePageRow>();
    if (!row) return null;
    return {
      blocks: parsePageBlocksJson(row.published_blocks_json),
      pageKey: row.page_key,
      routePath: row.route_path,
      seoDescription: row.published_seo_description,
      seoTitle: row.published_seo_title,
      title: row.title,
    };
  } catch (error) {
    console.warn("Published site page unavailable; using captured fallback.", error);
    return null;
  }
}

export function normalizePageKey(value: string): string {
  if (typeof value !== "string") throw new SitePageValidationError("pageKey phải là chuỗi.");
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || normalized.length > 80) {
    throw new SitePageValidationError("pageKey chỉ được gồm chữ thường, số và dấu gạch ngang.");
  }
  return normalized;
}

export function normalizeRoutePath(value: string): string {
  if (typeof value !== "string") throw new SitePageValidationError("routePath phải là chuỗi.");
  const normalized = value.trim();
  if (normalized === "/") return normalized;
  if (!/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\/?$/.test(normalized) || normalized.length > 160) {
    throw new SitePageValidationError("routePath chỉ được là đường dẫn nội bộ an toàn.");
  }
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function normalizeText(value: unknown, field: string, maxLength: number, required: boolean): string {
  if (typeof value !== "string") throw new SitePageValidationError(`${field} phải là chuỗi.`);
  const normalized = value.trim();
  if (required && !normalized) throw new SitePageValidationError(`${field} là bắt buộc.`);
  if (normalized.length > maxLength) throw new SitePageValidationError(`${field} vượt quá giới hạn ký tự.`);
  if (/[<>]/.test(normalized)) throw new SitePageValidationError(`${field} không được chứa HTML hoặc markup.`);
  return normalized;
}

interface SitePageRow {
  page_key: string;
  route_path: string;
  title: string;
  draft_enabled: number;
  published_enabled: number;
  draft_blocks_json: string;
  published_blocks_json: string;
  draft_seo_title: string;
  published_seo_title: string;
  draft_seo_description: string;
  published_seo_description: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
}

interface PublishedSitePageRow {
  page_key: string;
  route_path: string;
  title: string;
  published_enabled: number;
  published_blocks_json: string;
  published_seo_title: string;
  published_seo_description: string;
}

function toAdminSitePage(row: SitePageRow): AdminSitePage {
  const draftBlocks = parsePageBlocksJson(row.draft_blocks_json);
  const publishedBlocks = parsePageBlocksJson(row.published_blocks_json);
  return {
    draftBlocks,
    draftEnabled: row.draft_enabled === 1,
    draftSeoDescription: row.draft_seo_description,
    draftSeoTitle: row.draft_seo_title,
    dirty: row.draft_enabled !== row.published_enabled
      || row.draft_blocks_json !== row.published_blocks_json
      || row.draft_seo_title !== row.published_seo_title
      || row.draft_seo_description !== row.published_seo_description,
    pageKey: row.page_key,
    publishedAt: row.published_at,
    publishedBlocks,
    publishedEnabled: row.published_enabled === 1,
    publishedSeoDescription: row.published_seo_description,
    publishedSeoTitle: row.published_seo_title,
    publishedBy: row.published_by,
    routePath: row.route_path,
    title: row.title,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    version: row.version,
  };
}

async function getSiteDatabase(): Promise<D1DatabaseLike> {
  const { env } = await getCloudflareContext({ async: true });
  const database = (env as unknown as { GIACONG_VN_CATALOG?: D1DatabaseLike }).GIACONG_VN_CATALOG;
  if (!database) throw new Error("Missing GIACONG_VN_CATALOG binding.");
  return database;
}

async function writePageAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  action: string,
  entityId: string,
  metadata: unknown,
): Promise<void> {
  await database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, 'site_page', ?, ?)
  `).bind(crypto.randomUUID(), actorSubject, action, entityId, JSON.stringify(metadata)).run();
}

function hasChanged(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return true;
  const meta = (result as { meta?: { changes?: unknown } }).meta;
  return meta?.changes === undefined || Number(meta.changes) > 0;
}

export { PageBuilderValidationError };
