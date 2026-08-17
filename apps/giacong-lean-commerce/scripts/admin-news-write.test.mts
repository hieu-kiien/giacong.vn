import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseAdminNewsPayload } from "../src/lib/admin-news-input.ts";
import {
  AdminNewsStaleWriteError,
  archiveAdminNewsArticleAtomically,
  createAdminNewsArticleAtomically,
  updateAdminNewsArticleAtomically,
} from "../src/lib/admin-news-write.ts";

class FakeStatement {
  readonly query: string;
  values: unknown[] = [];
  runCalls = 0;

  constructor(query: string) {
    this.query = query.replace(/\s+/g, " ").trim();
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() { return { results: [] as T[] }; }
  async first<T>() { return null as T | null; }
  async run() {
    this.runCalls += 1;
    throw new Error("atomic News write must not call statement.run()");
  }
}

class FakeBatchDatabase {
  readonly prepared: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];
  firstRows: unknown[];

  constructor(firstRows: unknown[] = [{ id: "audit-marker" }]) {
    this.firstRows = firstRows;
  }

  prepare(query: string) {
    const statement = new FakeStatement(query);
    this.prepared.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    return statements.map((_, index) => ({ results: index === 0 ? this.firstRows : [] }));
  }
}

const input = {
  categoryId: 1,
  contentText: "Nội dung bài viết đủ để xuất bản.",
  excerpt: "Tóm tắt",
  featured: true,
  publishedAt: "2026-08-18 03:30:00",
  seoDescription: "Mô tả SEO",
  seoTitle: "SEO title",
  slug: "bai-viet-demo",
  status: "published" as const,
  thumbnailUrl: "/media/news/demo.webp",
  title: "Bài viết demo",
};

const repoRoot = path.join(import.meta.dirname, "..");

function assertNoIndividualWrites(database: FakeBatchDatabase) {
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
}

test("News publish timestamps are normalized to D1 CURRENT_TIMESTAMP format", () => {
  const parsed = parseAdminNewsPayload({
    ...input,
    publishedAt: "2026-08-18T03:30:00.000Z",
  });
  assert.equal(parsed.input?.publishedAt, "2026-08-18 03:30:00");
});

test("News input rejects invalid status and featured types instead of silently falling back", () => {
  const parsed = parseAdminNewsPayload({
    ...input,
    featured: "yes",
    status: "review",
  });
  assert.equal(parsed.input, undefined);
  assert.equal(parsed.fieldErrors?.featured, "Cờ bài nổi bật phải là true hoặc false.");
  assert.equal(parsed.fieldErrors?.status, "Trạng thái bài viết không hợp lệ.");
});

test("News create and audit are committed in one D1 batch", async () => {
  const database = new FakeBatchDatabase([{ id: 41 }]);
  const articleId = await createAdminNewsArticleAtomically(
    database,
    { ...input, status: "draft", publishedAt: null },
    "actor@example.com",
  );

  assert.equal(articleId, 41);
  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 2);
  assert.match(batch[0]?.query ?? "", /INSERT INTO articles/);
  assert.match(batch[0]?.query ?? "", /RETURNING id/);
  assert.match(batch[1]?.query ?? "", /INSERT INTO audit_logs/);
  assert.ok(batch[1]?.values.includes("actor@example.com"));
  assertNoIndividualWrites(database);
});

test("News update uses exact revision, audit marker and one D1 batch", async () => {
  const database = new FakeBatchDatabase();
  await updateAdminNewsArticleAtomically(database, 41, input, 7, "actor@example.com");

  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 2);
  assert.match(batch[0]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(batch[0]?.query ?? "", /id = \? AND revision = \? AND archived_at IS NULL/);
  assert.ok(batch[0]?.values.includes("news.article.updated"));
  assert.ok(batch[0]?.values.includes(7));
  assert.match(batch[1]?.query ?? "", /UPDATE articles/);
  assert.match(batch[1]?.query ?? "", /revision = revision \+ 1/);
  assert.match(batch[1]?.query ?? "", /COALESCE\(\?, published_at, CURRENT_TIMESTAMP\)/);
  assert.match(batch[1]?.query ?? "", /WHERE id = \? AND revision = \? AND archived_at IS NULL/);
  const auditId = batch[0]?.values[0];
  assert.ok(batch[1]?.values.includes(auditId));
  assertNoIndividualWrites(database);
});

test("stale News update fails after guarded no-op transaction", async () => {
  const database = new FakeBatchDatabase([]);
  await assert.rejects(
    updateAdminNewsArticleAtomically(database, 41, input, 7, "actor@example.com"),
    AdminNewsStaleWriteError,
  );
  assert.equal(database.batches.length, 1);
  assertNoIndividualWrites(database);
});

test("News delete is a revision-guarded soft archive", async () => {
  const database = new FakeBatchDatabase();
  await archiveAdminNewsArticleAtomically(database, 41, 9, "actor@example.com");

  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 2);
  assert.ok(batch[0]?.values.includes("news.article.archived"));
  assert.ok(batch[0]?.values.includes(9));
  assert.match(batch[1]?.query ?? "", /SET archived_at = CURRENT_TIMESTAMP/);
  assert.match(batch[1]?.query ?? "", /revision = revision \+ 1/);
  assertNoIndividualWrites(database);
});

test("News routes require revisions and expose stale-write semantics", async () => {
  const [collectionRoute, itemRoute] = await Promise.all([
    readFile(path.join(repoRoot, "src/app/api/admin/news/route.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/app/api/admin/news/[id]/route.ts"), "utf8"),
  ]);

  assert.match(collectionRoute, /createAdminNewsArticleAtomically/);
  assert.match(collectionRoute, /content_manager/);
  assert.match(itemRoute, /hasExplicitRevision\(payload\)/);
  assert.match(itemRoute, /updateAdminNewsArticleAtomically/);
  assert.match(itemRoute, /archiveAdminNewsArticleAtomically/);
  assert.match(itemRoute, /STALE_WRITE/);
});

test("archived News articles are excluded from every public read path", async () => {
  const [core, migration] = await Promise.all([
    readFile(path.join(repoRoot, "src/lib/news-data-core.ts"), "utf8"),
    readFile(path.join(repoRoot, "migrations/0007_news_archive.sql"), "utf8"),
  ]);

  assert.match(migration, /ALTER TABLE articles ADD COLUMN archived_at TEXT/);
  const matches = core.match(/a\.archived_at IS NULL/g) ?? [];
  assert.ok(matches.length >= 4, "list, detail and both related paths must reject archived articles");
});
