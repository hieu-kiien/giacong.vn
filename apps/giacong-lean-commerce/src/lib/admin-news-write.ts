import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./admin-data.ts";
import type {
  AdminNewsCategoryInput,
  AdminNewsInput,
} from "./admin-news-input.ts";

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

export class AdminNewsStaleWriteError extends Error {
  constructor() {
    super("Bài viết đã thay đổi. Hãy tải lại trước khi lưu.");
    this.name = "AdminNewsStaleWriteError";
  }
}

export class AdminNewsCategoryStaleWriteError extends Error {
  constructor() {
    super("Chuyên mục đã thay đổi. Hãy tải lại trước khi lưu.");
    this.name = "AdminNewsCategoryStaleWriteError";
  }
}

export class AdminNewsCategoryConflictError extends Error {
  constructor() {
    super("Chuyên mục không thể xóa vì đã thay đổi hoặc đang được bài viết sử dụng.");
    this.name = "AdminNewsCategoryConflictError";
  }
}

export class AdminNewsAtomicWriteError extends Error {}

export async function createAdminNewsArticleAtomically(
  database: D1DatabaseLike,
  input: AdminNewsInput,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `).bind(
      input.categoryId,
      input.title,
      input.slug,
      input.excerpt,
      input.contentText,
      input.thumbnailUrl,
      input.status,
      input.featured ? 1 : 0,
      input.seoTitle,
      input.seoDescription,
      actorSubject,
      actorSubject,
    ),
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'news.article.created', 'news_article', CAST(id AS TEXT), ?
      FROM articles
      WHERE slug = ? AND archived_at IS NULL
      LIMIT 1
    `).bind(auditId, actorSubject, JSON.stringify({ input }), input.slug),
  ];

  const results = await batchDatabase.batch(statements);
  const createdId = returningPositiveInteger(results[0]?.results, "id");
  if (!createdId) throw new AdminNewsAtomicWriteError("Không đọc được ID bài viết vừa tạo.");
  return createdId;
}

export async function updateAdminNewsArticleAtomically(
  database: D1DatabaseLike,
  articleId: number,
  input: AdminNewsInput,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "cập nhật", "bài viết");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ after: input, articleId, expectedRevision });

  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(database, auditId, actorSubject, "news.article.updated", articleId, expectedRevision, metadataJson),
    database.prepare(`
      UPDATE articles
      SET category_id = ?, title = ?, slug = ?, excerpt = ?, content_text = ?,
        thumbnail_url = ?, status = ?, is_featured = ?, seo_title = ?, seo_description = ?,
        published_at = CASE
          WHEN ? = 'published' THEN COALESCE(?, published_at, CURRENT_TIMESTAMP)
          ELSE NULL
        END,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
      WHERE id = ? AND revision = ? AND archived_at IS NULL
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      input.categoryId,
      input.title,
      input.slug,
      input.excerpt,
      input.contentText,
      input.thumbnailUrl,
      input.status,
      input.featured ? 1 : 0,
      input.seoTitle,
      input.seoDescription,
      input.status,
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

export async function archiveAdminNewsArticleAtomically(
  database: D1DatabaseLike,
  articleId: number,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "lưu trữ", "bài viết");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ articleId, expectedRevision });

  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(database, auditId, actorSubject, "news.article.archived", articleId, expectedRevision, metadataJson),
    database.prepare(`
      UPDATE articles
      SET archived_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP,
        revision = revision + 1
      WHERE id = ? AND revision = ? AND archived_at IS NULL
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(actorSubject, articleId, expectedRevision, auditId),
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
      INSERT INTO article_categories (
        name, slug, description, sort_order, is_active, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `).bind(
      input.name,
      input.slug,
      input.description,
      input.sortOrder,
      input.active ? 1 : 0,
    ),
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'news.category.created', 'news_category', CAST(id AS TEXT), ?
      FROM article_categories
      WHERE slug = ?
      LIMIT 1
    `).bind(auditId, actorSubject, JSON.stringify({ input }), input.slug),
  ];

  const results = await batchDatabase.batch(statements);
  const createdId = returningPositiveInteger(results[0]?.results, "id");
  if (!createdId) throw new AdminNewsAtomicWriteError("Không đọc được ID chuyên mục vừa tạo.");
  return createdId;
}

export async function updateAdminNewsCategoryAtomically(
  database: D1DatabaseLike,
  categoryId: number,
  input: AdminNewsCategoryInput,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "cập nhật", "chuyên mục");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ after: input, categoryId, expectedRevision });
  const statements: D1PreparedStatementLike[] = [
    categoryRevisionAuditMarker(
      database,
      auditId,
      actorSubject,
      "news.category.updated",
      categoryId,
      expectedRevision,
      metadataJson,
    ),
    database.prepare(`
      UPDATE article_categories
      SET name = ?, slug = ?, description = ?, sort_order = ?, is_active = ?,
        updated_at = CURRENT_TIMESTAMP, revision = revision + 1
      WHERE id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      input.name,
      input.slug,
      input.description,
      input.sortOrder,
      input.active ? 1 : 0,
      categoryId,
      expectedRevision,
      auditId,
    ),
  ];

  const results = await batchDatabase.batch(statements);
  assertCategoryMarkerCreated(results[0]?.results);
}

export async function deleteAdminNewsCategoryAtomically(
  database: D1DatabaseLike,
  categoryId: number,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "xóa", "chuyên mục");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ categoryId, expectedRevision });
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'news.category.deleted', 'news_category', CAST(c.id AS TEXT), ?
      FROM article_categories c
      WHERE c.id = ? AND c.revision = ?
        AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.category_id = c.id)
      RETURNING id
    `).bind(auditId, actorSubject, metadataJson, categoryId, expectedRevision),
    database.prepare(`
      DELETE FROM article_categories
      WHERE id = ? AND revision = ?
        AND NOT EXISTS (SELECT 1 FROM articles WHERE category_id = ?)
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(categoryId, expectedRevision, categoryId, auditId),
  ];

  const results = await batchDatabase.batch(statements);
  if (!Array.isArray(results[0]?.results) || results[0]?.results.length !== 1) {
    throw new AdminNewsCategoryConflictError();
  }
}

function revisionAuditMarker(
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
    SELECT ?, ?, ?, 'news_article', ?, ?
    WHERE EXISTS (
      SELECT 1 FROM articles
      WHERE id = ? AND revision = ? AND archived_at IS NULL
    )
    RETURNING id
  `).bind(
    auditId,
    actorSubject,
    action,
    String(articleId),
    metadataJson,
    articleId,
    expectedRevision,
  );
}

function categoryRevisionAuditMarker(
  database: D1DatabaseLike,
  auditId: string,
  actorSubject: string,
  action: string,
  categoryId: number,
  expectedRevision: number,
  metadataJson: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, ?, 'news_category', ?, ?
    WHERE EXISTS (
      SELECT 1 FROM article_categories
      WHERE id = ? AND revision = ?
    )
    RETURNING id
  `).bind(
    auditId,
    actorSubject,
    action,
    String(categoryId),
    metadataJson,
    categoryId,
    expectedRevision,
  );
}

function assertArticleMarkerCreated(rows: unknown[] | undefined): void {
  if (!Array.isArray(rows) || rows.length !== 1) throw new AdminNewsStaleWriteError();
}

function assertCategoryMarkerCreated(rows: unknown[] | undefined): void {
  if (!Array.isArray(rows) || rows.length !== 1) throw new AdminNewsCategoryStaleWriteError();
}

function returningPositiveInteger(rows: unknown[] | undefined, key: string): number | null {
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0];
  if (typeof row !== "object" || row === null || Array.isArray(row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function requireRevision(value: unknown, action: string, entityLabel: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new AdminNewsAtomicWriteError(`Revision hiện tại là bắt buộc khi ${action} ${entityLabel}.`);
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
