import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AdminNewsIdempotencyConflictError,
  batchAdminNewsPublication,
  createAdminNewsPost,
  deleteAdminNewsPost,
  publishAdminNewsPost,
  unpublishAdminNewsPost,
  updateAdminNewsPost,
} from "../src/lib/admin-data.ts";

const root = new URL("../", import.meta.url);

async function read(path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

test("news schema has separate draft and published snapshots with request-scoped audit", async () => {
  const migration = await read("migrations/0012_news_draft_publish_contract.sql");
  assert.match(migration, /draft_slug/);
  assert.match(migration, /draft_title/);
  assert.match(migration, /published_slug/);
  assert.match(migration, /published_content/);
  assert.match(migration, /last_request_id/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_news_audit/);
  assert.match(migration, /request_id TEXT NOT NULL UNIQUE/);
  assert.match(migration, /CREATE UNIQUE INDEX[\s\S]*published_slug/);
});

test("news writes use bounded JSON, explicit publish boundary and revision-aware delete", async () => {
  const [collectionRoute, detailRoute, publishRoute, batchRoute, input, data, publicData] = await Promise.all([
    read("src/app/api/admin/news/route.ts"),
    read("src/app/api/admin/news/[id]/route.ts"),
    read("src/app/api/admin/news/[id]/publish/route.ts"),
    read("src/app/api/admin/news/batch/route.ts"),
    read("src/lib/admin-news-input.ts"),
    read("src/lib/admin-data.ts"),
    read("src/lib/news-public.ts"),
  ]);
  assert.match(collectionRoute, /readBoundedAdminJson/);
  assert.match(collectionRoute, /isAdminRequestId/);
  assert.match(collectionRoute, /createAdminNewsPost/);
  assert.match(collectionRoute, /return adminFailure\(requestId, 422/);
  assert.doesNotMatch(collectionRoute, /isPublished/);
  assert.match(detailRoute, /readBoundedAdminJson/);
  assert.match(detailRoute, /expectedRevision/);
  assert.match(detailRoute, /deleteAdminNewsPost\(guard\.database, id, body\.revision/);
  assert.match(publishRoute, /publishAdminNewsPost/);
  assert.match(batchRoute, /batchAdminNewsPublication/);
  assert.match(batchRoute, /readBoundedAdminJson/);
  assert.match(batchRoute, /items/);
  assert.match(input, /AdminNewsDraftInput/);
  assert.doesNotMatch(input, /isPublished: boolean/);
  assert.match(data, /published_slug/);
  assert.match(data, /admin_news_audit/);
  assert.match(data, /last_request_id/);
  assert.match(data, /admin_news_bulk_audit/);
  assert.match(data, /bulk_request_id/);
  assert.match(publicData, /published_slug/);
  assert.doesNotMatch(publicData, /WHERE slug = \? AND is_published = 1/);
});

interface FakeNewsRow {
  content: string;
  cover_image_url: string | null;
  draft_content: string;
  draft_cover_image_url: string | null;
  draft_excerpt: string;
  draft_slug: string;
  draft_title: string;
  excerpt: string;
  id: number;
  is_published: number;
  last_request_id: string | null;
  published_at: string | null;
  published_content: string | null;
  published_cover_image_url: string | null;
  published_excerpt: string | null;
  published_slug: string | null;
  published_title: string | null;
  revision: number;
  slug: string;
  title: string;
  updated_at: string;
}

interface FakeNewsAudit {
  action: "create" | "delete" | "update";
  entity_key: string;
  operation: "delete" | "draft" | "publish" | "unpublish";
  payload_sha256: string;
  request_id: string;
  bulk_request_id?: string;
}

interface FakeNewsBulkAudit {
  changed_count: number;
  operation: "status_batch";
  payload_sha256: string;
  request_id: string;
  selected_count: number;
}

class FakeNewsStatement {
  private values: unknown[] = [];
  private readonly database: FakeNewsDatabase;
  private readonly query: string;

  constructor(database: FakeNewsDatabase, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): FakeNewsStatement {
    this.values = values;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.database.all<T>(this.query, this.values) };
  }

  async first<T>(): Promise<T | null> {
    return this.database.first<T>(this.query, this.values);
  }

  async run(): Promise<unknown> {
    return this.database.run(this.query, this.values);
  }
}

class FakeNewsDatabase {
  readonly audits: FakeNewsAudit[] = [];
  readonly bulkAudits: FakeNewsBulkAudit[] = [];
  failAudit = false;
  private nextId = 1;
  private readonly rows = new Map<number, FakeNewsRow>();

  prepare(query: string): FakeNewsStatement {
    return new FakeNewsStatement(this, query);
  }

  async batch(statements: FakeNewsStatement[]): Promise<unknown[]> {
    const snapshotRows = structuredClone([...this.rows.entries()]);
    const snapshotAudits = structuredClone(this.audits);
    const snapshotBulkAudits = structuredClone(this.bulkAudits);
    const snapshotNextId = this.nextId;
    try {
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    } catch (error) {
      this.rows.clear();
      for (const [id, row] of snapshotRows) this.rows.set(id, row);
      this.audits.splice(0, this.audits.length, ...snapshotAudits);
      this.bulkAudits.splice(0, this.bulkAudits.length, ...snapshotBulkAudits);
      this.nextId = snapshotNextId;
      throw error;
    }
  }

  row(id: number): FakeNewsRow | undefined {
    return this.rows.get(id);
  }

  all<T>(query: string, values: unknown[]): T[] {
    if (query.includes("FROM news_posts") && query.includes("ORDER BY")) {
      return [...this.rows.values()].map((row) => this.readRow(row)) as T[];
    }
    if (query.includes("FROM admin_news_audit") && query.includes("bulk_request_id")) {
      const bulkRequestId = String(values[0]);
      return this.audits
        .filter((audit) => audit.bulk_request_id === bulkRequestId)
        .map(({ entity_key }) => ({ entity_key })) as T[];
    }
    throw new Error(`Unexpected all query: ${query}`);
  }

  first<T>(query: string, values: unknown[]): T | null {
    if (query.includes("FROM admin_news_bulk_audit") && query.includes("request_id = ?")) {
      return (this.bulkAudits.find((audit) => audit.request_id === String(values[0])) ?? null) as T | null;
    }
    if (query.includes("FROM admin_news_audit") && query.includes("request_id = ?")) {
      return (this.audits.find((audit) => audit.request_id === String(values[0])) ?? null) as T | null;
    }
    if (query.includes("SELECT id FROM news_posts WHERE last_request_id")) {
      const row = [...this.rows.values()].find((candidate) => candidate.last_request_id === String(values[0]));
      return row ? ({ id: row.id } as T) : null;
    }
    if (query.includes("FROM news_posts") && query.includes("WHERE id = ?")) {
      const row = this.rows.get(Number(values[0]));
      return row ? this.readRow(row) as T : null;
    }
    throw new Error(`Unexpected first query: ${query}`);
  }

  async run(query: string, values: unknown[]): Promise<{ meta: { changes: number } }> {
    if (query.includes("INSERT INTO admin_news_bulk_audit")) {
      const [requestId, , payloadSha256, selectedCount] = values;
      this.bulkAudits.push({
        changed_count: 0,
        operation: "status_batch",
        payload_sha256: String(payloadSha256),
        request_id: String(requestId),
        selected_count: Number(selectedCount),
      });
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO news_posts")) {
      const [slug, title, excerpt, content, coverImageUrl, draftSlug, draftTitle, draftExcerpt, draftContent, draftCover, requestId] = values;
      const id = this.nextId++;
      this.rows.set(id, {
        content: String(content),
        cover_image_url: (coverImageUrl as string | null) ?? null,
        draft_content: String(draftContent),
        draft_cover_image_url: (draftCover as string | null) ?? null,
        draft_excerpt: String(draftExcerpt),
        draft_slug: String(draftSlug),
        draft_title: String(draftTitle),
        excerpt: String(excerpt),
        id,
        is_published: 0,
        last_request_id: String(requestId),
        published_at: null,
        published_content: null,
        published_cover_image_url: null,
        published_excerpt: null,
        published_slug: null,
        published_title: null,
        revision: 1,
        slug: String(slug),
        title: String(title),
        updated_at: "2026-08-28T00:00:00.000Z",
      });
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO admin_news_audit")) {
      if (this.failAudit) throw new Error("audit insert failed");
      if (query.includes("bulk_request_id")) {
        const childRequestId = String(values[0]);
        const operation = String(values[2]) as FakeNewsAudit["operation"];
        const resultingRevision = Number(values[7]);
        const row = this.rows.get(Number(values[6]));
        if (!row || row.revision !== resultingRevision || row.last_request_id !== childRequestId) {
          return { meta: { changes: 0 } };
        }
        this.audits.push({
          action: "update",
          bulk_request_id: String(values[5]),
          entity_key: String(row.id),
          operation,
          payload_sha256: String(values[4]),
          request_id: childRequestId,
        });
        return { meta: { changes: 1 } };
      }
      const operation: FakeNewsAudit["operation"] = query.includes("'create'") ? "draft"
        : query.includes("'delete'") ? "delete"
          : typeof values[2] === "number" ? "draft" : String(values[2]) as FakeNewsAudit["operation"];
      const action = operation === "delete" ? "delete" : operation === "draft" && query.includes("'create'") ? "create" : "update";
      if (action === "create") {
        const row = [...this.rows.values()].find((candidate) => candidate.last_request_id === String(values[0]));
        if (!row) return { meta: { changes: 0 } };
        this.audits.push({ action, entity_key: String(row.id), operation, payload_sha256: String(values[2]), request_id: String(values[0]) });
        return { meta: { changes: 1 } };
      }
      if (action === "delete") {
        const row = this.rows.get(Number(values[3]));
        if (!row || row.revision !== Number(values[4])) return { meta: { changes: 0 } };
        this.audits.push({ action, entity_key: String(row.id), operation, payload_sha256: String(values[2]), request_id: String(values[0]) });
        return { meta: { changes: 1 } };
      }
      const idIndex = operation === "draft" ? 4 : 5;
      const expectedRevisionIndex = idIndex + 1;
      const requestIndex = idIndex + 2;
      const hashIndex = operation === "draft" ? 3 : 4;
      const row = this.rows.get(Number(values[idIndex]));
      if (!row || row.revision !== Number(values[expectedRevisionIndex]) || row.last_request_id !== String(values[requestIndex])) return { meta: { changes: 0 } };
      this.audits.push({ action, entity_key: String(row.id), operation, payload_sha256: String(values[hashIndex]), request_id: String(values[0]) });
      return { meta: { changes: 1 } };
    }
    if (query.includes("UPDATE admin_news_bulk_audit")) {
      const requestId = String(values[0]);
      const audit = this.bulkAudits.find((candidate) => candidate.request_id === String(values[1]));
      if (!audit || audit.request_id !== requestId) return { meta: { changes: 0 } };
      audit.changed_count = this.audits.filter((candidate) => candidate.bulk_request_id === requestId).length;
      return { meta: { changes: 1 } };
    }
    if (query.includes("UPDATE news_posts")) {
      const id = Number(values.at(-2));
      const expectedRevision = Number(values.at(-1));
      const row = this.rows.get(id);
      if (!row || row.revision !== expectedRevision) return { meta: { changes: 0 } };
      if (query.includes("draft_slug =")) {
        row.slug = String(values[0]);
        row.title = String(values[1]);
        row.excerpt = String(values[2]);
        row.content = String(values[3]);
        row.cover_image_url = (values[4] as string | null) ?? null;
        row.draft_slug = String(values[5]);
        row.draft_title = String(values[6]);
        row.draft_excerpt = String(values[7]);
        row.draft_content = String(values[8]);
        row.draft_cover_image_url = (values[9] as string | null) ?? null;
        row.last_request_id = String(values[10]);
      } else if (query.includes("published_slug =")) {
        row.published_slug = row.draft_slug;
        row.published_title = row.draft_title;
        row.published_excerpt = row.draft_excerpt;
        row.published_content = row.draft_content;
        row.published_cover_image_url = row.draft_cover_image_url;
        row.is_published = 1;
        row.published_at = "2026-08-28T00:01:00.000Z";
        row.last_request_id = String(values[0]);
      } else {
        row.is_published = 0;
        row.last_request_id = String(values[0]);
      }
      row.revision += 1;
      return { meta: { changes: 1 } };
    }
    if (query.startsWith("DELETE FROM news_posts")) {
      const id = Number(values[0]);
      const expectedRevision = Number(values[1]);
      const row = this.rows.get(id);
      if (!row || row.revision !== expectedRevision) return { meta: { changes: 0 } };
      this.rows.delete(id);
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unexpected run query: ${query}`);
  }

  private readRow(row: FakeNewsRow): FakeNewsRow {
    return { ...row };
  }
}

const draftInput = {
  content: "Nội dung nháp",
  coverImageUrl: "/media/news/cover.jpg",
  excerpt: "Tóm tắt",
  slug: "bai-viet",
  title: "Bài viết",
};

test("news draft edits do not change published snapshot and publish is explicit", async () => {
  const database = new FakeNewsDatabase();
  const created = await createAdminNewsPost(database, draftInput, "owner-1", "11111111-1111-4111-8111-111111111111");
  const edited = await updateAdminNewsPost(database, created.id, { ...draftInput, title: "Bài viết nháp mới" }, created.revision, "owner-1", "22222222-2222-4222-8222-222222222222");
  assert.equal(edited?.isPublished, false);
  assert.equal(edited?.published, null);
  const published = await publishAdminNewsPost(database, created.id, edited?.revision ?? 0, "owner-1", "33333333-3333-4333-8333-333333333333");
  assert.equal(published?.isPublished, true);
  assert.equal(published?.published?.title, "Bài viết nháp mới");

  const newer = await updateAdminNewsPost(database, created.id, { ...draftInput, title: "Bản nháp sau phát hành" }, published?.revision ?? 0, "owner-1", "44444444-4444-4444-8444-444444444444");
  assert.equal(newer?.published?.title, "Bài viết nháp mới");
  assert.equal(newer?.isPublished, true);
  const hidden = await unpublishAdminNewsPost(database, created.id, newer?.revision ?? 0, "owner-1", "55555555-5555-4555-8555-555555555555");
  assert.equal(hidden?.isPublished, false);
  assert.equal(hidden?.published?.title, "Bài viết nháp mới");
  assert.equal(database.audits.length, 5);
});

test("news request ids replay without repeating the mutation and reject payload reuse", async () => {
  const database = new FakeNewsDatabase();
  const requestId = "66666666-6666-4666-8666-666666666666";
  const first = await createAdminNewsPost(database, draftInput, "owner-1", requestId);
  const replay = await createAdminNewsPost(database, draftInput, "owner-1", requestId);
  assert.equal(replay.id, first.id);
  assert.equal(database.audits.length, 1);
  await assert.rejects(
    () => createAdminNewsPost(database, { ...draftInput, title: "Khác" }, "owner-1", requestId),
    AdminNewsIdempotencyConflictError,
  );
  assert.equal(database.audits.length, 1);
});

test("news update, publication and delete retries replay after the row revision changes", async () => {
  const database = new FakeNewsDatabase();
  const created = await createAdminNewsPost(database, draftInput, "owner-1", "12121212-1212-4121-8121-121212121212");
  const updateRequestId = "13131313-1313-4131-8131-131313131313";
  const updated = await updateAdminNewsPost(
    database,
    created.id,
    { ...draftInput, title: "Bản nháp đã sửa" },
    created.revision,
    "owner-1",
    updateRequestId,
  );
  const updateReplay = await updateAdminNewsPost(
    database,
    created.id,
    { ...draftInput, title: "Bản nháp đã sửa" },
    created.revision,
    "owner-1",
    updateRequestId,
  );
  assert.equal(updateReplay?.revision, updated?.revision);
  assert.equal(updateReplay?.title, "Bản nháp đã sửa");

  const publishRequestId = "14141414-1414-4141-8141-141414141414";
  const published = await publishAdminNewsPost(database, created.id, updated?.revision ?? 0, "owner-1", publishRequestId);
  const publishReplay = await publishAdminNewsPost(database, created.id, updated?.revision ?? 0, "owner-1", publishRequestId);
  assert.equal(publishReplay?.revision, published?.revision);
  assert.equal(publishReplay?.isPublished, true);

  const toDelete = await createAdminNewsPost(database, { ...draftInput, slug: "bai-viet-xoa" }, "owner-1", "15151515-1515-4151-8151-151515151515");
  const deleteRequestId = "16161616-1616-4161-8161-161616161616";
  assert.equal(await deleteAdminNewsPost(database, toDelete.id, toDelete.revision, "owner-1", deleteRequestId), true);
  assert.equal(await deleteAdminNewsPost(database, toDelete.id, toDelete.revision, "owner-1", deleteRequestId), true);
});

test("stale news writes and failed audit batches leave D1 state untouched", async () => {
  const database = new FakeNewsDatabase();
  const created = await createAdminNewsPost(database, draftInput, "owner-1", "77777777-7777-4777-8777-777777777777");
  await assert.rejects(
    () => updateAdminNewsPost(database, created.id, { ...draftInput, title: "Cũ" }, 99, "owner-1", "88888888-8888-4888-8888-888888888888"),
    /đã thay đổi/i,
  );
  assert.equal(database.row(created.id)?.revision, 1);
  database.failAudit = true;
  await assert.rejects(
    () => updateAdminNewsPost(database, created.id, { ...draftInput, title: "Không được ghi" }, 1, "owner-1", "99999999-9999-4999-8999-999999999999"),
    /audit insert failed/i,
  );
  assert.equal(database.row(created.id)?.title, draftInput.title);
  assert.equal(database.row(created.id)?.revision, 1);
});

test("news bulk publication is atomic, revision-aware and idempotent", async () => {
  const database = new FakeNewsDatabase();
  const first = await createAdminNewsPost(database, draftInput, "owner-1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  const second = await createAdminNewsPost(
    database,
    { ...draftInput, slug: "bai-viet-hai", title: "Bài viết hai" },
    "owner-1",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  const requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const result = await batchAdminNewsPublication(database, {
    actorSubject: "owner-1",
    items: [
      { id: second.id, expectedRevision: 99 },
      { id: first.id, expectedRevision: first.revision },
    ],
    publish: true,
    requestId,
  });
  assert.equal(result.selectedCount, 2);
  assert.equal(result.changedCount, 1);
  assert.deepEqual(result.changed.map((post) => post.id), [first.id]);
  assert.deepEqual(result.skipped, [{ id: second.id, reason: "stale" }]);
  assert.equal(database.row(first.id)?.is_published, 1);
  assert.equal(database.bulkAudits.length, 1);
  assert.equal(database.audits.filter((audit) => audit.bulk_request_id === requestId).length, 1);

  const auditCount = database.audits.length;
  const replay = await batchAdminNewsPublication(database, {
    actorSubject: "owner-1",
    items: [
      { id: first.id, expectedRevision: first.revision },
      { id: second.id, expectedRevision: 99 },
    ],
    publish: true,
    requestId,
  });
  assert.equal(replay.changedCount, 1);
  assert.equal(replay.skipped[0]?.reason, "stale");
  assert.equal(database.audits.length, auditCount);
  assert.equal(database.bulkAudits.length, 1);
});
