import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import { extensionForMediaType, type AllowedMediaContentType } from "./media-upload-policy.ts";

export interface NewsMediaBucketLike {
  delete(key: string): Promise<unknown>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    },
  ): Promise<unknown>;
}

export interface NewsMediaAsset {
  altText: string | null;
  articleId: number;
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  createdAt: string;
  id: string;
  originalFilename: string;
  publicUrl: string;
  status: "active" | "deleted";
  storageKey: string;
  updatedAt: string;
}

interface NewsMediaRow {
  alt_text: string | null;
  article_id: number;
  byte_size: number;
  checksum_sha256: string;
  content_type: string;
  created_at: string;
  id: string;
  original_filename: string;
  status: NewsMediaAsset["status"];
  storage_key: string;
  updated_at: string;
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

export async function listNewsMediaAssets(
  database: D1DatabaseLike,
  articleId: number,
  includeDeleted = false,
): Promise<NewsMediaAsset[]> {
  const rows = await database.prepare(`
    SELECT id, article_id, storage_key, original_filename, content_type,
      byte_size, checksum_sha256, alt_text, status, created_at, updated_at
    FROM news_media_assets
    WHERE article_id = ?${includeDeleted ? "" : " AND status = 'active'"}
    ORDER BY created_at DESC, id DESC
  `).bind(articleId).all<NewsMediaRow>();
  return rows.results.map(toNewsMediaAsset);
}

export async function createNewsMediaAsset(
  database: D1DatabaseLike,
  bucket: NewsMediaBucketLike,
  input: {
    altText: string | null;
    articleId: number;
    bytes: ArrayBuffer;
    checksumSha256: string;
    contentType: AllowedMediaContentType;
    createdBy: string;
    originalFilename: string;
  },
): Promise<NewsMediaAsset> {
  const batchDatabase = requireBatch(database);
  const id = crypto.randomUUID();
  const storageKey = `news/articles/${input.articleId}/${id}${extensionForMediaType(input.contentType)}`;

  await bucket.put(storageKey, input.bytes, {
    customMetadata: {
      articleId: String(input.articleId),
      assetId: id,
    },
    httpMetadata: { contentType: input.contentType },
  });

  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO news_media_assets (
        id, article_id, storage_key, original_filename, content_type,
        byte_size, checksum_sha256, alt_text, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      input.articleId,
      storageKey,
      input.originalFilename,
      input.contentType,
      input.bytes.byteLength,
      input.checksumSha256,
      input.altText,
      input.createdBy,
    ),
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      VALUES (?, ?, 'news_media.created', 'news_media', ?, ?)
    `).bind(
      crypto.randomUUID(),
      input.createdBy,
      id,
      JSON.stringify({
        articleId: input.articleId,
        byteSize: input.bytes.byteLength,
        checksumSha256: input.checksumSha256,
        contentType: input.contentType,
      }),
    ),
  ];

  try {
    await batchDatabase.batch(statements);
  } catch (error) {
    await bucket.delete(storageKey).catch(() => undefined);
    throw error;
  }

  const row = await database.prepare(`
    SELECT id, article_id, storage_key, original_filename, content_type,
      byte_size, checksum_sha256, alt_text, status, created_at, updated_at
    FROM news_media_assets
    WHERE id = ?
    LIMIT 1
  `).bind(id).first<NewsMediaRow>();
  if (!row) throw new Error("Không đọc lại được media bài viết vừa upload.");
  return toNewsMediaAsset(row);
}

function toNewsMediaAsset(row: NewsMediaRow): NewsMediaAsset {
  return {
    altText: row.alt_text,
    articleId: row.article_id,
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    contentType: row.content_type,
    createdAt: row.created_at,
    id: row.id,
    originalFilename: row.original_filename,
    publicUrl: `/media/${row.storage_key}`,
    status: row.status,
    storageKey: row.storage_key,
    updatedAt: row.updated_at,
  };
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new Error("D1 batch() là bắt buộc để lưu media bài viết an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
