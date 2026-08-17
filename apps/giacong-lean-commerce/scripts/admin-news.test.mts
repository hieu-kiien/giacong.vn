import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  parseAdminNewsArticlePayload,
  parseAdminNewsCategoryPayload,
} from "../src/lib/admin-news-input.ts";
import {
  AdminNewsStaleWriteError,
  createAdminNewsArticleAtomically,
  updateAdminNewsArticleAtomically,
} from "../src/lib/admin-news-write.ts";

const repoRoot = path.join(import.meta.dirname, "..");

test("article input keeps drafts safe and requires a publish time", () => {
  const draft = parseAdminNewsArticlePayload({
    categoryId: null,
    title: "Bài thử nghiệm",
    slug: "bai-thu-nghiem",
    excerpt: "Tóm tắt",
    contentText: "Nội dung",
    thumbnailUrl: "/media/news/test.webp",
    status: "draft",
    isFeatured: false,
    seoTitle: "",
    seoDescription: "",
    publishedAt: null,
  });
  assert.equal(draft.input?.status, "draft");
  assert.equal(draft.input?.publishedAt, null);

  const published = parseAdminNewsArticlePayload({
    ...draft.input,
    status: "published",
    publishedAt: null,
  });
  assert.equal(published.input, null);
  assert.match(published.fieldErrors.publishedAt, /published/i);
});

test("article input normalizes UTC publication time and rejects unsafe slugs", () => {
  const parsed = parseAdminNewsArticlePayload({
    categoryId: 2,
    title: "Lịch phát hành",
    slug: "Lich Phat Hanh",
    excerpt: "",
    contentText: "Body",
    thumbnailUrl: "https://cdn.example.test/news.webp",
    status: "published",
    isFeatured: true,
    seoTitle: "SEO",
    seoDescription: "Description",
    publishedAt: "2026-08-18T07:30:00+07:00",
  });
  assert.equal(parsed.input, null);
  assert.match(parsed.fieldErrors.slug, /Slug/);

  const valid = parseAdminNewsArticlePayload({
    categoryId: 2,
    title: "Lịch phát hành",
    slug: "lich-phat-hanh",
    excerpt: "",
    contentText: "Body",
    thumbnailUrl: "https://cdn.example.test/news.webp",
    status: "published",
    isFeatured: true,
    seoTitle: "SEO",
    seoDescription: "Description",
    publishedAt: "2026-08-18T07:30:00+07:00",
  });
  assert.equal(valid.input?.publishedAt, "2026-08-18 00:30:00");
});

test("category input rejects negative ordering", () => {
  const parsed = parseAdminNewsCategoryPayload({
    name: "Kiến thức",
    slug: "kien-thuc",
    description: "",
    sortOrder: -1,
    isActive: true,
  });
  assert.equal(parsed.input, null);
  assert.match(parsed.fieldErrors.sortOrder, /không âm/);
});

test("article create is batched with its audit marker", async () => {
  const database = new FakeDatabase([[{ id: 17 }], []]);
  const id = await createAdminNewsArticleAtomically(database, articleInput(), "actor-1");
  assert.equal(id, 17);
  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0]?.length, 2);
  assert.match(database.batches[0]?.[0]?.query ?? "", /INSERT INTO articles/);
  assert.match(database.batches[0]?.[1]?.query ?? "", /article\.created/);
});

test("article update fails closed when revision marker is stale", async () => {
  const database = new FakeDatabase([[], []]);
  await assert.rejects(
    () => updateAdminNewsArticleAtomically(database, 17, articleInput(), 3, "actor-1"),
    AdminNewsStaleWriteError,
  );
});

test("News Admin routes stay behind the shared membership guard", async () => {
  const collection = await readSource("src", "app", "api", "admin", "news", "articles", "route.ts");
  const detail = await readSource("src", "app", "api", "admin", "news", "articles", "[id]", "route.ts");
  const categories = await readSource("src", "app", "api", "admin", "news", "categories", "route.ts");
  for (const source of [collection, detail, categories]) {
    assert.match(source, /requireAdmin/);
    assert.match(source, /owner/);
    assert.match(source, /content_manager/);
  }
  assert.match(detail, /STALE_WRITE/);
  assert.match(detail, /revision/);
});

test("News Admin UI uses the canonical admin APIs and plain-text editor", async () => {
  const page = await readSource("src", "app", "admin", "tin-tuc", "page.tsx");
  assert.match(page, /\/api\/admin\/news\/articles/);
  assert.match(page, /\/api\/admin\/news\/categories/);
  assert.match(page, /contentText/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
});

function articleInput() {
  return {
    categoryId: 1,
    title: "Bài viết",
    slug: "bai-viet",
    excerpt: "Tóm tắt",
    contentText: "Nội dung",
    thumbnailUrl: null,
    status: "draft" as const,
    isFeatured: false,
    seoTitle: "",
    seoDescription: "",
    publishedAt: null,
  };
}

async function readSource(...segments: string[]): Promise<string> {
  return readFile(path.join(repoRoot, ...segments), "utf8");
}

class FakeStatement {
  values: unknown[] = [];
  constructor(readonly query: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async all<T>() { return { results: [] as T[] }; }
  async first<T>() { return null as T | null; }
  async run() { return {}; }
}

class FakeDatabase {
  readonly batches: FakeStatement[][] = [];
  constructor(private readonly batchResults: unknown[][]) {}
  prepare(query: string) { return new FakeStatement(query); }
  async batch(statements: FakeStatement[]) {
    this.batches.push(statements);
    return this.batchResults.map((results) => ({ results }));
  }
}
