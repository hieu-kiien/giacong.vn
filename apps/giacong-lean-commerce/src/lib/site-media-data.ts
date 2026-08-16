import "server-only";

import type { D1DatabaseLike } from "./admin-data";
import type { R2BucketLike } from "./media-data";

export interface SiteMediaAsset {
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  createdAt: string;
  id: string;
  originalFilename: string;
  settingKey: string;
  status: "active" | "deleted" | "replaced";
  storageKey: string;
  publicUrl: string;
}

interface SiteMediaRow {
  byte_size: number;
  checksum_sha256: string;
  content_type: string;
  created_at: string;
  id: string;
  original_filename: string;
  setting_key: string;
  status: SiteMediaAsset["status"];
  storage_key: string;
}

export async function createSiteMediaAsset(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  input: {
    bytes: ArrayBuffer;
    checksumSha256: string;
    contentType: string;
    createdBy: string;
    originalFilename: string;
    settingKey: string;
  },
): Promise<SiteMediaAsset> {
  const id = crypto.randomUUID();
  const storageKey = `site-settings/${input.settingKey}/${id}${extensionFor(input.contentType)}`;

  await bucket.put(storageKey, input.bytes, {
    customMetadata: { assetId: id, settingKey: input.settingKey },
    httpMetadata: { contentType: input.contentType },
  });

  try {
    await database.prepare(`
      INSERT INTO site_media_assets (
        id, setting_key, storage_key, original_filename, content_type,
        byte_size, checksum_sha256, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      input.settingKey,
      storageKey,
      input.originalFilename,
      input.contentType,
      input.bytes.byteLength,
      input.checksumSha256,
      input.createdBy,
    ).run();
  } catch (error) {
    await bucket.delete(storageKey).catch(() => undefined);
    throw error;
  }

  const row = await getSiteMediaRow(database, id);
  if (!row) throw new Error("Không đọc lại được media website vừa upload.");
  return toSiteMediaAsset(row);
}

export async function replaceActiveSiteMedia(
  database: D1DatabaseLike,
  settingKey: string,
  exceptId: string,
): Promise<void> {
  await database.prepare(`
    UPDATE site_media_assets
    SET status = 'replaced', updated_at = CURRENT_TIMESTAMP
    WHERE setting_key = ? AND status = 'active' AND id <> ?
  `).bind(settingKey, exceptId).run();
}

export async function deleteSiteMediaAsset(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  assetId: string,
): Promise<void> {
  const row = await getSiteMediaRow(database, assetId);
  if (!row) return;
  await bucket.delete(row.storage_key);
  await database.prepare(`
    UPDATE site_media_assets
    SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(assetId).run();
}

async function getSiteMediaRow(database: D1DatabaseLike, id: string): Promise<SiteMediaRow | null> {
  return database.prepare(`
    SELECT id, setting_key, storage_key, original_filename, content_type,
      byte_size, checksum_sha256, status, created_at
    FROM site_media_assets WHERE id = ? LIMIT 1
  `).bind(id).first<SiteMediaRow>();
}

function toSiteMediaAsset(row: SiteMediaRow): SiteMediaAsset {
  return {
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    contentType: row.content_type,
    createdAt: row.created_at,
    id: row.id,
    originalFilename: row.original_filename,
    publicUrl: `/media/${row.storage_key}`,
    settingKey: row.setting_key,
    status: row.status,
    storageKey: row.storage_key,
  };
}

function extensionFor(contentType: string): string {
  return contentType === "image/jpeg" ? ".jpg"
    : contentType === "image/png" ? ".png"
      : contentType === "image/webp" ? ".webp"
        : ".avif";
}