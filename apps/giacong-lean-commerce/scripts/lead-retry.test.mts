import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { retryFailedLead } from "../src/lib/lead-retry.ts";

test("retry keeps the stored request key and only one caller can enqueue a failed lead", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE leads (id TEXT PRIMARY KEY, request_id TEXT, payload_json TEXT, delivery_status TEXT, delivery_error TEXT, updated_at TEXT)");
  sqlite.exec("CREATE TABLE lead_events (id TEXT PRIMARY KEY, lead_id TEXT, actor_subject TEXT, event_type TEXT, message TEXT)");
  const payload = { name: "QA", phone: "0868408115", request_id: "same-request" };
  sqlite.prepare("INSERT INTO leads VALUES (?, ?, ?, 'failed', 'timeout', '')").run("lead", "same-request", JSON.stringify(payload));
  const db = { prepare(sql: string) { let params: unknown[] = []; return {
    bind(...values: unknown[]) { params = values; return this; },
    async first() { return sqlite.prepare(sql).get(...params as never[]) ?? null; },
    async run() { return sqlite.prepare(sql).run(...params as never[]); },
  }; } };
  const sent: unknown[] = [];
  const queue = { async send(message: unknown) { sent.push(message); } };
  assert.equal(await retryFailedLead(db as never, queue, "lead", "owner", "attempt1"), "queued");
  assert.equal(await retryFailedLead(db as never, queue, "lead", "owner", "attempt2"), "busy");
  assert.deepEqual(sent, [{ leadId: "lead", payload }]);
  sqlite.prepare("UPDATE leads SET delivery_status='delivered'").run();
  assert.equal(await retryFailedLead(db as never, queue, "lead", "owner", "attempt3"), "delivered");
  assert.equal(sent.length, 1);
  sqlite.prepare("UPDATE leads SET delivery_status='failed'").run();
  await assert.rejects(retryFailedLead(db as never, { async send() { throw new Error("offline"); } }, "lead", "owner", "attempt4"));
  assert.equal(sqlite.prepare("SELECT delivery_status FROM leads").get()?.delivery_status, "failed");
  sqlite.prepare("UPDATE leads SET delivery_status='queued', updated_at=datetime('now', '-11 minutes')").run();
  assert.equal(await retryFailedLead(db as never, queue, "lead", "owner", "attempt5"), "queued");
  assert.equal(sent.length, 2);
  assert.equal(sqlite.prepare("SELECT actor_subject FROM lead_events WHERE id='attempt5'").get()?.actor_subject, "owner");
  sqlite.prepare("UPDATE leads SET payload_json='{}', delivery_status='failed'").run();
  await assert.rejects(retryFailedLead(db as never, queue, "lead", "owner", "attempt6"), /payload/);
  assert.equal(sent.length, 2);
  sqlite.close();
});
