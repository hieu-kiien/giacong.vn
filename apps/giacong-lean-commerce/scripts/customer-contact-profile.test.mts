import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { parseCustomerContact, customerContactDestination, mergeCustomerContact } from "../src/lib/customer-contact-input.ts";
import { getCustomerContact, saveCustomerContact } from "../src/lib/customer-contact-data.ts";
import { listAdminCustomers, getAdminCustomerDetail } from "../src/lib/admin-customers.ts";
import { buildCustomerExportXlsx } from "../src/lib/admin-customer-xlsx.ts";
import { parseCustomerConfirmation, serializeCustomerConfirmation } from "../src/lib/customer-request-confirmation.ts";

test("contact requires a name, valid phone and explicit contact consent", () => {
  assert.equal(parseCustomerContact({ name: "Lan", phone: "abc", consent: true }).ok, false);
  assert.equal(parseCustomerContact({ name: "Lan", phone: "0912345678", consent: false }).ok, false);
  assert.equal(parseCustomerContact({ name: "", phone: "0912345678", consent: true }).ok, false);
  const parsed = parseCustomerContact({ name: " Lan ", phone: "+84 912 345 678", companyName: " A ", consent: true, customerId: "other" });
  assert.deepEqual(parsed, { ok: true, value: { name: "Lan", phone: "+84912345678", companyName: "A" } });
});

test("completion preserves a safe return destination", () => {
  assert.equal(customerContactDestination("/gui-yeu-cau/"), "/tai-khoan/?next=%2Fgui-yeu-cau%2F");
  assert.equal(customerContactDestination("//evil.test"), "/tai-khoan/");
});

test("saved contact details stay visible without a disclosure click", () => {
  const ui = readFileSync(new URL("../src/app/(storefront)/tai-khoan/CustomerContactProfile.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /<details|<summary/);
  assert.match(ui, /Thông tin liên hệ/);
});

test("prefill preserves edits and cannot leak one account's profile to another", () => {
  const initial = { name: "", phone: "", email: "", companyName: "", message: "My request" };
  assert.deepEqual(mergeCustomerContact(initial, { name: "Lan", phone: "0912345678", email: "lan@example.test", companyName: "A" }), { ...initial, name: "Lan", phone: "0912345678", email: "lan@example.test", companyName: "A" });
  assert.equal(mergeCustomerContact({ ...initial, phone: "0987654321" }, { name: "Lan", phone: "0912345678", email: "lan@example.test", companyName: "" }).phone, "0987654321");
});

test("D1 contact profile is account-bound, retry-safe and visible before any inquiry", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec('CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT, email TEXT, username TEXT, "createdAt" TEXT); INSERT INTO "user" VALUES (\'u1\', \'Google Name\', \'qa@example.test\', NULL, \'2026-10-05\'), (\'u2\', \'Other\', \'other@example.test\', NULL, \'2026-10-05\');');
  sqlite.exec(readFileSync(new URL("../migrations/0036_customer_contact_profiles.sql", import.meta.url), "utf8"));
  const db = { prepare(sql: string) { let params: unknown[] = []; return {
    bind(...values: unknown[]) { params = values; return this; },
    async first() { return sqlite.prepare(sql).get(...params as never[]) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...params as never[]) }; },
    async run() { return sqlite.prepare(sql).run(...params as never[]); },
  }; } };
  const value = { name: "Lan", phone: "0912345678", companyName: "A" };
  await saveCustomerContact(db as never, "u1", value);
  await saveCustomerContact(db as never, "u1", { ...value, phone: "0987654321" });
  assert.equal((await getCustomerContact(db as never, "u1"))?.phone, "0987654321");
  assert.equal(await getCustomerContact(db as never, "u2"), null);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM customer_contact_profiles").get()?.n, 1);
  const customers = await listAdminCustomers(db as never, { page: 1, pageSize: 20, query: "0987654321" });
  assert.equal(customers.total, 1);
  assert.equal(customers.customers[0]?.name, "Lan");
  assert.equal(customers.customers[0]?.phone, "0987654321");
  const detail = await getAdminCustomerDetail(db as never, "u1");
  assert.equal(detail?.phone, "0987654321");
  assert.ok(buildCustomerExportXlsx(customers.customers, []).byteLength > 500);
  sqlite.close();
});

test("profile API uses verified session identity, no-store and same-origin writes", () => {
  const source = readFileSync(new URL("../src/app/api/customer/contact/route.ts", import.meta.url), "utf8");
  assert.match(source, /session\?\.user.emailVerified/);
  assert.match(source, /saveCustomerContact\(getAdminDatabase\(\), user.id, parsed.value\)/);
  assert.match(source, /origin !== url.origin/);
  assert.match(source, /private, no-store/);
  assert.doesNotMatch(source, /raw\.customerId|raw\.email|body\.customerId/);
});

test("saved request confirmation belongs only to the same logged-in customer", () => {
  const snapshot = { cart: { currency: "VND" as const, hasPriceOnRequest: false, isSubmittable: true, lineCount: 1,
    lines: [{ adjustments: [], contactFromQuantity: null, imageUrl: null, isAvailable: true, isSubmittable: true, lineTotal: 100, minimumOrderQuantity: 1, parentSlug: "test", priceOnRequest: false, productName: "Test", quantity: 1, quantityStep: 1, unit: "gói", unitPrice: 100, variantLabel: "Test", variantSku: "TEST" }],
    pricedSubtotal: 100, requestType: "Đặt sản phẩm" as const, snapshotToken: "a".repeat(64), totalQuantity: 1, uniformUnit: "gói" }, contact: null, receivedAt: "2026-10-05T00:00:00Z", reference: "QA-REQUEST" };
  const stored = serializeCustomerConfirmation(snapshot, "u1");
  assert.equal(parseCustomerConfirmation(stored, "u2"), null);
  assert.equal(parseCustomerConfirmation(stored, null), null);
  assert.equal(parseCustomerConfirmation(stored, "u1")?.reference, "QA-REQUEST");
  assert.equal(parseCustomerConfirmation(JSON.stringify(snapshot), "u1"), null);
});
