import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getPublishedNewsArticle,
  listPublishedNews,
  listRelatedPublishedNews,
  type NewsD1Database,
  type NewsD1Result,
  type NewsD1Statement,
} from "../src/lib/news-data-core.ts";

class FakeStatement implements NewsD1Statement {
  readonly database: FakeNewsDatabase;
  readonly query: string;
  values: unknown[] = [];

  constructor(database: FakeNewsDatabase, query: string) {
    this.database = database;
    this.query = query.replace(/\s+/g, " ").trim();
  }

  bind(...values: unknown[]): NewsD1Statement {
    this.values = values;
    this.database.binds.push({ query: this.query, values });
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<NewsD1Result<T>> {
    if (this.query.includes("FROM article_categories")) {
      return { results: this.database.categories as T[] };
    }
    if (this.query.includes("FROM articles a") && this.query.includes("a.id <> ?")) {
      return { results: this.database.related as T[] };
    }
    if (this.query.includes("FROM articles a")) {
      return { results: this.database.articles as T[] };
    }
    return { results: [] };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    if (this.query.includes("COUNT(*) AS total")) {
      return { total: this.database.total } as T;
    }
    if (this.query.includes("WHERE a.slug = ?")) {
      return this.database.detail as T | null;
    }
    return null;
  }
}

class FakeNewsDatabase implements NewsD1Database {
  readonly prepared: FakeStatement[] = [];
  readonly binds: Array<{ query: string; values: unknown[] }> = [];
  total = 1;
  categories = [
    { id: 1, name: "Tin tức", slug: "tin-tuc" },
    { id: 2, name: "Kiến thức", slug: "kien-thuc" },
  ];
  articles = [
    {
      id: 10,
      category_id: 1,
      category_name: "Tin tức",
      category_slug: "tin-tuc",
      title: "Bài viết đã xuất bản",
      slug: "bai-viet-da-xuat-ban",
      excerpt: "Tóm tắt",
      thumbnail_url: "/media/news/thumb.webp",
      is_featured: 1,
      published_at: "2026-08-17 12:00:00",
    },
  ];
  detail = {
    ...this.articles[0],
    content_text: "Đoạn một.\n\nĐoạn hai.",
    seo_title: "SEO title",
    seo_description: "SEO description",
  };
  related = [
    {
      ...this.articles[0],
      id: 11,
      title: "Bài liên quan",
      slug: "bai-lien-quan",
      is_featured: 0,
    },
  ];

  prepare(query: string): NewsD1Statement {
    const statement = new FakeStatement(this, query);
    this.prepared.push(statement);
    return statement;
  }
}

test("published news listing is bounded, canonical and uses active categories", async () => {
  const database = new FakeNewsDatabase();
  const result = await listPublishedNews(database, {
    category: " tin-tuc ",
    page: 999999,
    perPage: 999,
    query: " 50%_gạo ",
  });

  assert.equal(result.page, 10000);
  assert.equal(result.perPage, 24);
  assert.equal(result.total, 1);
  assert.equal(result.totalPages, 1);
  assert.equal(result.articles[0]?.featured, true);
  assert.equal(result.articles[0]?.category?.slug, "tin-tuc");
  assert.deepEqual(result.categories.map((category) => category.slug), ["tin-tuc", "kien-thuc"]);

  const listSql = database.prepared.find((statement) => statement.query.includes("ORDER BY a.is_featured"))?.query ?? "";
  const categorySql = database.prepared.find((statement) => statement.query.includes("FROM article_categories"))?.query ?? "";
  assert.match(listSql, /a\.status = 'published'/);
  assert.match(listSql, /a\.published_at IS NOT NULL/);
  assert.match(listSql, /a\.published_at <= CURRENT_TIMESTAMP/);
  assert.match(listSql, /c\.slug = \?/);
  assert.match(listSql, /a\.title LIKE \? ESCAPE '\\'/);
  assert.match(listSql, /LIMIT \? OFFSET \?/);
  assert.match(categorySql, /WHERE is_active = 1/);

  const listBind = database.binds.find((entry) => entry.query.includes("ORDER BY a.is_featured"));
  assert.deepEqual(listBind?.values, ["tin-tuc", "%50\\%\\_gạo%", "%50\\%\\_gạo%", 24, 239976]);
});

test("published detail never reads drafts or future articles", async () => {
  const database = new FakeNewsDatabase();
  const article = await getPublishedNewsArticle(database, " bai-viet-da-xuat-ban ");

  assert.equal(article?.slug, "bai-viet-da-xuat-ban");
  assert.equal(article?.contentText, "Đoạn một.\n\nĐoạn hai.");
  assert.equal(article?.seoTitle, "SEO title");
  const detailSql = database.prepared.find((statement) => statement.query.includes("WHERE a.slug = ?"))?.query ?? "";
  assert.match(detailSql, /a\.status = 'published'/);
  assert.match(detailSql, /a\.published_at IS NOT NULL/);
  assert.match(detailSql, /a\.published_at <= CURRENT_TIMESTAMP/);
});

test("related news excludes the current article and stays bounded", async () => {
  const database = new FakeNewsDatabase();
  const related = await listRelatedPublishedNews(database, {
    articleId: 10,
    categoryId: 1,
    limit: 99,
  });

  assert.equal(related.length, 1);
  assert.equal(related[0]?.id, 11);
  const relatedStatement = database.prepared.find((statement) => statement.query.includes("a.id <> ?"));
  assert.match(relatedStatement?.query ?? "", /a\.category_id = \?/);
  assert.deepEqual(relatedStatement?.values, [10, 1, 6]);
});

test("news migration is minimal, versioned and stores plain text content", async () => {
  const migration = await readFile(new URL("../migrations/0006_news_cms.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS article_categories/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS articles/);
  assert.match(migration, /content_text TEXT NOT NULL DEFAULT ''/);
  assert.doesNotMatch(migration, /content_html|raw_html/);
  assert.match(migration, /status TEXT NOT NULL DEFAULT 'draft' CHECK \(status IN \('draft', 'published'\)\)/);
  assert.match(migration, /revision INTEGER NOT NULL DEFAULT 1 CHECK \(revision >= 1\)/);
  assert.match(migration, /idx_articles_public_listing/);
  assert.match(migration, /idx_articles_category_listing/);
});

test("Cloudflare News wrapper uses the existing canonical D1 binding and no captured fallback", async () => {
  const wrapper = await readFile(new URL("../src/lib/news-data.ts", import.meta.url), "utf8");
  assert.match(wrapper, /import "server-only"/);
  assert.match(wrapper, /getCloudflareContext/);
  assert.match(wrapper, /GIACONG_VN_CATALOG/);
  assert.match(wrapper, /listPublishedNews/);
  assert.match(wrapper, /getPublishedNewsArticle/);
  assert.doesNotMatch(wrapper, /manifest\.json|CapturedPage|demo/i);
});
