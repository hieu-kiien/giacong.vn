import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { deleteNewsMediaAsset } from "../src/lib/news-media-delete-core.ts";

type NewsMediaRow = {
  alt_text: string | null;
  article_id: number;
  byte_size: number;
  checksum_sha256: string;
  content_type: string;
  created_at: string;
  id: string;
  original_filename: string;
  status: "active" | "deleted";
  storage_key: string;
  updated_at: string;
};

class FakeStatement {
  readonly database: FakeDatabase;
  readonly query: string;
  values: unknown[] = [];

  constructor(database: FakeDatabase, query: string) {
    this.database = database;
    this.query = query.replace(/\s+/g, " ").trim();
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    return { results: [] as T[] };
  }

  async first<T>() {
    if (this.query.includes("FROM news_media_assets") && this.query.includes("WHERE id = ? AND article_id = ?")) {
      const row = this.database.media.get(String(this.values[0]));
      if (!row || row.article_id !== Number(this.values[1])) return null;
      return row as T;
    }
    if (this.query.includes("SELECT thumbnail_url") && this.query.includes("FROM articles")) {
      return ({ thumbnail_url: this.database.articleThumbnails.get(Number(this.values[0])) ?? null }) as T;
    }
    return null;
  }

  async run() {
    throw new Error("News media delete must use D1 batch, not statement.run().");
  }
}

class FakeDatabase {
  readonly articleThumbnails = new Map<number, string | null>();
  readonly auditIds = new Set<string>();
  readonly batches: FakeStatement[][] = [];
  readonly media = new Map<string, NewsMediaRow>();
  confirmTombstone = true;

  prepare(query: string) {
    return new FakeStatement(this, query);
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    const marker = statements[0];
    const update = statements[1];
    const assetId = String(marker?.values[3]);
    const articleId = Number(marker?.values[4]);
    const row = this.media.get(assetId);
    const publicUrl = row ? `/media/${row.storage_key}` : "";
    const allowed = Boolean(
      row
      && row.article_id === articleId
      && row.status === "active"
      && this.articleThumbnails.get(articleId) !== publicUrl,
    );

    const markerResults: unknown[] = [];
    const updateResults: unknown[] = [];
    if (allowed && marker) {
      const auditId = String(marker.values[0]);
      this.auditIds.add(auditId);
      markerResults.push({ id: auditId });
    }

    if (allowed && row && update && this.auditIds.has(String(update.values[2]))) {
      row.status = "deleted";
      row.updated_at = "2026-08-18 04:00:00";
      if (this.confirmTombstone) updateResults.push({ id: row.id });
    }

    return [{ results: markerResults }, { results: updateResults }];
  }
}

class FakeBucket {
  readonly deletes: string[] = [];
  failDelete = false;

  async put() {}

  async delete(key: string) {
    this.deletes.push(key);
    if (this.failDelete) throw new Error("simulated R2 delete failure");
  }
}

function mediaRow(): NewsMediaRow {
  return {
    alt_text: "Thumbnail",
    article_id: 42,
    byte_size: 1234,
    checksum_sha256: "abc123",
    content_type: "image/webp",
    created_at: "2026-08-18 03:00:00",
    id: "11111111-2222-4333-8444-555555555555",
    original_filename: "thumbnail.webp",
    status: "active",
    storage_key: "news/articles/42/11111111-2222-4333-8444-555555555555.webp",
    updated_at: "2026-08-18 03:00:00",
  };
}

test("News media delete blocks an asset that is still the article thumbnail", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();
  const row = mediaRow();
  database.media.set(row.id, row);
  database.articleThumbnails.set(42, `/media/${row.storage_key}`);

  const result = await deleteNewsMediaAsset(database, bucket, {
    articleId: 42,
    assetId: row.id,
    deletedBy: "owner@example.com",
  });

  assert.equal(result.kind, "in_use");
  assert.equal(database.media.get(row.id)?.status, "active");
  assert.equal(database.auditIds.size, 0);
  assert.deepEqual(bucket.deletes, []);
});

test("News media delete writes an audit marker and confirmed D1 tombstone before R2 cleanup", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();
  const row = mediaRow();
  database.media.set(row.id, row);
  database.articleThumbnails.set(42, "/media/news/articles/42/other.webp");

  const result = await deleteNewsMediaAsset(database, bucket, {
    articleId: 42,
    assetId: row.id,
    deletedBy: "owner@example.com",
  });

  assert.equal(result.kind, "deleted");
  if (result.kind !== "deleted") return;
  assert.equal(result.storageDeleted, true);
  assert.equal(database.media.get(row.id)?.status, "deleted");
  assert.equal(database.auditIds.size, 1);
  assert.equal(database.batches.length, 1);
  assert.match(database.batches[0]?.[0]?.query ?? "", /'news_media\.deleted', 'news_media'/);
  assert.match(database.batches[0]?.[0]?.query ?? "", /a\.thumbnail_url = '\/media\/' \|\| m\.storage_key/);
  assert.match(database.batches[0]?.[1]?.query ?? "", /status = 'deleted'/);
  assert.match(database.batches[0]?.[1]?.query ?? "", /RETURNING id/);
  assert.deepEqual(bucket.deletes, [row.storage_key]);
});

test("News media delete never touches R2 without tombstone confirmation", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();
  const row = mediaRow();
  database.media.set(row.id, row);
  database.articleThumbnails.set(42, null);
  database.confirmTombstone = false;

  await assert.rejects(
    deleteNewsMediaAsset(database, bucket, {
      articleId: 42,
      assetId: row.id,
      deletedBy: "owner@example.com",
    }),
    /D1 không xác nhận tombstone/,
  );
  assert.deepEqual(bucket.deletes, []);
});

test("News media delete keeps the D1 tombstone when R2 cleanup must be retried", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();
  const row = mediaRow();
  database.media.set(row.id, row);
  database.articleThumbnails.set(42, null);
  bucket.failDelete = true;

  const result = await deleteNewsMediaAsset(database, bucket, {
    articleId: 42,
    assetId: row.id,
    deletedBy: "owner@example.com",
  });

  assert.equal(result.kind, "deleted");
  if (result.kind !== "deleted") return;
  assert.equal(result.storageDeleted, false);
  assert.equal(database.media.get(row.id)?.status, "deleted");
  assert.deepEqual(bucket.deletes, [row.storage_key]);
});

test("News media reference migration closes stale-editor references and delete API exposes MEDIA_IN_USE", async () => {
  const [migration, route] = await Promise.all([
    readFile(new URL("../migrations/0010_news_media_reference_guard.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/news/[id]/media/[assetId]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS trg_articles_news_media_thumbnail_insert/);
  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS trg_articles_news_media_thumbnail_update/);
  assert.match(migration, /m\.article_id = NEW\.id/);
  assert.match(migration, /m\.status = 'active'/);
  assert.match(migration, /INVALID_NEWS_MEDIA_REFERENCE/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /deleteNewsMediaAsset/);
  assert.match(route, /MEDIA_IN_USE/);
  assert.match(route, /role === "owner" \|\| role === "content_manager"/);
});
