import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";
import {
  createMediaAsset,
  deleteMediaAsset,
  MediaWriteConflictError,
  MediaWriteIdempotencyConflictError,
  MediaWriteStorageError,
  type R2BucketLike,
  updateMediaAssetAltText,
} from "../src/lib/media-data.ts";

const assetRequest = "77777777-7777-4777-8777-777777777777";
const altRequest = "88888888-8888-4888-8888-888888888888";
const deleteRequest = "99999999-9999-4999-8999-999999999999";
const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]).buffer;

type AssetState = {
  alt_text: string | null;
  byte_size: number;
  checksum_sha256: string;
  content_type: string;
  created_at: string;
  id: string;
  namespace: "product" | "service" | "variant";
  original_filename: string;
  product_id: number | null;
  revision: number;
  service_id: number | null;
  status: "active" | "deleted" | "orphaned" | "replaced";
  storage_key: string;
  updated_at: string;
  variant_id: number | null;
};

type AuditState = {
  action: "create" | "update" | "delete";
  entity_key: string;
  entity_type: "media_asset";
  payload_sha256: string;
  request_id: string;
};

class FakeStatement implements D1PreparedStatementLike {
  values: unknown[] = [];
  private readonly database: FakeDatabase;
  readonly query: string;

  constructor(database: FakeDatabase, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): FakeStatement {
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
    return this.database.execute(this.query, this.values);
  }
}

class FakeBucket implements R2BucketLike {
  readonly objects = new Set<string>();
  puts = 0;
  deletes = 0;

  async put(key: string): Promise<void> {
    this.puts += 1;
    this.objects.add(key);
  }

  async delete(key: string): Promise<void> {
    this.deletes += 1;
    this.objects.delete(key);
  }
}

class FakeDatabase implements D1DatabaseLike {
  readonly assets = new Map<string, AssetState>();
  readonly audits = new Map<string, AuditState>();
  legacyAudits = 0;
  batchCalls = 0;
  failAudit = false;
  private readonly omitBatchResults: boolean;
  private readonly skipLegacyAudit: boolean;

  constructor(options: { omitBatchResults?: boolean; skipLegacyAudit?: boolean } = {}) {
    this.omitBatchResults = options.omitBatchResults ?? false;
    this.skipLegacyAudit = options.skipLegacyAudit ?? false;
  }

  prepare(query: string): FakeStatement {
    return new FakeStatement(this, query);
  }

  async batch(statements: FakeStatement[]): Promise<Array<{ meta: { changes: number } }>> {
    this.batchCalls += 1;
    const snapshot = this.snapshot();
    try {
      const results: Array<{ meta: { changes: number } }> = [];
      for (const statement of statements) results.push(await statement.run() as { meta: { changes: number } });
      return this.omitBatchResults ? statements.map(() => ({})) : results;
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  first<T>(query: string, values: unknown[]): T | null {
    if (query.includes("sqlite_master")) {
      const table = String(values[0]);
      return (["admin_media_audit", "audit_logs"].includes(table) ? { name: table } : null) as T | null;
    }
    if (query.includes("media-write-postcondition-read")) {
      return (this.assets.size > 0 && this.audits.size > 0 && this.legacyAudits > 0 ? { complete: 1 } : { complete: 0 }) as T;
    }
    if (query.includes("FROM admin_media_audit")) return (this.audits.get(String(values[0])) ?? null) as T | null;
    if (query.includes("FROM media_assets")) return (this.assets.get(String(values[0])) ?? null) as T | null;
    throw new Error(`Unexpected first query: ${query}`);
  }

  all<T>(query: string, _values: unknown[]): T[] {
    if (query.includes("FROM products") || query.includes("FROM product_variants") || query.includes("FROM services")) return [];
    throw new Error(`Unexpected all query: ${query}`);
  }

  execute(query: string, values: unknown[]): { meta: { changes: number } } {
    if (query.includes("media-write-postcondition")) {
      if (this.assets.size === 0 || this.audits.size === 0 || this.legacyAudits === 0) {
        throw new Error("NOT NULL constraint failed: admin_media_audit.request_id");
      }
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO media_assets")) {
      const [id, namespace, productId, variantId, serviceId, storageKey, filename, contentType, byteSize, checksum, altText, createdBy] = values;
      this.assets.set(String(id), {
        alt_text: (altText as string | null) ?? null,
        byte_size: Number(byteSize),
        checksum_sha256: String(checksum),
        content_type: String(contentType),
        created_at: "2026-08-31T00:00:00.000Z",
        id: String(id),
        namespace: String(namespace) as AssetState["namespace"],
        original_filename: String(filename),
        product_id: (productId as number | null) ?? null,
        revision: 1,
        service_id: (serviceId as number | null) ?? null,
        status: "active",
        storage_key: String(storageKey),
        updated_at: "2026-08-31T00:00:00.000Z",
        variant_id: (variantId as number | null) ?? null,
      });
      void createdBy;
      return { meta: { changes: 1 } };
    }
    if (query.includes("UPDATE media_assets")) {
      const isAltUpdate = query.includes("alt_text =");
      const [first, second, third, fourth] = values;
      const altText = isAltUpdate ? first : null;
      const requestId = String(isAltUpdate ? second : first);
      const id = String(isAltUpdate ? third : second);
      const expectedRevision = Number(isAltUpdate ? fourth : third);
      const asset = this.assets.get(id);
      if (!asset || asset.revision !== expectedRevision || (isAltUpdate && asset.status !== "active")) return { meta: { changes: 0 } };
      if (isAltUpdate) asset.alt_text = (altText as string | null) ?? null;
      else asset.status = "deleted";
      asset.revision += 1;
      asset.updated_at = "2026-08-31T00:00:01.000Z";
      void requestId;
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO admin_media_audit")) {
      if (this.failAudit) throw new Error("media audit failure");
      const requestId = String(values[0]);
      if (this.audits.has(requestId)) throw new Error("UNIQUE constraint failed: admin_media_audit.request_id");
      const isCreate = query.includes("'create'");
      const entityType = (isCreate ? values[2] : values[3]) as AuditState["entity_type"];
      const entityKey = String(isCreate ? values[3] : values[4]);
      const payloadSha = String(isCreate ? values[4] : values[7]);
      this.audits.set(requestId, {
        action: isCreate ? "create" : values[2] === "delete" ? "delete" : "update",
        entity_key: entityKey,
        entity_type: entityType,
        payload_sha256: payloadSha,
        request_id: requestId,
      });
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO audit_logs")) {
      if (this.skipLegacyAudit) return { meta: { changes: 0 } };
      this.legacyAudits += 1;
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unhandled execute query: ${query}`);
  }

  private snapshot() {
    return {
      assets: new Map([...this.assets].map(([key, value]) => [key, { ...value }])),
      audits: new Map([...this.audits].map(([key, value]) => [key, { ...value }])),
      legacyAudits: this.legacyAudits,
    };
  }

  private restore(snapshot: ReturnType<FakeDatabase["snapshot"]>): void {
    this.assets.clear();
    for (const [key, value] of snapshot.assets) this.assets.set(key, value);
    this.audits.clear();
    for (const [key, value] of snapshot.audits) this.audits.set(key, value);
    this.legacyAudits = snapshot.legacyAudits;
  }
}

function createInput(requestId = assetRequest) {
  return {
    altText: "Ảnh sản phẩm",
    bytes,
    checksumSha256: "a".repeat(64),
    contentType: "image/jpeg",
    createdBy: "owner@example.com",
    originalFilename: "product.jpg",
    productId: 1,
    requestId,
    serviceId: null,
    variantId: null,
  };
}

test("media create is atomic, request-idempotent and rollback-safe", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();
  const created = await createMediaAsset(database, bucket, createInput());
  assert.equal(created.revision, 1);
  assert.equal(database.batchCalls, 1);
  assert.equal(database.audits.size, 1);
  const replay = await createMediaAsset(database, bucket, createInput());
  assert.equal(replay.id, created.id);
  assert.equal(database.batchCalls, 1);
  assert.equal(bucket.puts, 1);
  await assert.rejects(
    () => createMediaAsset(database, bucket, { ...createInput(assetRequest), altText: "Payload khác" }),
    MediaWriteIdempotencyConflictError,
  );

  const failedDatabase = new FakeDatabase();
  failedDatabase.failAudit = true;
  const failedBucket = new FakeBucket();
  await assert.rejects(() => createMediaAsset(failedDatabase, failedBucket, createInput()), /media audit failure/);
  assert.equal(failedDatabase.assets.size, 0);
  assert.equal(failedDatabase.audits.size, 0);
  assert.equal(failedBucket.objects.size, 0);
});

test("media writes remain successful when D1 omits batch result rows", async () => {
  const database = new FakeDatabase({ omitBatchResults: true });
  const bucket = new FakeBucket();
  const created = await createMediaAsset(database, bucket, createInput());
  const updated = await updateMediaAssetAltText(database, created.id, "Alt mới", 1, "owner@example.com", altRequest);
  const deleted = await deleteMediaAsset(database, bucket, created.id, 2, "owner@example.com", deleteRequest);

  assert.equal(updated?.revision, 2);
  assert.equal(deleted?.revision, 3);
  assert.equal(deleted?.status, "deleted");
});

test("media create rolls back when the legacy audit postcondition is missing", async () => {
  const database = new FakeDatabase({ skipLegacyAudit: true });
  const bucket = new FakeBucket();

  await assert.rejects(
    () => createMediaAsset(database, bucket, createInput()),
    MediaWriteStorageError,
  );
  assert.equal(database.assets.size, 0);
  assert.equal(database.audits.size, 0);
  assert.equal(database.legacyAudits, 0);
  assert.equal(bucket.objects.size, 0);
});

test("media replay rejects when its legacy audit is missing", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();
  await createMediaAsset(database, bucket, createInput());
  database.legacyAudits = 0;

  await assert.rejects(
    () => createMediaAsset(database, bucket, createInput()),
    MediaWriteStorageError,
  );
});

test("media alt text and delete use revision CAS, audit and replay", async () => {
  const database = new FakeDatabase();
  const bucket = new FakeBucket();
  const created = await createMediaAsset(database, bucket, createInput());
  const updated = await updateMediaAssetAltText(database, created.id, "Alt mới", 1, "owner@example.com", altRequest);
  assert.equal(updated?.revision, 2);
  assert.equal(updated?.altText, "Alt mới");
  assert.equal((await updateMediaAssetAltText(database, created.id, "Alt mới", 1, "owner@example.com", altRequest))?.id, updated?.id);
  await assert.rejects(
    () => updateMediaAssetAltText(database, created.id, "Stale", 1, "owner@example.com", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    MediaWriteConflictError,
  );

  const deleted = await deleteMediaAsset(database, bucket, created.id, 2, "owner@example.com", deleteRequest);
  assert.equal(deleted?.status, "deleted");
  assert.equal(deleted?.revision, 3);
  assert.equal(bucket.objects.size, 0);
  const replay = await deleteMediaAsset(database, bucket, created.id, 2, "owner@example.com", deleteRequest);
  assert.equal(replay?.status, "deleted");
});

test("media route and migration expose request and revision boundaries", async () => {
  const [route, detailRoute, panel, migration] = await Promise.all([
    readFile(new URL("../src/app/api/admin/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/media/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminMediaPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0015_media_write_contract.sql", import.meta.url), "utf8"),
  ]);
  assert.match(route, /requestId/);
  assert.match(route, /createMediaAsset/);
  assert.match(detailRoute, /revision/);
  assert.match(detailRoute, /IDEMPOTENCY_CONFLICT/);
  assert.match(panel, /requestId: crypto\.randomUUID\(\)/);
  assert.match(panel, /revision: asset\.revision/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_media_audit/);
  assert.match(migration, /ALTER TABLE media_assets/);
  assert.match(migration, /ALTER TABLE site_media_assets/);
});

class SqliteMediaStatement implements D1PreparedStatementLike {
  readonly query: string;
  private readonly statement: ReturnType<DatabaseSync["prepare"]>;
  private values: unknown[] = [];

  constructor(query: string, statement: ReturnType<DatabaseSync["prepare"]>) {
    this.query = query;
    this.statement = statement;
  }

  bind(...values: unknown[]): SqliteMediaStatement {
    this.values = values;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...(this.values as never[])) as T[] };
  }

  async first<T>(): Promise<T | null> {
    return (this.statement.get(...(this.values as never[])) as T | undefined) ?? null;
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const result = this.statement.run(...(this.values as never[]));
    return { meta: { changes: Number(result.changes ?? 0) } };
  }
}

class SqliteMediaDatabase implements D1DatabaseLike {
  readonly sqlite = new DatabaseSync(":memory:");
  private readonly omitBatchResults: boolean;
  private readonly skipQuery?: RegExp;

  constructor(options: { omitBatchResults?: boolean; skipQuery?: RegExp } = {}) {
    this.omitBatchResults = options.omitBatchResults ?? false;
    this.skipQuery = options.skipQuery;
    this.sqlite.exec(`
      CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, image_url TEXT);
      CREATE TABLE product_variants (id INTEGER PRIMARY KEY, name TEXT NOT NULL, image_url TEXT);
      CREATE TABLE services (id INTEGER PRIMARY KEY, name TEXT NOT NULL, image_url TEXT);
      CREATE TABLE media_assets (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        product_id INTEGER,
        variant_id INTEGER,
        service_id INTEGER,
        storage_key TEXT NOT NULL UNIQUE,
        original_filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        checksum_sha256 TEXT NOT NULL,
        alt_text TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        revision INTEGER NOT NULL DEFAULT 1,
        last_request_id TEXT
      );
      CREATE TABLE admin_media_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        actor_subject TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_key TEXT NOT NULL,
        previous_revision INTEGER,
        resulting_revision INTEGER NOT NULL,
        payload_sha256 TEXT NOT NULL
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        actor_subject TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  prepare(query: string): SqliteMediaStatement {
    return new SqliteMediaStatement(query, this.sqlite.prepare(query));
  }

  async batch(statements: SqliteMediaStatement[]): Promise<Array<{ results?: unknown[] }>> {
    this.sqlite.exec("BEGIN");
    try {
      const results: Array<{ results?: unknown[] }> = [];
      for (const statement of statements) {
        if (this.skipQuery?.test(statement.query)) results.push({ results: [] });
        else results.push(await statement.run());
      }
      this.sqlite.exec("COMMIT");
      return this.omitBatchResults ? statements.map(() => ({})) : results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

test("SQLite media postconditions are atomic when results are omitted", async () => {
  const database = new SqliteMediaDatabase({ omitBatchResults: true });
  const bucket = new FakeBucket();
  try {
    database.sqlite.prepare("INSERT INTO products (id, name) VALUES (1, 'Sản phẩm')").run();
    const created = await createMediaAsset(database, bucket, createInput());
    const updated = await updateMediaAssetAltText(database, created.id, "Alt SQL", 1, "owner@example.com", altRequest);
    const deleted = await deleteMediaAsset(database, bucket, created.id, 2, "owner@example.com", deleteRequest);
    const row = database.sqlite.prepare("SELECT status, revision FROM media_assets WHERE id = ?").get(created.id) as { status: string; revision: number };

    assert.equal(updated?.revision, 2);
    assert.equal(deleted?.revision, 3);
    assert.equal(row.status, "deleted");
    assert.equal(row.revision, 3);
  } finally {
    database.sqlite.close();
  }
});

test("SQLite media postconditions roll back a missing legacy audit", async () => {
  const database = new SqliteMediaDatabase({ skipQuery: /INSERT INTO audit_logs/ });
  const bucket = new FakeBucket();
  try {
    database.sqlite.prepare("INSERT INTO products (id, name) VALUES (1, 'Sản phẩm')").run();
    await assert.rejects(
      () => createMediaAsset(database, bucket, createInput()),
      MediaWriteStorageError,
    );
    assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM media_assets").get()?.count, 0);
    assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM admin_media_audit").get()?.count, 0);
  } finally {
    database.sqlite.close();
  }
});
