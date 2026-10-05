// Compare remote D1 metadata with the exact reviewed SQLite migration. No remote writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const remote = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.ok(Array.isArray(remote) && remote.length === 3);
const db = new DatabaseSync(":memory:");
db.exec('CREATE TABLE "user" (id TEXT PRIMARY KEY)');
db.exec(readFileSync(new URL("../migrations/0036_customer_contact_profiles.sql", import.meta.url), "utf8"));
const plain = (rows) => JSON.parse(JSON.stringify(rows));
assert.deepEqual(remote[0].results, plain(db.prepare("PRAGMA table_info(customer_contact_profiles)").all()), "Contact column contract differs");
assert.deepEqual(remote[1].results, plain(db.prepare("PRAGMA foreign_key_list(customer_contact_profiles)").all()), "Contact foreign key differs");
const expected = db.prepare("SELECT sql FROM sqlite_master WHERE name='customer_contact_profiles'").get().sql;
const normalized = (sql) => sql.replace(/\s+/g, " ").trim().toLowerCase();
assert.equal(normalized(remote[2].results[0]?.sql ?? ""), normalized(expected), "Contact table constraints differ");
db.close();
console.log("Contact schema matches columns, primary key, foreign key and constraints.");
