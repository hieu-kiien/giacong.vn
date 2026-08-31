import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AdminServiceWriteConflictError,
  AdminServiceWriteIdempotencyConflictError,
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
  readonly meta = new Set<number>();
  readonly batches: FakeServiceWriteStatement[][] = [];
  failLegacyAudit = false;
  raceBeforeBatch = false;
  private nextId = 8;
  private lastChanges = 0;

  prepare(query: string): FakeServiceWriteStatement {
    return new FakeServiceWriteStatement(this, query);
  }

  async first<T>(query: string, values: unknown[]): Promise<T | null> {
    if (query.includes("sqlite_master")) {
      const table = String(values[0]);
      return (["admin_audit_log", "audit_logs", "service_admin_meta"].includes(table) ? { name: table } : null) as T | null;
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
      meta: [...this.meta],
      mutations: [...this.mutations.entries()],
      nextId: this.nextId,
      service: this.service,
    });
    try {
      return statements.map((statement) => this.execute(statement.query, statement.values));
    } catch (error) {
      this.legacyAudits.clear();
      snapshot.legacyAudits.forEach((id) => this.legacyAudits.add(id));
      this.meta.clear();
      snapshot.meta.forEach((id) => this.meta.add(id));
      this.mutations.clear();
      snapshot.mutations.forEach(([id, mutation]) => this.mutations.set(id, mutation));
      this.nextId = snapshot.nextId;
      this.service = snapshot.service;
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
      return { meta: { changes: 1 }, results: [{ id: this.service.id, revision: 1 }] };
    }
    if (query.includes("UPDATE services")) return this.executeServiceUpdate(query, values);
    if (query.includes("INSERT INTO admin_audit_log")) return this.executeMutation(query, values);
    if (query.includes("INSERT INTO audit_logs")) {
      if (this.failLegacyAudit) throw new Error("legacy audit failed");
      if (this.lastChanges !== 1) return { meta: { changes: 0 }, results: [] };
      const id = String(values[0]);
      this.legacyAudits.add(id);
      this.lastChanges = 1;
      return { meta: { changes: 1 }, results: [{ id }] };
    }
    if (query.includes("INSERT INTO service_admin_meta")) {
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
    this.lastChanges = 1;
    return { meta: { changes: 1 }, results: [{ id, revision: this.service.revision }] };
  }

  private executeMutation(query: string, values: unknown[]): { meta: { changes: number }; results?: unknown[] } {
    if (this.lastChanges !== 1) return { meta: { changes: 0 }, results: [] };
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
    return { meta: { changes: 1 }, results: [{ request_id: requestId }] };
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

async function read(path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

test("service create couples row, idempotency audit, legacy audit and meta in one batch", async () => {
  const database = new FakeServiceWriteDatabase();

  const id = await createAdminServiceAtomically(database, input, actor, createRequestId);

  assert.equal(id, 8);
  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0]?.length, 4);
  assert.equal(database.service.revision, 1);
  assert.equal(database.mutations.size, 1);
  assert.equal(database.legacyAudits.size, 1);
  assert.deepEqual([...database.meta], [8]);
  assert.equal(database.meta.has(8), true);
  assert.match(database.batches[0]?.[0]?.query ?? "", /INSERT INTO services/);
  assert.match(database.batches[0]?.[1]?.query ?? "", /INSERT INTO admin_audit_log/);
  assert.match(database.batches[0]?.[2]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(database.batches[0]?.[3]?.query ?? "", /INSERT INTO service_admin_meta/);
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
