import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { deliverCustomerContact, type CustomerContactDeliveryDatabase } from "../src/lib/customer-contact-delivery.ts";

async function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec('CREATE TABLE "user" (id TEXT PRIMARY KEY, email TEXT NOT NULL, "emailVerified" INTEGER NOT NULL DEFAULT 1); INSERT INTO "user" (id,email) VALUES (\'customer-1\',\'customer@example.com\');');
  for (const file of ["0036_customer_contact_profiles.sql", "0037_customer_contact_delivery.sql"]) db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const database: CustomerContactDeliveryDatabase = { prepare(sql) { const statement = db.prepare(sql); let values: Array<string | number | null> = []; return { bind(...args) { values = args as typeof values; return this; }, async first<T>() { return (statement.get(...values) ?? null) as T | null; }, async run() { return statement.run(...values); } }; } };
  db.exec("INSERT INTO customer_contact_profiles VALUES ('customer-1','Khách A','0912345678','','2026-10-05T00:00:00Z','2026-10-05T00:00:00Z')");
  return { db, database };
}
const environment = { GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/test/exec", GOOGLE_SHEETS_WEBHOOK_SECRET: "secret", CUSTOMER_NOTIFICATION_FROM: "Brand <notice@example.com>", CUSTOMER_NOTIFICATION_TO: "owner@example.com", RESEND_API_KEY: "test" };

test("unverified registration retains the phone but cannot send either notification channel", async () => {
  const { db, database } = await fixture();
  db.exec('UPDATE "user" SET "emailVerified" = 0');
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({ id: "unexpected" }); };
  await deliverCustomerContact("customer-1", environment, database, fetcher);
  assert.equal(calls, 0);
  assert.equal(db.prepare("SELECT phone FROM customer_contact_profiles").get()?.phone, "0912345678");
  assert.equal(db.prepare("SELECT email_status FROM customer_contact_delivery").get()?.email_status, "pending");
  db.close();
});

test("profile and outbox are atomic; unchanged saves do not create revisions or repeat new-customer email", async () => {
  const { db } = await fixture();
  assert.equal(db.prepare("SELECT revision FROM customer_contact_delivery").get()?.revision, 1);
  db.exec("UPDATE customer_contact_profiles SET updated_at = 'later'");
  assert.equal(db.prepare("SELECT revision FROM customer_contact_delivery").get()?.revision, 1);
  db.exec("UPDATE customer_contact_profiles SET full_name = 'Khách B'");
  const row = db.prepare("SELECT revision,email_payload_json FROM customer_contact_delivery").get();
  assert.equal(row?.revision, 2);
  assert.equal(JSON.parse(String(row?.email_payload_json)).name, "Khách B");
  db.close();
});
test("both channels acknowledge delivery; replay skips delivery and updates only sync the Sheet", async () => {
  const { db, database } = await fixture(); const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => { const url = String(input); calls.push(url); const body = JSON.parse(String(init?.body)); return Response.json(url.includes("resend") ? { id: "email-1" } : { ok: true, customer_id: body.customer_id, revision: body.revision }); };
  await deliverCustomerContact("customer-1", environment, database, fetcher);
  await deliverCustomerContact("customer-1", environment, database, fetcher);
  assert.equal(calls.length, 2);
  db.exec("UPDATE customer_contact_profiles SET phone = '0987654321'");
  await deliverCustomerContact("customer-1", environment, database, fetcher);
  assert.equal(calls.length, 3); assert.ok(calls[2].includes("script.google.com")); db.close();
});
test("one channel failure keeps its status retryable without repeating the successful channel", async () => {
  const { db, database } = await fixture(); let failEmail = true; let sheetCalls = 0;
  const fetcher: typeof fetch = async (input, init) => { const body = JSON.parse(String(init?.body)); if (String(input).includes("resend")) return failEmail ? new Response("error", { status: 503 }) : Response.json({ id: "email-1" }); sheetCalls++; return Response.json({ ok: true, customer_id: body.customer_id, revision: body.revision }); };
  await assert.rejects(deliverCustomerContact("customer-1", environment, database, fetcher));
  assert.equal(db.prepare("SELECT sheet_revision FROM customer_contact_delivery").get()?.sheet_revision, 1);
  failEmail = false; await deliverCustomerContact("customer-1", environment, database, fetcher); assert.equal(sheetCalls, 1); db.close();
});
test("wrong webhook acknowledgement is rejected; redirects never expose secrets to another host", async () => {
  const { db, database } = await fixture(); const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => { urls.push(String(input)); return new Response(null, { status: 302, headers: { Location: "https://attacker.example/steal" } }); };
  await assert.rejects(deliverCustomerContact("customer-1", {}, database, fetcher));
  assert.equal(urls.length, 0);
  await assert.rejects(deliverCustomerContact("customer-1", { GOOGLE_SHEETS_WEBHOOK_URL: environment.GOOGLE_SHEETS_WEBHOOK_URL, GOOGLE_SHEETS_WEBHOOK_SECRET: "secret" }, database, fetcher));
  assert.ok(urls.every(url => url.startsWith("https://script.google.com/"))); db.close();
});

test("email uses corrections before first attempt and retains the same body on retry", async () => {
  const { db, database } = await fixture(); const bodies: string[] = [];
  db.exec("UPDATE customer_contact_profiles SET phone = '0987654321'");
  const fetcher: typeof fetch = async (input,init) => { const body = JSON.parse(String(init?.body)); if (String(input).includes("resend")) { bodies.push(String(init?.body)); return new Response("unavailable",{ status: 503 }); } return Response.json({ ok: true,customer_id: body.customer_id,revision: body.revision }); };
  await assert.rejects(deliverCustomerContact("customer-1",environment,database,fetcher));
  assert.ok(bodies[0].includes("0987654321"));
  db.exec("UPDATE customer_contact_profiles SET phone = '0911111111'");
  await assert.rejects(deliverCustomerContact("customer-1",environment,database,fetcher));
  assert.equal(bodies[0],bodies[1]);
  db.exec(`UPDATE customer_contact_delivery SET email_started_at = ${Date.now() - 24 * 3600000}`);
  await assert.rejects(deliverCustomerContact("customer-1",environment,database,fetcher));
  assert.equal(bodies.length,2);
  assert.ok(String(db.prepare("SELECT last_error FROM customer_contact_delivery").get()?.last_error).includes("requires_delivery_review")); db.close();
});
test("bad acknowledgement remains pending and a held lease prevents parallel sends", async () => {
  const { db,database } = await fixture(); let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({ ok: true,customer_id: "another",revision: 1 }); };
  await assert.rejects(deliverCustomerContact("customer-1",{ GOOGLE_SHEETS_WEBHOOK_URL: environment.GOOGLE_SHEETS_WEBHOOK_URL, GOOGLE_SHEETS_WEBHOOK_SECRET: "secret" },database,fetcher));
  assert.equal(db.prepare("SELECT sheet_revision FROM customer_contact_delivery").get()?.sheet_revision,0);
  db.exec(`UPDATE customer_contact_delivery SET lease_until = ${Date.now() + 60000}`);
  await assert.rejects(deliverCustomerContact("customer-1",environment,database,fetcher));
  assert.equal(calls,1); db.close();
});
