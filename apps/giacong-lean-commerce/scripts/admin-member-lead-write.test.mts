import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";
import {
  AdminMemberWriteConflictError,
  AdminMemberWriteIdempotencyConflictError,
  AdminMemberWriteStorageError,
  createAdminMemberAtomically,
  updateAdminMemberAtomically,
} from "../src/lib/admin-member-write.ts";
import { parseAdminMemberCreateCommand, parseAdminMemberUpdateCommand } from "../src/lib/admin-member-command.ts";
import {
  AdminLeadWriteConflictError,
  AdminLeadWriteIdempotencyConflictError,
  AdminLeadWriteStorageError,
  updateAdminLeadStatusAtomically,
} from "../src/lib/admin-lead-write.ts";
import { parseAdminLeadStatusCommand } from "../src/lib/admin-lead-command.ts";

const root = new URL("../", import.meta.url);
const actor = "owner@example.com";
const memberCreateRequest = "11111111-1111-4111-8111-111111111111";
const memberUpdateRequest = "22222222-2222-4222-8222-222222222222";
const leadUpdateRequest = "33333333-3333-4333-8333-333333333333";

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, root), "utf8");
}

const memberFields = {
  accessSubject: "operator@example.com",
  displayName: "Operator",
  email: "operator@example.com",
  isActive: true,
  role: "viewer" as const,
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

type MemberState = {
  access_subject: string;
  display_name: string;
  email: string | null;
  id: string;
  is_active: number;
  revision: number;
  role: string;
  last_request_id?: string;
};

type LeadState = {
  created_at: string;
  delivery_status: "pending" | "queued" | "delivered" | "failed";
  full_name: string;
  id: string;
  revision: number;
  status: string;
  updated_at: string;
  last_request_id?: string;
};

type MutationState = {
  actor_subject: string;
  action: string;
  entity_key: string;
  entity_type: string;
  previous_revision?: number;
  previous_status?: string;
  payload_sha256: string;
  request_id: string;
  resulting_revision?: number;
  status?: string;
};

class FakeDatabase implements D1DatabaseLike {
  readonly members = new Map<string, MemberState>();
  readonly leads = new Map<string, LeadState>();
  readonly memberAudits = new Map<string, MutationState>();
  readonly leadAudits = new Map<string, MutationState>();
  readonly legacyAudits: Array<{ action: string; entityId: string }> = [];
  readonly leadEvents: string[] = [];
  batchCalls = 0;
  failAudit = false;
  failEvent = false;
  omitBatchResults = false;
  failPostcondition = false;
  simulateOwnerRace = false;

  constructor() {
    this.members.set("owner-1", {
      access_subject: actor,
      display_name: "Owner",
      email: actor,
      id: "owner-1",
      is_active: 1,
      revision: 1,
      role: "owner",
    });
    this.leads.set("11111111-1111-4111-8111-111111111111", {
      created_at: "2026-08-31T00:00:00.000Z",
      delivery_status: "pending",
      full_name: "Lead One",
      id: "11111111-1111-4111-8111-111111111111",
      revision: 1,
      status: "new",
      updated_at: "2026-08-31T00:00:00.000Z",
    });
  }

  prepare(query: string): FakeStatement {
    return new FakeStatement(this, query);
  }

  async batch(statements: FakeStatement[]): Promise<unknown[]> {
    this.batchCalls += 1;
    const snapshot = this.snapshot();
    try {
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement.run());
      return this.omitBatchResults ? [] : results;
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  first<T>(query: string, values: unknown[]): T | null {
    if (query.includes("admin-write-postcondition-read")) {
      return { complete: this.failPostcondition ? 0 : 1 } as T;
    }
    if (query.includes("sqlite_master")) {
      const table = String(values[0]);
      return (["admin_audit_log", "audit_logs", "admin_member_audit", "admin_lead_audit"].includes(table)
        ? { name: table }
        : null) as T | null;
    }
    if (query.includes("FROM admin_member_audit")) return (this.memberAudits.get(String(values[0])) ?? null) as T | null;
    if (query.includes("FROM admin_lead_audit")) return (this.leadAudits.get(String(values[0])) ?? null) as T | null;
    if (query.includes("COUNT(*)") && query.includes("admin_members")) {
      const count = [...this.members.values()].filter((member) => member.role === "owner" && member.is_active === 1).length;
      if (this.simulateOwnerRace) this.members.delete("owner-2");
      return ({ count } as T);
    }
    if (query.includes("FROM admin_members")) return (this.members.get(String(values[0])) ?? null) as T | null;
    if (query.includes("FROM leads")) return (this.leads.get(String(values[0])) ?? null) as T | null;
    throw new Error(`Unexpected first query: ${query}`);
  }

  all<T>(query: string, _values: unknown[]): T[] {
    throw new Error(`Unexpected all query: ${query}`);
  }

  execute(query: string, values: unknown[]): { meta: { changes: number }; results?: unknown[] } {
    if (query.includes("admin-write-postcondition")) {
      if (this.failPostcondition) throw new Error("admin-write-postcondition failed");
      return this.changed([{ complete: 1 }]);
    }
    if (query.includes("INSERT INTO admin_members")) {
      const [id, accessSubject, email, displayName, role, isActive, lastRequestId] = values;
      this.members.set(String(id), {
        access_subject: String(accessSubject),
        display_name: String(displayName),
        email: (email as string | null) ?? null,
        id: String(id),
        is_active: Number(isActive),
        revision: 1,
        role: String(role),
        last_request_id: lastRequestId === undefined ? undefined : String(lastRequestId),
      });
      return this.changed([{ id }]);
    }
    if (query.includes("UPDATE admin_members")) {
      const [accessSubject, email, displayName, role, isActive, requestId, id, expectedRevision] = values;
      const member = this.members.get(String(id));
      if (!member || member.revision !== Number(expectedRevision)) return this.unchanged();
      if (member.role === "owner"
        && member.is_active === 1
        && !(String(values[8]) === "owner" && Number(values[9]) === 1)
        && ![...this.members.values()].some((other) => other.id !== member.id && other.role === "owner" && other.is_active === 1)) {
        return this.unchanged();
      }
      member.access_subject = String(accessSubject);
      member.email = (email as string | null) ?? null;
      member.display_name = String(displayName);
      member.role = String(role);
      member.is_active = Number(isActive);
      member.revision += 1;
      (member as MemberState & { last_request_id?: string }).last_request_id = String(requestId);
      return this.changed([{ id }]);
    }
    if (query.includes("INSERT INTO admin_member_audit")) {
      if (this.failAudit) throw new Error("member audit failure");
      const requestId = String(values[0]);
      if (this.memberAudits.has(requestId)) throw new Error("UNIQUE constraint failed: admin_member_audit.request_id");
      if (query.includes("SELECT")) {
        const member = this.members.get(String(values[6]));
        if (!member || member.revision !== Number(values[7]) || member.last_request_id !== String(values[8])) return this.unchanged();
      }
      const entityKey = String(values[2]);
      const action = query.includes("'create'") ? "create" : "update";
      this.memberAudits.set(requestId, {
        actor_subject: String(values[1]),
        action,
        entity_key: entityKey,
        entity_type: "admin_member",
        payload_sha256: String(values[3]),
        request_id: requestId,
      });
      return this.changed([{ request_id: requestId }]);
    }
    if (query.includes("UPDATE leads")) {
      const [status, requestId, id, expectedRevision] = values;
      const lead = this.leads.get(String(id));
      if (!lead || lead.revision !== Number(expectedRevision)) return this.unchanged();
      lead.status = String(status);
      lead.revision += 1;
      lead.last_request_id = String(requestId);
      lead.updated_at = "2026-08-31T00:00:01.000Z";
      return this.changed([{ id, revision: lead.revision }]);
    }
    if (query.includes("INSERT INTO admin_lead_audit")) {
      if (this.failAudit) throw new Error("lead audit failure");
      const requestId = String(values[0]);
      if (this.leadAudits.has(requestId)) throw new Error("UNIQUE constraint failed: admin_lead_audit.request_id");
      if (query.includes("SELECT")) {
        const lead = this.leads.get(String(values[8]));
        if (!lead || lead.revision !== Number(values[9]) || lead.last_request_id !== String(values[10]) || lead.status !== String(values[11])) return this.unchanged();
      }
      const entityKey = String(values[2]);
      this.leadAudits.set(requestId, {
        actor_subject: String(values[1]),
        action: "update",
        entity_key: entityKey,
        entity_type: "lead",
        previous_revision: Number(values[6]),
        previous_status: String(values[3]),
        payload_sha256: String(values[5]),
        request_id: requestId,
        resulting_revision: Number(values[7]),
        status: String(values[4]),
      });
      return this.changed([{ request_id: requestId }]);
    }
    if (query.includes("INSERT INTO lead_events")) {
      if (this.failEvent) throw new Error("lead event failure");
      if (query.includes("SELECT")) {
        const lead = this.leads.get(String(values[4]));
        if (!lead || lead.revision !== Number(values[5]) || lead.last_request_id !== String(values[6]) || lead.status !== String(values[7])) return this.unchanged();
      }
      this.leadEvents.push(String(values[1]));
      return this.changed([{ id: values[0] }]);
    }
    if (query.includes("INSERT INTO audit_logs")) {
      if (query.includes("FROM admin_members")) {
        const member = this.members.get(String(values[4]));
        if (!member || member.revision !== Number(values[5]) || member.last_request_id !== String(values[6])) return this.unchanged();
      }
      if (query.includes("FROM leads")) {
        const lead = this.leads.get(String(values[4]));
        if (!lead || lead.revision !== Number(values[5]) || lead.last_request_id !== String(values[6]) || lead.status !== String(values[7])) return this.unchanged();
      }
      this.legacyAudits.push({ action: query.includes("member") ? "member" : "lead", entityId: String(values.at(-2) ?? values[2]) });
      return this.changed([{ id: values[0] }]);
    }
    throw new Error(`Unhandled fake statement: ${query}`);
  }

  private changed(results: unknown[]): { meta: { changes: number }; results: unknown[] } {
    return { meta: { changes: 1 }, results };
  }

  private unchanged(): { meta: { changes: number }; results: unknown[] } {
    return { meta: { changes: 0 }, results: [] };
  }

  private snapshot() {
    return {
      leads: new Map([...this.leads].map(([key, value]) => [key, { ...value }])),
      leadAudits: new Map([...this.leadAudits].map(([key, value]) => [key, { ...value }])),
      leadEvents: [...this.leadEvents],
      legacyAudits: [...this.legacyAudits],
      members: new Map([...this.members].map(([key, value]) => [key, { ...value }])),
      memberAudits: new Map([...this.memberAudits].map(([key, value]) => [key, { ...value }])),
    };
  }

  private restore(snapshot: ReturnType<FakeDatabase["snapshot"]>): void {
    this.members.clear();
    for (const [key, value] of snapshot.members) this.members.set(key, value);
    this.memberAudits.clear();
    for (const [key, value] of snapshot.memberAudits) this.memberAudits.set(key, value);
    this.leads.clear();
    for (const [key, value] of snapshot.leads) this.leads.set(key, value);
    this.leadAudits.clear();
    for (const [key, value] of snapshot.leadAudits) this.leadAudits.set(key, value);
    this.leadEvents.splice(0, this.leadEvents.length, ...snapshot.leadEvents);
    this.legacyAudits.splice(0, this.legacyAudits.length, ...snapshot.legacyAudits);
  }
}

test("member and lead commands require exact keys, UUID request IDs and numeric revisions", () => {
  const create = parseAdminMemberCreateCommand({ requestId: memberCreateRequest, ...memberFields });
  assert.equal(create.command?.requestId, memberCreateRequest);
  assert.equal(parseAdminMemberCreateCommand({ requestId: memberCreateRequest, ...memberFields, extra: true }).command, null);
  assert.equal(parseAdminMemberCreateCommand({ requestId: "bad", ...memberFields }).command, null);

  const update = parseAdminMemberUpdateCommand({ requestId: memberUpdateRequest, expectedRevision: 1, ...memberFields });
  assert.equal(update.command?.expectedRevision, 1);
  assert.equal(parseAdminMemberUpdateCommand({ requestId: memberUpdateRequest, expectedRevision: "1", ...memberFields }).command, null);

  const lead = parseAdminLeadStatusCommand({ requestId: leadUpdateRequest, revision: 1, status: "qualified" });
  assert.equal(lead.command?.status, "qualified");
  assert.equal(parseAdminLeadStatusCommand({ requestId: leadUpdateRequest, revision: 1, status: "invalid" }).command, null);
  assert.equal(parseAdminLeadStatusCommand({ requestId: leadUpdateRequest, revision: 1, status: "new", extra: true }).command, null);
});

test("member create/update are atomic, revision-aware and idempotent", async () => {
  const database = new FakeDatabase();
  const created = await createAdminMemberAtomically(database, memberFields, actor, memberCreateRequest);
  assert.equal(created.revision, 1);
  assert.equal(database.batchCalls, 1);
  assert.equal(database.memberAudits.size, 1);

  const replay = await createAdminMemberAtomically(database, memberFields, actor, memberCreateRequest);
  assert.equal(replay.id, created.id);
  assert.equal(database.batchCalls, 1);
  await assert.rejects(
    () => createAdminMemberAtomically(database, { ...memberFields, displayName: "Khác" }, actor, memberCreateRequest),
    AdminMemberWriteIdempotencyConflictError,
  );

  const updated = await updateAdminMemberAtomically(database, created.id, { ...memberFields, displayName: "Operator mới" }, 1, actor, "owner-1", memberUpdateRequest);
  assert.equal(updated.displayName, "Operator mới");
  assert.equal(updated.revision, 2);
  await assert.rejects(
    () => updateAdminMemberAtomically(database, created.id, { ...memberFields, displayName: "Stale" }, 1, actor, "owner-1", "44444444-4444-4444-8444-444444444444"),
    AdminMemberWriteConflictError,
  );
  assert.equal(database.members.get(created.id)?.display_name, "Operator mới");
});

test("member audit failure rolls back the member row and specialized audit", async () => {
  const database = new FakeDatabase();
  database.failAudit = true;
  await assert.rejects(
    () => createAdminMemberAtomically(database, memberFields, actor, memberCreateRequest),
    /member audit failure/,
  );
  assert.equal(database.members.size, 1);
  assert.equal(database.memberAudits.size, 0);
  assert.equal(database.legacyAudits.length, 0);
});

test("member writer protects the last active owner and the current actor", async () => {
  const database = new FakeDatabase();
  await assert.rejects(
    () => updateAdminMemberAtomically(database, "owner-1", { ...memberFields, role: "viewer" }, 1, actor, "owner-1", memberUpdateRequest),
    /không thể tự hạ quyền|đổi accessSubject|Phải giữ lại/i,
  );
  await assert.rejects(
    () => updateAdminMemberAtomically(database, "owner-1", { ...memberFields, accessSubject: "other@example.com", role: "owner" }, 1, actor, "owner-1", "55555555-5555-4555-8555-555555555555"),
    /accessSubject|tài khoản đang sử dụng/i,
  );
});

test("member owner guard remains atomic when the last-owner count races", async () => {
  const database = new FakeDatabase();
  database.members.set("owner-2", {
    access_subject: "second-owner@example.com",
    display_name: "Second owner",
    email: "second-owner@example.com",
    id: "owner-2",
    is_active: 1,
    revision: 1,
    role: "owner",
  });
  database.simulateOwnerRace = true;
  await assert.rejects(
    () => updateAdminMemberAtomically(
      database,
      "owner-1",
      { ...memberFields, accessSubject: actor, role: "viewer" },
      1,
      "second-owner@example.com",
      "owner-2",
      "66666666-6666-4666-8666-666666666666",
    ),
    AdminMemberWriteConflictError,
  );
  assert.equal(database.members.get("owner-1")?.role, "owner");
  assert.equal(database.members.get("owner-1")?.is_active, 1);
});

test("lead status mutation couples row, event and audit with replay and stale protection", async () => {
  const database = new FakeDatabase();
  const leadId = "11111111-1111-4111-8111-111111111111";
  const changed = await updateAdminLeadStatusAtomically(database, leadId, "qualified", 1, actor, leadUpdateRequest);
  assert.equal(changed, leadId);
  assert.equal(database.leads.get(leadId)?.revision, 2);
  assert.equal(database.leads.get(leadId)?.status, "qualified");
  assert.equal(database.leadEvents.length, 1);
  assert.equal(database.leadAudits.size, 1);
  assert.equal(database.batchCalls, 1);

  assert.equal(await updateAdminLeadStatusAtomically(database, leadId, "qualified", 1, actor, leadUpdateRequest), leadId);
  assert.equal(database.batchCalls, 1);
  await assert.rejects(
    () => updateAdminLeadStatusAtomically(database, leadId, "won", 1, actor, leadUpdateRequest),
    AdminLeadWriteIdempotencyConflictError,
  );
  await assert.rejects(
    () => updateAdminLeadStatusAtomically(database, leadId, "won", 1, actor, "66666666-6666-4666-8666-666666666666"),
    AdminLeadWriteConflictError,
  );
  assert.equal(database.leads.get(leadId)?.status, "qualified");
});

test("lead event failure rolls back the status, revision and audit", async () => {
  const database = new FakeDatabase();
  database.failEvent = true;
  await assert.rejects(
    () => updateAdminLeadStatusAtomically(database, "11111111-1111-4111-8111-111111111111", "contacted", 1, actor, leadUpdateRequest),
    /lead event failure/,
  );
  assert.equal(database.leads.get("11111111-1111-4111-8111-111111111111")?.status, "new");
  assert.equal(database.leads.get("11111111-1111-4111-8111-111111111111")?.revision, 1);
  assert.equal(database.leadAudits.size, 0);
  assert.equal(database.leadEvents.length, 0);
});

test("member and lead writes succeed when D1 omits batch result rows", async () => {
  const database = new FakeDatabase();
  database.omitBatchResults = true;

  const member = await createAdminMemberAtomically(database, memberFields, actor, memberCreateRequest);
  const updatedMember = await updateAdminMemberAtomically(
    database,
    member.id,
    { ...memberFields, displayName: "Operator mới" },
    1,
    actor,
    "owner-1",
    memberUpdateRequest,
  );
  const leadId = await updateAdminLeadStatusAtomically(
    database,
    "11111111-1111-4111-8111-111111111111",
    "qualified",
    1,
    actor,
    leadUpdateRequest,
  );

  assert.equal(updatedMember.revision, 2);
  assert.equal(leadId, "11111111-1111-4111-8111-111111111111");
  assert.equal(database.memberAudits.size, 2);
  assert.equal(database.leadAudits.size, 1);
});

test("member and lead writes roll back when their postcondition is missing", async () => {
  const database = new FakeDatabase();
  database.failPostcondition = true;

  await assert.rejects(
    () => createAdminMemberAtomically(database, memberFields, actor, memberCreateRequest),
    AdminMemberWriteStorageError,
  );
  await assert.rejects(
    () => updateAdminLeadStatusAtomically(
      database,
      "11111111-1111-4111-8111-111111111111",
      "qualified",
      1,
      actor,
      leadUpdateRequest,
    ),
    AdminLeadWriteStorageError,
  );

  assert.equal(database.members.size, 1);
  assert.equal(database.memberAudits.size, 0);
  assert.equal(database.leads.get("11111111-1111-4111-8111-111111111111")?.revision, 1);
  assert.equal(database.leadAudits.size, 0);
  assert.equal(database.leadEvents.length, 0);
});

test("member and lead routes plus migrations expose the bounded write contract", async () => {
  const [members, memberDetail, leads, memberMigration, leadMigration, leadMarkerMigration, memberManager, leadPage, adminClient] = await Promise.all([
    read("src/app/api/admin/members/route.ts"),
    read("src/app/api/admin/members/[id]/route.ts"),
    read("src/app/api/admin/leads/[id]/route.ts"),
    read("migrations/0013_admin_member_write_contract.sql"),
    read("migrations/0014_admin_lead_write_contract.sql"),
    read("migrations/0016_admin_lead_request_marker.sql"),
    read("src/components/admin/AdminMembersManager.tsx"),
    read("src/app/admin/yeu-cau/page.tsx"),
    read("src/lib/admin-client.ts"),
  ]);
  assert.match(members, /createAdminMemberAtomically/);
  assert.match(members, /readBoundedAdminJson/);
  assert.match(memberDetail, /updateAdminMemberAtomically/);
  assert.match(memberDetail, /expectedRevision/);
  assert.match(leads, /updateAdminLeadStatusAtomically/);
  assert.match(leads, /revision/);
  assert.match(memberMigration, /CREATE TABLE IF NOT EXISTS admin_member_audit/);
  assert.match(memberMigration, /last_request_id/);
  assert.match(leadMigration, /ALTER TABLE leads/);
  assert.match(leadMigration, /CREATE TABLE IF NOT EXISTS admin_lead_audit/);
  assert.match(leadMarkerMigration, /last_request_id/);
  assert.match(memberManager, /requestId: crypto\.randomUUID\(\)/);
  assert.match(leadPage, /requestId: crypto\.randomUUID\(\)/);
  assert.match(adminClient, /revision: number/);
});
