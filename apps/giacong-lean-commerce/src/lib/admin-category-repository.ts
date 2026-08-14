import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  canonicalMutationPayload,
  decodeAdminVersion,
  encodeAdminVersion,
  normalizeCategoryInput,
} from "./admin-category.ts";

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1DatabaseLike {
  prepare(sql: string): D1Statement;
  batch<T extends D1Statement>(statements: T[]): Promise<unknown>;
}

interface CloudflareEnv { GIACONG_VN_CATALOG?: D1DatabaseLike }

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  version: string;
  updatedAt: string;
}

interface CategoryRow {
  id: number; name: string; slug: string; description: string; image_url: string | null;
  sort_order: number; is_active: number; revision: number; updated_at: string;
}

export class AdminCategoryConflictError extends Error {}
export class AdminCategoryNotFoundError extends Error {}
export class AdminCategoryValidationError extends Error {}
export class AdminCategoryIdempotencyConflictError extends Error {}

export async function listCategories(page: number, pageSize: number): Promise<{ categories: AdminCategory[]; total: number }> {
  const db = getDatabase();
  const count = await db.prepare("SELECT COUNT(*) AS total FROM categories").first<{ total: number }>();
  const result = await db.prepare(`
    SELECT id, name, slug, description, image_url, sort_order, is_active, revision, updated_at
    FROM categories ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC LIMIT ? OFFSET ?
  `).bind(pageSize, (page - 1) * pageSize).all<CategoryRow>();
  return { categories: result.results.map(toCategory), total: Number(count?.total ?? 0) };
}

export async function getCategory(id: number): Promise<AdminCategory | null> {
  const row = await getDatabase().prepare(`
    SELECT id, name, slug, description, image_url, sort_order, is_active, revision, updated_at
    FROM categories WHERE id = ? LIMIT 1
  `).bind(id).first<CategoryRow>();
  return row ? toCategory(row) : null;
}

export async function createCategory(input: unknown, actorSubject: string, requestId: string): Promise<AdminCategory> {
  const category = normalizeCategoryInput(input);
  const db = getDatabase();
  const payloadHash = await sha256(canonicalMutationPayload(category));
  const idempotency = await existingAudit(db, requestId, payloadHash);
  if (idempotency) {
    if (idempotency.entityType !== "category") throw new AdminCategoryIdempotencyConflictError("Request ID already used.");
    const replay = await getCategory(Number(idempotency.entityKey));
    if (!replay) throw new AdminCategoryNotFoundError("Category not found.");
    return replay;
  }

  const existing = await db.prepare("SELECT id FROM categories WHERE slug = ? LIMIT 1").bind(category.slug).first<{ id: number }>();
  if (existing) throw new AdminCategoryConflictError("Category slug already exists.");

  const statements = [
    db.prepare(`
      INSERT INTO categories (name, slug, description, image_url, sort_order, is_active, revision)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(category.name, category.slug, category.description, category.imageUrl, category.sortOrder, category.isActive ? 1 : 0),
    db.prepare(`
      INSERT INTO admin_audit_log
        (request_id, actor_subject, action, entity_type, entity_key, previous_revision, resulting_revision, payload_sha256)
      VALUES (?, ?, 'create', 'category', CAST((SELECT id FROM categories WHERE slug = ?) AS TEXT), NULL, 1, ?)
    `).bind(requestId, actorSubject, category.slug, payloadHash),
  ];
  await db.batch(statements);

  const created = await db.prepare("SELECT id FROM categories WHERE slug = ? LIMIT 1").bind(category.slug).first<{ id: number }>();
  if (!created) throw new Error("Created category could not be loaded.");
  const result = await getCategory(created.id);
  if (!result) throw new Error("Created category could not be loaded.");
  return result;
}

export async function updateCategory(id: number, raw: unknown, actorSubject: string, requestId: string): Promise<AdminCategory> {
  if (!isRecord(raw)) throw new AdminCategoryValidationError("Invalid category request.");
  const version = decodeAdminVersion(raw.version);
  const category = normalizeCategoryInput(raw);
  const db = getDatabase();
  const payloadHash = await sha256(canonicalMutationPayload(category));
  const idempotency = await existingAudit(db, requestId, payloadHash);
  if (idempotency) {
    if (idempotency.entityType !== "category" || idempotency.entityKey !== String(id)) throw new AdminCategoryIdempotencyConflictError("Request ID already used.");
    const replay = await getCategory(id);
    if (!replay) throw new AdminCategoryNotFoundError("Category not found.");
    return replay;
  }

  const existing = await getCategory(id);
  if (!existing) throw new AdminCategoryNotFoundError("Category not found.");
  const slugOwner = await db.prepare("SELECT id FROM categories WHERE slug = ? AND id <> ? LIMIT 1").bind(category.slug, id).first<{ id: number }>();
  if (slugOwner) throw new AdminCategoryConflictError("Category slug already exists.");

  await db.batch([
    db.prepare(`
      UPDATE categories
      SET name = ?, slug = ?, description = ?, image_url = ?, sort_order = ?, is_active = ?,
          revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND revision = ?
    `).bind(category.name, category.slug, category.description, category.imageUrl, category.sortOrder, category.isActive ? 1 : 0, id, version),
    db.prepare(`
      INSERT INTO admin_audit_log
        (request_id, actor_subject, action, entity_type, entity_key, previous_revision, resulting_revision, payload_sha256)
      SELECT ?, ?, 'update', 'category', CAST(id AS TEXT), revision - 1, revision, ?
      FROM categories WHERE id = ? AND revision = ?
    `).bind(requestId, actorSubject, payloadHash, id, version + 1),
  ]);

  const result = await getCategory(id);
  if (!result) throw new AdminCategoryNotFoundError("Category not found.");
  if (result.version !== encodeAdminVersion(version + 1)) throw new AdminCategoryConflictError("Category was changed by another operator.");
  return result;
}

function getDatabase(): D1DatabaseLike {
  const { env } = getCloudflareContext();
  const db = (env as unknown as CloudflareEnv).GIACONG_VN_CATALOG;
  if (!db) throw new Error("Missing D1 catalog binding.");
  return db;
}

async function existingAudit(db: D1DatabaseLike, requestId: string, payloadHash: string): Promise<{ entityType: string; entityKey: string } | null> {
  const row = await db.prepare("SELECT entity_type AS entityType, entity_key AS entityKey, payload_sha256 AS payloadHash FROM admin_audit_log WHERE request_id = ? LIMIT 1").bind(requestId).first<{ entityType: string; entityKey: string; payloadHash: string }>();
  if (!row) return null;
  if (row.payloadHash !== payloadHash) throw new AdminCategoryIdempotencyConflictError("Request ID already used with different payload.");
  return row;
}

function toCategory(row: CategoryRow): AdminCategory {
  return {
    description: row.description ?? "", id: row.id, imageUrl: row.image_url,
    isActive: row.is_active === 1, name: row.name, slug: row.slug, sortOrder: row.sort_order,
    updatedAt: row.updated_at, version: encodeAdminVersion(row.revision),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
