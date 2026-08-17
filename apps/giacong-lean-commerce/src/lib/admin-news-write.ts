import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import type { AdminNewsArticleInput, AdminNewsCategoryInput } from "./admin-news-data.ts";

interface D1BatchResultLike { results?: unknown[]; }
interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

export class AdminNewsStaleWriteError extends Error {
  constructor() {
    super("Bài viết đã thay đổi. Hãy tải lại trước khi lưu.");
    this.name = "AdminNewsStaleWriteError";
  }
}

export class AdminNewsAtomicWriteError extends Error {}

export async function createAdminNewsArticleAtomically(
  database: D1DatabaseLike,
  input: AdminNewsArticleInput,
  actorSubject: string,
): Promise<number> {
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO articles (
        category_id, title, slug, excerpt, content_text, thumbnail_url, status,
        is_featured, seo_title, seo_description, published_at, revision,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `).bind(
      input.categoryId,
      input.title,
      input.slug,
      input.excerpt,
      input.contentText,
      input.thumbnailUrl,
      input.status,
      input.isFeatured ? 1 : 0,
      input.seoTitle,
      input.seoDescription,
      input.publishedAt,
      actorSubject,
      actorSubject,
    ),
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'article.created', 'article', CAST(id AS TEXT), ?
      FROM articles
      WHERE slug = ?
      LIMIT 1
    `).bind(auditId, actorSubject, JSON.stringify({ input }), input.slug),
  ];

  const results = await batchDatabase.batch(statements);
  const id = returningPositiveInteger(results[0]?.results, "id");
  if (!id) throw new AdminNewsAtomicWriteError("Không đọc được ID bài viết vừa tạo.");
  return id;
}

export async function updateAdminNewsArticleAtomically(
  database: D1DatabaseLike,
  articleId: number,
  input: AdminNewsArticleInput,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "cập nhật");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ after: input, articleId, expectedRevision });

  const statements: D1PreparedStatementLike[] = [
    articleRevisionAuditMarker(database, auditId, actorSubject, "article.updated", articleId, expectedRevision, metadataJson),
    database.prepare(`
      UPDATE articles
      SET category_id = ?, title = ?, slug = ?, excerpt = ?, content_text = ?, thumbnail_url = ?,
        status = ?, is_featured = ?, seo_title = ?, seo_description = ?, published_at = ?,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
      WHERE id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      input.categoryId,
      input.title,
      input.slug,
      input.excerpt,
      input.contentText,
      input.thumbnailUrl,
      input.status,
      input.isFeatured ? 1 : 0,
      input.seoTitle,
      input.seoDescription,
      input.publishedAt,
      actorSubject,
      articleId,
      expectedRevision,
      auditId,
    ),
  ];

  const results = await batchDatabase.batch(statements);
  assertArticleMarkerCreated(results[0]?.results);
}

export async function deleteAdminNewsArticleAtomically(
  database: D1DatabaseLike,
  articleId: number,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "xóa");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ articleId, expectedRevision });
  const statements: D1PreparedStatementLike[] = [
    articleRevisionAuditMarker(database, auditId, actorSubject, "article.deleted", articleId, expectedRevision, metadataJson),
    database.prepare(`
      DELETE FROM articles
      WHERE id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(articleId, expectedRevision, auditId),
  ];
  const results = await batchDatabase.batch(statements);
  assertArticleMarkerCreated(results[0]?.results);
}

export async function createAdminNewsCategoryAtomically(
  database: D1DatabaseLike,
  input: AdminNewsCategoryInput,
  actorSubject: string,
): Promise<number> {
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO article_categories (name, slug, description, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `).bind(input.name, input.slug, input.description, input.sortOrder, input.isActive ? 1 : 0),
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'article_category.created', 'article_category', CAST(id AS TEXT), ?
      FROM article_categories
      WHERE slug = ?
      LIMIT 1
    `).bind(auditId, actorSubject, JSON.stringify({ input }), input.slug),
  ];
  const results = await batchDatabase.batch(statements);
  const id = returningPositiveInteger(results[0]?.results, "id");
  if (!id) throw new AdminNewsAtomicWriteError("Không đọc được ID danh mục vừa tạo.");
  return id;
}

export async function updateAdminNewsCategoryAtomically(
  database: D1DatabaseLike,
  categoryId: number,
  input: AdminNewsCategoryInput,
  actorSubject: string,
): Promise<void> {
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'article_category.updated', 'article_category', CAST(id AS TEXT), ?
      FROM article_categories
      WHERE id = ?
      RETURNING id
    `).bind(auditId, actorSubject, JSON.stringify({ after: input, categoryId }), categoryId),
    database.prepare(`
      UPDATE article_categories
      SET name = ?, slug = ?, description = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(input.name, input.slug, input.description, input.sortOrder, input.isActive ? 1 : 0, categoryId, auditId),
  ];
  const results = await batchDatabase.batch(statements);
  assertCategoryMarkerCreated(results[0]?.results);
}

export async function deleteAdminNewsCategoryAtomically(
  database: D1DatabaseLike,
  categoryId: number,
  actorSubject: string,
): Promise<void> {
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'article_category.deleted', 'article_category', CAST(id AS TEXT), ?
      FROM article_categories
      WHERE id = ?
      RETURNING id
    `).bind(auditId, actorSubject, JSON.stringify({ categoryId }), categoryId),
    database.prepare(`
      DELETE FROM article_categories
      WHERE id = ? AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(categoryId, auditId),
  ];
  const results = await batchDatabase.batch(statements);
  assertCategoryMarkerCreated(results[0]?.results);
}

function articleRevisionAuditMarker(
  database: D1DatabaseLike,
  auditId: string,
  actorSubject: string,
  action: string,
  articleId: number,
  expectedRevision: number,
  metadataJson: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, ?, 'article', CAST(id AS TEXT), ?
    FROM articles
    WHERE id = ? AND revision = ?
    RETURNING id
  `).bind(auditId, actorSubject, action, metadataJson, articleId, expectedRevision);
}

function assertArticleMarkerCreated(rows: unknown[] | undefined): void {
  if (!Array.isArray(rows) || rows.length !== 1) throw new AdminNewsStaleWriteError();
}

function assertCategoryMarkerCreated(rows: unknown[] | undefined): void {
  if (!Array.isArray(rows) || rows.length !== 1) throw new AdminNewsAtomicWriteError("Danh mục không còn tồn tại.");
}

function returningPositiveInteger(rows: unknown[] | undefined, key: string): number | null {
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0];
  if (typeof row !== "object" || row === null || Array.isArray(row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function requireRevision(value: unknown, action: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new AdminNewsAtomicWriteError(`Revision hiện tại là bắt buộc khi ${action} bài viết.`);
  }
  return Number(value);
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new AdminNewsAtomicWriteError("D1 batch() là bắt buộc để ghi News an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
