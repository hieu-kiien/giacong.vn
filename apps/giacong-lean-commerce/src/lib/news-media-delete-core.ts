import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import type { NewsMediaAsset, NewsMediaBucketLike } from "./news-media-core.ts";

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

interface ArticleThumbnailRow {
  thumbnail_url: string | null;
}

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

export type DeleteNewsMediaResult =
  | { kind: "deleted"; media: NewsMediaAsset; storageDeleted: boolean }
  | { kind: "in_use"; media: NewsMediaAsset }
  | { kind: "not_found" };

/**
 * Deletes News media without ever removing an object that is still the article thumbnail.
 * D1 is marked first in one audited batch. R2 cleanup happens afterwards so a D1 failure
 * can never leave an active metadata row pointing at a missing object. A failed R2 delete
 * is safe to retry and is also recoverable by the existing orphan cleanup path.
 */
export async function deleteNewsMediaAsset(
  database: D1DatabaseLike,
  bucket: NewsMediaBucketLike,
  input: {
    articleId: number;
    assetId: string;
    deletedBy: string;
  },
): Promise<DeleteNewsMediaResult> {
  const batchDatabase = requireBatch(database);
  const row = await getNewsMediaRow(database, input.articleId, input.assetId);
  if (!row) return { kind: "not_found" };

  const media = toNewsMediaAsset(row);
  if (row.status === "deleted") {
    const storageDeleted = await deleteStorageObject(bucket, row.storage_key);
    return { kind: "deleted", media, storageDeleted };
  }

  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({
    articleId: input.articleId,
    storageKey: row.storage_key,
  });
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'news_media.deleted', 'news_media', m.id, ?
      FROM news_media_assets m
      WHERE m.id = ? AND m.article_id = ? AND m.status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM articles a
          WHERE a.id = m.article_id
            AND a.thumbnail_url = '/media/' || m.storage_key
        )
      RETURNING id
    `).bind(
      auditId,
      input.deletedBy,
      metadataJson,
      input.assetId,
      input.articleId,
    ),
    database.prepare(`
      UPDATE news_media_assets
      SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND article_id = ? AND status = 'active'
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
      RETURNING id
    `).bind(input.assetId, input.articleId, auditId),
  ];

  const results = await batchDatabase.batch(statements);
  if (!oneRowReturned(results[0]?.results)) {
    const latest = await getNewsMediaRow(database, input.articleId, input.assetId);
    if (!latest) return { kind: "not_found" };
    const latestMedia = toNewsMediaAsset(latest);
    if (latest.status === "deleted") {
      const storageDeleted = await deleteStorageObject(bucket, latest.storage_key);
      return { kind: "deleted", media: latestMedia, storageDeleted };
    }

    const article = await database.prepare(`
      SELECT thumbnail_url
      FROM articles
      WHERE id = ?
      LIMIT 1
    `).bind(input.articleId).first<ArticleThumbnailRow>();
    if (article?.thumbnail_url === latestMedia.publicUrl) {
      return { kind: "in_use", media: latestMedia };
    }
    throw new Error("Không thể đánh dấu media bài viết là đã xóa.");
  }

  if (!oneRowReturned(results[1]?.results)) {
    throw new Error("D1 không xác nhận tombstone media bài viết; R2 chưa bị xóa.");
  }

  const latest = await getNewsMediaRow(database, input.articleId, input.assetId);
  if (!latest || latest.status !== "deleted") {
    throw new Error("Không xác minh được tombstone media bài viết; R2 chưa bị xóa.");
  }
  const deletedMedia = toNewsMediaAsset(latest);
  const storageDeleted = await deleteStorageObject(bucket, row.storage_key);
  return { kind: "deleted", media: deletedMedia, storageDeleted };
}

async function getNewsMediaRow(
  database: D1DatabaseLike,
  articleId: number,
  assetId: string,
): Promise<NewsMediaRow | null> {
  return database.prepare(`
    SELECT id, article_id, storage_key, original_filename, content_type,
      byte_size, checksum_sha256, alt_text, status, created_at, updated_at
    FROM news_media_assets
    WHERE id = ? AND article_id = ?
    LIMIT 1
  `).bind(assetId, articleId).first<NewsMediaRow>();
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

async function deleteStorageObject(bucket: NewsMediaBucketLike, storageKey: string): Promise<boolean> {
  try {
    await bucket.delete(storageKey);
    return true;
  } catch {
    return false;
  }
}

function oneRowReturned(rows: unknown[] | undefined): boolean {
  return Array.isArray(rows) && rows.length === 1;
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new Error("D1 batch() là bắt buộc để xóa media bài viết an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
