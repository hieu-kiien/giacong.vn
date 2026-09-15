import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  AdminServiceWriteConflictError,
  AdminServiceWriteIdempotencyConflictError,
  AdminServiceWriteStorageError,
  archiveAdminServiceAtomically,
  createAdminServiceAtomically,
  updateAdminServiceAtomically,
} from "../src/lib/admin-service-write.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";

const root = new URL("../", import.meta.url);
const actor = "owner@example.com";
const createRequestId = "11111111-1111-4111-8111-111111111111";
const updateRequestId = "22222222-2222-4222-8222-222222222222";
const archiveRequestId = "33333333-3333-4333-8333-333333333333";
const sqliteDatabases = new Set<DatabaseSync>();

const input = {
  description: "Mô tả dịch vụ",
  imageUrl: "/media/services/demo.webp",
  isActive: false,
  leadTimeDays: 14,
  moqSummary: "Từ 500 kg / mẻ",
  name: "Gia công thử nghiệm",
  slug: "gia-cong-thu-nghiem",
  status: "draft" as const,
  summary: "Tóm tắt dịch vụ",
};

type ServiceState = {
  description: string;
  id: number;
  image_url: string | null;
  is_active: number;
  name: string;
  revision: number;
  slug: string;
  summary: string;
};

type MutationState = {
  action: string;
  entity_key: string;
  entity_type: string;
  payload_sha256: string;
  request_id: string;
};

class FakeServiceWriteDatabase implements D1DatabaseLike {
  service: ServiceState = {
    description: "Cũ",
    id: 7,
    image_url: null,
    is_active: 1,
    name: "Dịch vụ cũ",
    revision: 4,
    slug: "dich-vu-cu",
    summary: "Cũ",
  };
  readonly mutations = new Map<string, MutationState>();
  readonly legacyAudits = new Set<string>();
  readonly legacyAuditRequests = new Set<string>();
  readonly meta = new Set<number>();
  readonly batches: FakeServiceWriteStatement[][] = [];
  failLegacyAudit = false;
  returnEmptyLegacyAudit = false;
  returnEmptyMeta = false;
  returnEmptyMutation = false;
  returnEmptyMutationResult = false;
  raceBeforeBatch = false;
  private nextId = 8;
  private lastChanges = 0;
  private serviceWriteSucceeded = false;

  prepare(query: string): FakeServiceWriteStatement {
    return new FakeServiceWriteStatement(this, query);
  }

  async first<T>(query: string, values: unknown[]): Promise<T | null> {
    if (query.includes("sqlite_master")) {
      const table = String(values[0]);
      return (["admin_audit_log", "audit_logs", "service_admin_meta"].includes(table) ? { name: table } : null) as T | null;
    }
    if (query.includes("service-write-postcondition-read")) {
      const requestId = String(values[0]);
      const mutation = this.mutations.get(requestId);
      const complete = Boolean(
        mutation
        && this.legacyAuditRequests.has(requestId)
        && this.meta.has(Number(mutation.entity_key)),
      );
      return { complete: complete ? 1 : 0 } as T;
    }
    if (query.includes("FROM admin_audit_log")) return (this.mutations.get(String(values[0])) ?? null) as T | null;
    if (query.includes("SELECT id, revision") && query.includes("FROM services")) {
      return this.service && this.service.id === Number(values[0]) ? { id: this.service.id, revision: this.service.revision } as T : null;
    }
    return null;
  }

  async batch(statements: FakeServiceWriteStatement[]): Promise<Array<{ meta: { changes: number }; results?: unknown[] }>> {
    this.batches.push([...statements]);
    const snapshot = structuredClone({
      legacyAudits: [...this.legacyAudits],
      legacyAuditRequests: [...this.legacyAuditRequests],
      meta: [...this.meta],
      mutations: [...this.mutations.entries()],
      nextId: this.nextId,
      service: this.service,
    });
    this.serviceWriteSucceeded = false;
    this.pendingRequestId = null;
    try {
      return statements.map((statement) => this.execute(statement.query, statement.values));
    } catch (error) {
      this.legacyAudits.clear();
      snapshot.legacyAudits.forEach((id) => this.legacyAudits.add(id));
      this.legacyAuditRequests.clear();
      snapshot.legacyAuditRequests.forEach((requestId) => this.legacyAuditRequests.add(requestId));
      this.meta.clear();
      snapshot.meta.forEach((id) => this.meta.add(id));
      this.mutations.clear();
      snapshot.mutations.forEach(([id, mutation]) => this.mutations.set(id, mutation));
      this.nextId = snapshot.nextId;
      this.service = snapshot.service;
      this.serviceWriteSucceeded = false;
      this.pendingRequestId = null;
      throw error;
    }
  }

  private execute(query: string, values: unknown[]): { meta: { changes: number }; results?: unknown[] } {
    if (query.includes("INSERT INTO services")) {
      const [slug, name, summary, description, imageUrl, isActive] = values;
      this.service = {
        description: String(description),
        id: this.nextId++,
        image_url: (imageUrl as string | null) ?? null,
        is_active: Number(isActive),
        name: String(name),
        revision: 1,
        slug: String(slug),
        summary: String(summary),
      };
      this.lastChanges = 1;
      this.serviceWriteSucceeded = true;
      return { meta: { changes: 1 }, results: [{ id: this.service.id, revision: 1 }] };
    }
    if (query.includes("UPDATE services")) return this.executeServiceUpdate(query, values);
    if (query.includes("service-write-postcondition-assert")) return this.executePostconditionAssertion();
    if (query.includes("INSERT INTO admin_audit_log")) return this.executeMutation(query, values);
    if (query.includes("INSERT INTO audit_logs")) {
      if (this.failLegacyAudit) throw new Error("legacy audit failed");
      if (this.returnEmptyLegacyAudit) {
        this.lastChanges = 0;
        return { meta: { changes: 0 }, results: [] };
      }
      if (this.lastChanges !== 1) return { meta: { changes: 0 }, results: [] };
      const id = String(values[0]);
      this.legacyAudits.add(id);
      this.legacyAuditRequests.add(String(values[4]));
      this.lastChanges = 1;
      return { meta: { changes: 1 }, results: [{ id }] };
    }
    if (query.includes("INSERT INTO service_admin_meta")) {
      if (this.returnEmptyMeta) {
        this.lastChanges = 0;
        return { meta: { changes: 0 }, results: [] };
      }
      if (this.lastChanges !== 1) return { meta: { changes: 0 }, results: [] };
      const serviceId = query.includes("CAST(entity_key AS INTEGER)")
        ? Number(this.mutations.get(String(values[0]))?.entity_key)
        : Number(values[0]);
      if (!Number.isSafeInteger(serviceId) || serviceId < 1) {
        this.lastChanges = 0;
        return { meta: { changes: 0 }, results: [] };
      }
      this.meta.add(serviceId);
      this.lastChanges = 1;
      return { meta: { changes: 1 }, results: [{ service_id: serviceId }] };
    }
    throw new Error(`Unhandled fake statement: ${query}`);
  }

  private executeServiceUpdate(query: string, values: unknown[]): { meta: { changes: number }; results?: unknown[] } {
    const isArchive = !query.includes("SET slug");
    const id = Number(values[isArchive ? 0 : 6]);
    const expectedRevision = Number(values[isArchive ? 1 : 7]);
    if (this.raceBeforeBatch) {
      this.service.revision += 1;
      this.raceBeforeBatch = false;
    }
    if (this.service.id !== id || this.service.revision !== expectedRevision) {
      this.lastChanges = 0;
      return { meta: { changes: 0 }, results: [] };
    }
    if (isArchive) this.service.is_active = 0;
    else {
      this.service.slug = String(values[0]);
      this.service.name = String(values[1]);
      this.service.summary = String(values[2]);
      this.service.description = String(values[3]);
      this.service.image_url = (values[4] as string | null) ?? null;
      this.service.is_active = Number(values[5]);
    }
    this.service.revision += 1;
    this.serviceWriteSucceeded = true;
    this.lastChanges = 1;
    return { meta: { changes: 1 }, results: [{ id, revision: this.service.revision }] };
  }

  private executeMutation(query: string, values: unknown[]): { meta: { changes: number }; results?: unknown[] } {
    this.pendingRequestId = String(values[0]);
    if (this.lastChanges !== 1) return { meta: { changes: 0 }, results: [] };
    if (this.returnEmptyMutation) {
      this.lastChanges = 0;
      return { meta: { changes: 0 }, results: [] };
    }
    const requestId = String(values[0]);
    if (this.mutations.has(requestId)) throw new Error("UNIQUE constraint failed: admin_audit_log.request_id");
    const action = query.includes("'create'") ? "create" : query.includes("'delete'") ? "delete" : "update";
    const payloadSha256 = String(values[action === "create" ? 2 : 3]);
    this.mutations.set(requestId, {
      action,
      entity_key: String(this.service.id),
      entity_type: "service",
      payload_sha256: payloadSha256,
      request_id: requestId,
    });
    this.lastChanges = 1;
    if (this.returnEmptyMutationResult) return { meta: { changes: 1 }, results: [] };
    return { meta: { changes: 1 }, results: [{ request_id: requestId }] };
  }

  private pendingRequestId: string | null = null;

  private executePostconditionAssertion(): { meta: { changes: number }; results?: unknown[] } {
    const requestId = this.pendingRequestId;
    const mutation = requestId ? this.mutations.get(requestId) : null;
    if (!requestId || !mutation) {
      if (this.serviceWriteSucceeded) throw new Error("service write postcondition failed");
      this.lastChanges = 0;
      return { meta: { changes: 0 }, results: [] };
    }
    const complete = Boolean(
      mutation
      && this.legacyAuditRequests.has(requestId)
      && this.meta.has(Number(mutation.entity_key)),
    );
    if (!complete) throw new Error("service write postcondition failed");
    this.lastChanges = 0;
    return { meta: { changes: 0 }, results: [] };
  }
}

class FakeServiceWriteStatement implements D1PreparedStatementLike {
  readonly query: string;
  values: unknown[] = [];
  private readonly database: FakeServiceWriteDatabase;

  constructor(database: FakeServiceWriteDatabase, query: string) {
    this.database = database;
    this.query = query.replace(/\s+/g, " ").trim();
  }

  bind(...values: unknown[]): FakeServiceWriteStatement {
    this.values = values;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async first<T>(): Promise<T | null> {
    return this.database.first<T>(this.query, this.values);
  }

  async run(): Promise<unknown> {
    throw new Error("service writes must use D1 batch()");
  }
}

class SqliteServiceWriteStatement implements D1PreparedStatementLike {
  readonly query: string;
  private values: unknown[] = [];
  private readonly statement: ReturnType<DatabaseSync["prepare"]>;

  constructor(query: string, statement: ReturnType<DatabaseSync["prepare"]>) {
    this.query = query.replace(/\s+/g, " ").trim();
    this.statement = statement;
  }

  bind(...values: unknown[]): SqliteServiceWriteStatement {
    this.values = values;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...(this.values as never[])) as T[] };
  }

  async first<T>(): Promise<T | null> {
    return (this.statement.get(...(this.values as never[])) as T | undefined) ?? null;
  }

  async run(): Promise<unknown> {
    this.statement.run(...(this.values as never[]));
    return {};
  }
}

class SqliteServiceWriteDatabase implements D1DatabaseLike {
  readonly sqlite = new DatabaseSync(":memory:");
  faultAfterLegacyAudit = false;
  faultAfterMutationMarker = false;

  constructor() {
    sqliteDatabases.add(this.sqlite);
    this.sqlite.exec(`
      CREATE TABLE services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        summary TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        meta_title TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE service_slug_redirects (
        old_slug TEXT PRIMARY KEY,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE service_admin_meta (
        service_id INTEGER PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'archived')),
        lead_time_days INTEGER,
        moq_summary TEXT,
        offerings_json TEXT,
        cta_label TEXT,
        cta_href TEXT,
        sort_order INTEGER,
        capabilities_json TEXT NOT NULL DEFAULT '[]',
        process_steps_json TEXT NOT NULL DEFAULT '[]',
        certifications_json TEXT NOT NULL DEFAULT '[]',
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE admin_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
        action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'upload')),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('category', 'product', 'variant', 'tier_prices', 'media', 'service')),
        entity_key TEXT NOT NULL CHECK (length(entity_key) BETWEEN 1 AND 500),
        previous_revision INTEGER CHECK (previous_revision IS NULL OR previous_revision > 0),
        resulting_revision INTEGER CHECK (resulting_revision IS NULL OR resulting_revision > 0),
        payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64)
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        actor_subject TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO services (slug, name, summary, description, image_url, is_active, revision)
      VALUES ('dich-vu-cu', 'Dịch vụ cũ', 'Cũ', 'Cũ', NULL, 1, 1);
    `);
  }

  prepare(query: string): SqliteServiceWriteStatement {
    return new SqliteServiceWriteStatement(query, this.sqlite.prepare(query));
  }

  async batch(statements: SqliteServiceWriteStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.all());
        if (this.faultAfterMutationMarker
          && statement.query.includes("INSERT INTO admin_audit_log")
          && !statement.query.includes("service-write-postcondition-assert")) {
          this.sqlite.exec("DELETE FROM admin_audit_log");
        }
        if (this.faultAfterLegacyAudit && statement.query.includes("INSERT INTO audit_logs")) {
          this.sqlite.exec("DELETE FROM audit_logs");
        }
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

test.afterEach(() => {
  for (const sqlite of sqliteDatabases) sqlite.close();
  sqliteDatabases.clear();
});

function sqliteServiceCount(database: SqliteServiceWriteDatabase, table: "services" | "service_admin_meta" | "admin_audit_log" | "audit_logs"): number {
  return Number((database.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

async function read(path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

test("service create couples row, idempotency audit, legacy audit and meta in one batch", async () => {
  const database = new FakeServiceWriteDatabase();

  const id = await createAdminServiceAtomically(database, input, actor, createRequestId);

  assert.equal(id, 8);
  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0]?.length, 5);
  assert.equal(database.service.revision, 1);
  assert.equal(database.mutations.size, 1);
  assert.equal(database.legacyAudits.size, 1);
  assert.deepEqual([...database.meta], [8]);
  assert.equal(database.meta.has(8), true);
  assert.match(database.batches[0]?.[0]?.query ?? "", /INSERT INTO services/);
  assert.match(database.batches[0]?.[1]?.query ?? "", /INSERT INTO admin_audit_log/);
  assert.match(database.batches[0]?.[2]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(database.batches[0]?.[3]?.query ?? "", /INSERT INTO service_admin_meta/);
  assert.match(database.batches[0]?.[4]?.query ?? "", /service-write-postcondition-assert/);
});

test("service update and archive use exact revision CAS and increment once", async () => {
  const database = new FakeServiceWriteDatabase();

  await updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId);
  assert.equal(database.service.revision, 5);
  assert.equal(database.service.name, input.name);
  assert.equal(database.mutations.get(updateRequestId)?.action, "update");

  await archiveAdminServiceAtomically(database, 7, 5, actor, archiveRequestId);
  assert.equal(database.service.revision, 6);
  assert.equal(database.service.is_active, 0);
  assert.equal(database.mutations.get(archiveRequestId)?.action, "delete");
});

test("service retries replay without a second batch and conflicts on a different payload", async () => {
  const database = new FakeServiceWriteDatabase();

  const first = await updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId);
  const replay = await updateAdminServiceAtomically(database, 7, input, 4, "other@example.com", updateRequestId);
  assert.equal(first, 7);
  assert.equal(replay, 7);
  assert.equal(database.batches.length, 1);

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 7, { ...input, name: "Khác" }, 4, actor, updateRequestId),
    AdminServiceWriteIdempotencyConflictError,
  );
  assert.equal(database.batches.length, 1);
});

test("stale service update rolls back every coupled write", async () => {
  const database = new FakeServiceWriteDatabase();
  database.raceBeforeBatch = true;

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId),
    AdminServiceWriteConflictError,
  );
  assert.equal(database.batches.length, 1);
  assert.equal(database.service.revision, 5);
  assert.equal(database.mutations.size, 0);
  assert.equal(database.legacyAudits.size, 0);
  assert.equal(database.meta.size, 0);
});

test("a legacy audit failure rolls back the service row, marker and meta", async () => {
  const database = new FakeServiceWriteDatabase();
  database.failLegacyAudit = true;

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId),
    /legacy audit failed/,
  );
  assert.equal(database.service.revision, 4);
  assert.equal(database.service.name, "Dịch vụ cũ");
  assert.equal(database.mutations.size, 0);
  assert.equal(database.legacyAudits.size, 0);
  assert.equal(database.meta.size, 0);
});

test("service postcondition assertion is valid SQLite and rolls back a missing legacy audit", async () => {
  const database = new SqliteServiceWriteDatabase();
  database.faultAfterLegacyAudit = true;

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 1, input, 1, actor, updateRequestId),
    AdminServiceWriteStorageError,
  );

  const service = database.sqlite.prepare("SELECT revision, name FROM services WHERE id = 1").get() as { revision: number; name: string };
  assert.equal(service.name, "Dịch vụ cũ");
  assert.equal(service.revision, 1);
  assert.equal(sqliteServiceCount(database, "admin_audit_log"), 0);
  assert.equal(sqliteServiceCount(database, "audit_logs"), 0);
  assert.equal(sqliteServiceCount(database, "service_admin_meta"), 0);
});

test("service postcondition assertion rolls back when the mutation marker is missing", async () => {
  const database = new SqliteServiceWriteDatabase();
  database.faultAfterMutationMarker = true;

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 1, input, 1, actor, updateRequestId),
    AdminServiceWriteStorageError,
  );

  const service = database.sqlite.prepare("SELECT revision, name FROM services WHERE id = 1").get() as { revision: number; name: string };
  assert.equal(service.name, "Dịch vụ cũ");
  assert.equal(service.revision, 1);
  assert.equal(sqliteServiceCount(database, "admin_audit_log"), 0);
  assert.equal(sqliteServiceCount(database, "audit_logs"), 0);
  assert.equal(sqliteServiceCount(database, "service_admin_meta"), 0);
});

test("service postcondition assertion accepts create, update, archive and replay in SQLite", async () => {
  const database = new SqliteServiceWriteDatabase();
  const updatedInput = { ...input, isActive: true, name: "Gia công cập nhật", status: "published" as const };

  const createdId = await createAdminServiceAtomically(database, input, actor, createRequestId);
  assert.equal(createdId, 2);
  assert.equal(await createAdminServiceAtomically(database, input, "other@example.com", createRequestId), 2);

  const updatedId = await updateAdminServiceAtomically(database, 2, updatedInput, 1, actor, updateRequestId);
  assert.equal(updatedId, 2);
  const replayedUpdateId = await updateAdminServiceAtomically(database, 2, updatedInput, 1, "other@example.com", updateRequestId);
  assert.equal(replayedUpdateId, 2);
  const archivedId = await archiveAdminServiceAtomically(database, 2, 2, actor, archiveRequestId);
  assert.equal(archivedId, 2);
  const replayedArchiveId = await archiveAdminServiceAtomically(database, 2, 2, "other@example.com", archiveRequestId);
  assert.equal(replayedArchiveId, 2);
  assert.equal(await createAdminServiceAtomically(database, input, "other@example.com", createRequestId), 2);
  assert.equal(await updateAdminServiceAtomically(database, 2, updatedInput, 1, "other@example.com", updateRequestId), 2);

  assert.equal(sqliteServiceCount(database, "services"), 2);
  assert.equal(sqliteServiceCount(database, "admin_audit_log"), 3);
  assert.equal(sqliteServiceCount(database, "audit_logs"), 3);
  assert.equal(sqliteServiceCount(database, "service_admin_meta"), 1);
});

test("published service slug changes preserve the previous public URL", async () => {
  const database = new SqliteServiceWriteDatabase();
  const renamedInput = {
    ...input,
    isActive: true,
    slug: "gia-cong-thu-nghiem-moi",
    status: "published" as const,
  };

  await updateAdminServiceAtomically(database, 1, renamedInput, 1, actor, updateRequestId);

  const redirect = database.sqlite.prepare(`
    SELECT old_slug, service_id
    FROM service_slug_redirects
    WHERE old_slug = 'dich-vu-cu'
  `).get() as { old_slug: string; service_id: number } | undefined;
  assert.equal(redirect?.old_slug, "dich-vu-cu");
  assert.equal(redirect?.service_id, 1);
});

test("a missing legacy audit postcondition rolls back the complete service update", async () => {
  const database = new FakeServiceWriteDatabase();
  database.returnEmptyLegacyAudit = true;

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId),
    AdminServiceWriteStorageError,
  );
  assert.equal(database.service.revision, 4);
  assert.equal(database.service.name, "Dịch vụ cũ");
  assert.equal(database.mutations.size, 0);
  assert.equal(database.legacyAudits.size, 0);
  assert.equal(database.meta.size, 0);
});

test("a missing mutation marker postcondition rolls back the complete service update", async () => {
  const database = new FakeServiceWriteDatabase();
  database.returnEmptyMutation = true;

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId),
    AdminServiceWriteStorageError,
  );
  assert.equal(database.service.revision, 4);
  assert.equal(database.service.name, "Dịch vụ cũ");
  assert.equal(database.mutations.size, 0);
  assert.equal(database.legacyAudits.size, 0);
  assert.equal(database.meta.size, 0);
});

test("a missing legacy audit postcondition rolls back the complete service create", async () => {
  const database = new FakeServiceWriteDatabase();
  database.returnEmptyLegacyAudit = true;

  await assert.rejects(
    () => createAdminServiceAtomically(database, input, actor, createRequestId),
    AdminServiceWriteStorageError,
  );
  assert.equal(database.service.id, 7);
  assert.equal(database.mutations.size, 0);
  assert.equal(database.legacyAudits.size, 0);
  assert.equal(database.meta.size, 0);
});

test("a missing legacy audit postcondition rolls back the complete service archive", async () => {
  const database = new FakeServiceWriteDatabase();
  database.returnEmptyLegacyAudit = true;

  await assert.rejects(
    () => archiveAdminServiceAtomically(database, 7, 4, actor, archiveRequestId),
    AdminServiceWriteStorageError,
  );
  assert.equal(database.service.revision, 4);
  assert.equal(database.service.is_active, 1);
  assert.equal(database.mutations.size, 0);
  assert.equal(database.legacyAudits.size, 0);
  assert.equal(database.meta.size, 0);
});

test("a missing service meta postcondition rolls back the complete service update", async () => {
  const database = new FakeServiceWriteDatabase();
  database.returnEmptyMeta = true;

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId),
    AdminServiceWriteStorageError,
  );
  assert.equal(database.service.revision, 4);
  assert.equal(database.mutations.size, 0);
  assert.equal(database.legacyAudits.size, 0);
  assert.equal(database.meta.size, 0);
});

test("a complete service batch remains successful when D1 omits returned rows", async () => {
  const database = new FakeServiceWriteDatabase();
  database.returnEmptyMutationResult = true;

  const id = await updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId);

  assert.equal(id, 7);
  assert.equal(database.service.revision, 5);
  assert.equal(database.mutations.size, 1);
  assert.equal(database.legacyAudits.size, 1);
  assert.equal(database.meta.size, 1);
});

test("an incomplete existing service marker is never treated as a successful replay", async () => {
  const database = new FakeServiceWriteDatabase();

  await updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId);
  database.legacyAudits.clear();
  database.legacyAuditRequests.clear();
  database.meta.clear();

  await assert.rejects(
    () => updateAdminServiceAtomically(database, 7, input, 4, actor, updateRequestId),
    AdminServiceWriteStorageError,
  );
  assert.equal(database.batches.length, 1);
});

test("service routes and UI use exact commands, bounded parsing, revisions and atomic writers", async () => {
  const [collectionRoute, itemRoute, page, mediaPanel, writer, revision] = await Promise.all([
    read("src/app/api/admin/services/route.ts"),
    read("src/app/api/admin/services/[id]/route.ts"),
    read("src/app/admin/dich-vu/page.tsx"),
    read("src/components/admin/AdminMediaPanel.tsx"),
    read("src/lib/admin-service-write.ts"),
    read("src/lib/admin-service-revision.ts"),
  ]);

  assert.match(collectionRoute, /parseAdminServiceCreateCommand/);
  assert.match(collectionRoute, /createAdminServiceAtomically/);
  assert.match(collectionRoute, /attachAdminServiceRevisions/);
  assert.doesNotMatch(collectionRoute, /createAdminService\(/);
  assert.match(itemRoute, /parseAdminServiceUpdateCommand/);
  assert.match(itemRoute, /parseAdminServiceArchiveCommand/);
  assert.match(itemRoute, /updateAdminServiceAtomically/);
  assert.match(itemRoute, /archiveAdminServiceAtomically/);
  assert.match(itemRoute, /STALE_WRITE/);
  assert.match(itemRoute, /readBoundedAdminJson/);
  assert.doesNotMatch(itemRoute, /updateAdminService\(|archiveAdminService\(/);
  assert.match(page, /requestId: crypto\.randomUUID\(\)/);
  assert.match(page, /revision/);
  assert.match(page, /requestId:\s*crypto\.randomUUID\(\)/);
  assert.match(mediaPanel, /revision: service\.revision/);
  assert.match(mediaPanel, /const requestId = crypto\.randomUUID\(\)/);
  assert.match(writer, /admin_audit_log/);
  assert.match(writer, /payload_sha256/);
  assert.match(writer, /batch\(/);
  assert.match(writer, /WHERE id = \? AND revision = \?/);
  assert.match(writer, /audit_logs/);
  assert.match(revision, /SELECT id, revision/);
});
