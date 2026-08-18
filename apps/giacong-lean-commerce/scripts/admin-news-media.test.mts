import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createNewsMediaAsset } from "../src/lib/news-media-core.ts";

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
    if (this.query.includes("FROM news_media_assets") && this.query.includes("WHERE id = ?")) {
      return (this.database.media.get(String(this.values[0])) ?? null) as T | null;
    }
    return null;
  }

  async run() {
    throw new Error("News media create must use D1 batch, not statement.run().");
  }
}

class FakeDatabase {
  readonly batches: FakeStatement[][] = [];
  readonly media = new Map<string, NewsMediaRow>();
  throwOnBatch = false;

  prepare(query: string) {
    return new FakeStatement(this, query);
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    if (this.throwOnBatch) throw new Error("simulated D1 batch failure");

    for (const statement of statements) {
      if (!statement.query.includes("INSERT INTO news_media_assets")) continue;
      const id = String(statement.values[0]);
      this.media.set(id, {
        alt_text: statement.values[7] === null ? null : String(statement.values[7]),
        article_id: Number(statement.values[1]),
        byte_size: Number(statement.values[5]),
        checksum_sha256: String(statement.values[6]),
        content_type: String(statement.values[4]),
        created_at: "2026-08-18 00:00:00",
        id,
        original_filename: String(statement.values[3]),
        status: "active",
        storage_key: String(statement.values[2]),
        updated_at: "2026-08-18 00:00:00",
      });
    }
    return statements.map(() => ({ results: [] }));
  }
}

class FakeBucket {
  readonly puts: string[] = [];
  readonly deletes: string[] = [];

  async put(key: string) {
    this.puts.push(key);
  }

  async delete(key: string) {
    this.deletes.push(key);
  }
}

const upload = {
  altText: "Ảnh đại diện bài viết",
  articleId: 42,
  bytes: new Uint8Array([1, 2, 3, 4]).buffer,
  checksumSha256: "abc123",
  contentType: "image/webp" as const,
  createdBy: "owner@example.com",
  originalFilename: "thumbnail.webp",
};

test("News media upload writes the article-scoped R2 key and D1 audit atomically", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();

  const media = await createNewsMediaAsset(database, bucket, upload);

  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0]?.length, 2, "media row and audit log must share one D1 batch");
  assert.match(database.batches[0]?.[0]?.query ?? "", /INSERT INTO news_media_assets/);
  assert.match(database.batches[0]?.[1]?.query ?? "", /'news_media\.created', 'news_media'/);
  assert.equal(bucket.puts.length, 1);
  assert.match(bucket.puts[0] ?? "", /^news\/articles\/42\/[0-9a-f-]+\.webp$/);
  assert.equal(media.articleId, 42);
  assert.equal(media.publicUrl, `/media/${bucket.puts[0]}`);
  assert.equal(media.altText, upload.altText);
});

test("News media compensates the R2 upload when the D1 batch fails", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();
  database.throwOnBatch = true;

  await assert.rejects(createNewsMediaAsset(database, bucket, upload), /simulated D1 batch failure/);
  assert.equal(bucket.puts.length, 1);
  assert.deepEqual(bucket.deletes, bucket.puts);
  assert.equal(database.media.size, 0);
});

test("News media requires D1 batch before any R2 upload begins", async () => {
  const source = new FakeDatabase();
  const database = { prepare: source.prepare.bind(source) };
  const bucket = new FakeBucket();

  await assert.rejects(createNewsMediaAsset(database, bucket, upload), /D1 batch\(\) là bắt buộc/);
  assert.equal(bucket.puts.length, 0);
});

test("News media API validates the article and file but does not silently mutate thumbnailUrl", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/news/[id]/media/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /getAdminNewsArticle\(guard\.database, articleId\)/);
  assert.match(route, /article\.archivedAt/);
  assert.match(route, /validateMediaFileMetadata/);
  assert.match(route, /validateMediaBytes/);
  assert.match(route, /createNewsMediaAsset/);
  assert.match(route, /role === "owner" \|\| role === "content_manager"/);
  assert.doesNotMatch(route, /updateAdminNewsArticle|thumbnailUrl\s*:/);
});

test("News media migration and R2 cleanup know the new asset table", async () => {
  const [migration, mediaData] = await Promise.all([
    readFile(new URL("../migrations/0009_news_media_assets.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/media-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS news_media_assets/);
  assert.match(migration, /FOREIGN KEY \(article_id\) REFERENCES articles\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /CHECK \(status IN \('active', 'deleted'\)\)/);
  assert.match(mediaData, /FROM news_media_assets/);
  assert.match(mediaData, /knownNewsRows\.results/);
});
