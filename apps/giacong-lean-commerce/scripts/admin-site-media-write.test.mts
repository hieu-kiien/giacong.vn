import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";
import {
  createSiteMediaAsset,
  deleteSiteMediaAsset,
  SiteMediaStorageError,
  replaceActiveSiteMedia,
} from "../src/lib/site-media-data.ts";
import type { R2BucketLike } from "../src/lib/media-data.ts";

const createRequest = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secondCreateRequest = "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const deleteRequest = "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer;

type SiteRow = {
  id: string;
  setting_key: string;
  storage_key: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  checksum_sha256: string;
  status: "active" | "deleted" | "replaced";
  revision: number;
  created_at: string;
};

type Marker = {
  action: "create" | "update" | "delete";
  entity_key: string;
  payload_sha256: string;
  request_id: string;
};

class FakeBucket implements R2BucketLike {
  readonly objects = new Set<string>();

  async put(key: string): Promise<void> {
    this.objects.add(key);
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

class FakeStatement implements D1PreparedStatementLike {
  values: unknown[] = [];
  private readonly database: FakeSiteMediaDatabase;
  readonly query: string;

  constructor(database: FakeSiteMediaDatabase, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
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

class FakeSiteMediaDatabase implements D1DatabaseLike {
  readonly rows = new Map<string, SiteRow>();
  readonly markers = new Map<string, Marker>();
  legacyAudits = 0;
  private readonly omitBatchResults: boolean;
  private readonly skipLegacyAudit: boolean;

  constructor(options: { omitBatchResults?: boolean; skipLegacyAudit?: boolean } = {}) {
    this.omitBatchResults = options.omitBatchResults ?? false;
    this.skipLegacyAudit = options.skipLegacyAudit ?? false;
  }

  prepare(query: string): FakeStatement {
    return new FakeStatement(this, query);
  }

  async batch(statements: FakeStatement[]): Promise<Array<{ results?: unknown[] }>> {
    const snapshot = this.snapshot();
    try {
      const results: Array<{ results?: unknown[] }> = [];
      for (const statement of statements) results.push(await statement.run() as { results?: unknown[] });
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
    if (query.includes("site-media-write-postcondition-read")) {
      const requestId = String(values[0]);
      const marker = this.markers.get(requestId);
      const row = marker ? this.rows.get(marker.entity_key) : undefined;
      const needsLegacy = values.length > 9;
      return (marker && row && (!needsLegacy || this.legacyAudits > 0) ? { complete: 1 } : { complete: 0 }) as T;
    }
    if (query.includes("FROM admin_media_audit")) return (this.markers.get(String(values[0])) ?? null) as T | null;
    if (query.includes("FROM site_media_assets")) return (this.rows.get(String(values[0])) ?? null) as T | null;
    throw new Error(`Unexpected first query: ${query}`);
  }

  all<T>(query: string, values: unknown[]): T[] {
    if (!query.includes("FROM site_media_assets")) return [];
    const settingKey = String(values[0]);
    const exceptId = String(values[1]);
    return [...this.rows.values()].filter((row) => row.setting_key === settingKey && row.status === "active" && row.id !== exceptId) as T[];
  }

  execute(query: string, values: unknown[]): { results?: unknown[] } {
    if (query.includes("site-media-write-postcondition")) {
      const requestId = String(values[0]);
      const marker = this.markers.get(requestId);
      const row = marker ? this.rows.get(marker.entity_key) : undefined;
      const needsLegacy = values.length > 9;
      if (!marker || !row || (needsLegacy && this.legacyAudits === 0)) {
        throw new Error("NOT NULL constraint failed: admin_media_audit.request_id");
      }
      return { results: [{ complete: 1 }] };
    }
    if (query.includes("INSERT INTO site_media_assets")) {
      const [id, settingKey, storageKey, filename, contentType, byteSize, checksum, createdBy, requestId] = values;
      this.rows.set(String(id), {
        id: String(id),
        setting_key: String(settingKey),
        storage_key: String(storageKey),
        original_filename: String(filename),
        content_type: String(contentType),
        byte_size: Number(byteSize),
        checksum_sha256: String(checksum),
        status: "active",
        revision: 1,
        created_at: "2026-09-03T00:00:00.000Z",
      });
      void createdBy;
      void requestId;
      return { results: [{ id }] };
    }
    if (query.includes("UPDATE site_media_assets")) {
      const [requestId, id, expectedRevision] = values;
      const row = this.rows.get(String(id));
      if (!row || row.revision !== Number(expectedRevision) || (query.includes("status <> 'deleted'") && row.status === "deleted")) return { results: [] };
      row.status = query.includes("status = 'replaced'") ? "replaced" : "deleted";
      row.revision += 1;
      void requestId;
      return { results: [{ id: row.id }] };
    }
    if (query.includes("INSERT INTO admin_media_audit")) {
      const isCreate = query.includes("VALUES (?, ?, 'create'");
      const requestId = String(values[0]);
      const marker: Marker = {
        action: isCreate ? "create" : String(values[2]) as Marker["action"],
        entity_key: String(isCreate ? values[2] : values[3]),
        payload_sha256: String(isCreate ? values[3] : values[6]),
        request_id: requestId,
      };
      if (this.markers.has(requestId)) throw new Error("UNIQUE constraint failed: admin_media_audit.request_id");
      this.markers.set(requestId, marker);
      return { results: [{ request_id: requestId }] };
    }
    if (query.includes("INSERT INTO audit_logs")) {
      if (this.skipLegacyAudit) return { results: [] };
      this.legacyAudits += 1;
      return { results: [{ id: values[0] }] };
    }
    throw new Error(`Unhandled fake statement: ${query}`);
  }

  private snapshot() {
    return {
      rows: new Map([...this.rows].map(([key, value]) => [key, { ...value }])),
      markers: new Map([...this.markers].map(([key, value]) => [key, { ...value }])),
      legacyAudits: this.legacyAudits,
    };
  }

  private restore(snapshot: ReturnType<FakeSiteMediaDatabase["snapshot"]>): void {
    this.rows.clear();
    for (const [key, value] of snapshot.rows) this.rows.set(key, value);
    this.markers.clear();
    for (const [key, value] of snapshot.markers) this.markers.set(key, value);
    this.legacyAudits = snapshot.legacyAudits;
  }
}

function createInput(requestId: string) {
  return {
    bytes,
    checksumSha256: "b".repeat(64),
    contentType: "image/png",
    createdBy: "owner@example.com",
    originalFilename: "logo.png",
    requestId,
    settingKey: "logo",
  };
}

test("site media writes remain successful when D1 omits batch result rows", async () => {
  const database = new FakeSiteMediaDatabase({ omitBatchResults: true });
  const bucket = new FakeBucket();
  const first = await createSiteMediaAsset(database, bucket, createInput(createRequest));
  const second = await createSiteMediaAsset(database, bucket, createInput(secondCreateRequest));

  await replaceActiveSiteMedia(database, "logo", second.id, "owner@example.com", deleteRequest);
  await deleteSiteMediaAsset(database, bucket, second.id, 1, "owner@example.com", "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

  assert.equal(database.rows.get(first.id)?.status, "replaced");
  assert.equal(database.rows.get(first.id)?.revision, 2);
  assert.equal(database.rows.get(second.id)?.status, "deleted");
  assert.equal(database.rows.get(second.id)?.revision, 2);
});

test("site media replacement rolls back when its legacy audit is missing", async () => {
  const database = new FakeSiteMediaDatabase();
  const bucket = new FakeBucket();
  const first = await createSiteMediaAsset(database, bucket, createInput(createRequest));
  const second = await createSiteMediaAsset(database, bucket, createInput(secondCreateRequest));
  const failingDatabase = new FakeSiteMediaDatabase({ skipLegacyAudit: true });
  failingDatabase.rows.set(first.id, { ...database.rows.get(first.id)! });
  failingDatabase.rows.set(second.id, { ...database.rows.get(second.id)! });
  failingDatabase.markers.set(createRequest, { ...database.markers.get(createRequest)! });
  failingDatabase.markers.set(secondCreateRequest, { ...database.markers.get(secondCreateRequest)! });
  failingDatabase.legacyAudits = database.legacyAudits;

  await assert.rejects(
    () => replaceActiveSiteMedia(failingDatabase, "logo", second.id, "owner@example.com", deleteRequest),
    SiteMediaStorageError,
  );
  assert.equal(failingDatabase.rows.get(first.id)?.status, "active");
  assert.equal(failingDatabase.rows.get(first.id)?.revision, 1);
});

test("site media replay rejects when the legacy delete audit is missing", async () => {
  const database = new FakeSiteMediaDatabase();
  const bucket = new FakeBucket();
  const asset = await createSiteMediaAsset(database, bucket, createInput(createRequest));
  await deleteSiteMediaAsset(database, bucket, asset.id, 1, "owner@example.com", deleteRequest);
  database.legacyAudits = 0;

  await assert.rejects(
    () => deleteSiteMediaAsset(database, bucket, asset.id, 1, "owner@example.com", deleteRequest),
    SiteMediaStorageError,
  );
});

class SqliteSiteMediaStatement implements D1PreparedStatementLike {
  readonly query: string;
  private readonly statement: ReturnType<DatabaseSync["prepare"]>;
  private values: unknown[] = [];

  constructor(query: string, statement: ReturnType<DatabaseSync["prepare"]>) {
    this.query = query;
    this.statement = statement;
  }

  bind(...values: unknown[]): SqliteSiteMediaStatement {
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

class SqliteSiteMediaDatabase implements D1DatabaseLike {
  readonly sqlite = new DatabaseSync(":memory:");
  private readonly omitBatchResults: boolean;
  private readonly skipQuery?: RegExp;

  constructor(options: { omitBatchResults?: boolean; skipQuery?: RegExp } = {}) {
    this.omitBatchResults = options.omitBatchResults ?? false;
    this.skipQuery = options.skipQuery;
    this.sqlite.exec(`
      CREATE TABLE site_settings (setting_key TEXT PRIMARY KEY);
      INSERT INTO site_settings (setting_key) VALUES ('logo');
      CREATE TABLE site_media_assets (
        id TEXT PRIMARY KEY,
        setting_key TEXT NOT NULL,
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

  prepare(query: string): SqliteSiteMediaStatement {
    return new SqliteSiteMediaStatement(query, this.sqlite.prepare(query));
  }

  async batch(statements: SqliteSiteMediaStatement[]): Promise<Array<{ meta?: { changes: number }; results?: unknown[] }>> {
    this.sqlite.exec("BEGIN");
    try {
      const results: Array<{ meta?: { changes: number }; results?: unknown[] }> = [];
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

test("SQLite site media postconditions are atomic when results are omitted", async () => {
  const database = new SqliteSiteMediaDatabase({ omitBatchResults: true });
  const bucket = new FakeBucket();
  try {
    const first = await createSiteMediaAsset(database, bucket, createInput(createRequest));
    const second = await createSiteMediaAsset(database, bucket, createInput(secondCreateRequest));
    await replaceActiveSiteMedia(database, "logo", second.id, "owner@example.com", deleteRequest);
    await deleteSiteMediaAsset(database, bucket, second.id, 1, "owner@example.com", "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    const firstRow = database.sqlite.prepare("SELECT status, revision FROM site_media_assets WHERE id = ?").get(first.id) as { status: string; revision: number };
    const secondRow = database.sqlite.prepare("SELECT status, revision FROM site_media_assets WHERE id = ?").get(second.id) as { status: string; revision: number };
    assert.equal(firstRow.status, "replaced");
    assert.equal(firstRow.revision, 2);
    assert.equal(secondRow.status, "deleted");
    assert.equal(secondRow.revision, 2);
  } finally {
    database.sqlite.close();
  }
});

test("SQLite site media postconditions roll back a missing replacement audit", async () => {
  const database = new SqliteSiteMediaDatabase({ skipQuery: /INSERT INTO audit_logs/ });
  const bucket = new FakeBucket();
  try {
    const first = await createSiteMediaAsset(database, bucket, createInput(createRequest));
    const second = await createSiteMediaAsset(database, bucket, createInput(secondCreateRequest));
    await assert.rejects(
      () => replaceActiveSiteMedia(database, "logo", second.id, "owner@example.com", deleteRequest),
      SiteMediaStorageError,
    );
    const row = database.sqlite.prepare("SELECT status, revision FROM site_media_assets WHERE id = ?").get(first.id) as { status: string; revision: number };
    assert.equal(row.status, "active");
    assert.equal(row.revision, 1);
  } finally {
    database.sqlite.close();
  }
});
