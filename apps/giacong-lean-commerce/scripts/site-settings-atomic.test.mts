import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { SiteSettingConflictError, SiteSettingValidationError } from "../src/lib/site-settings.ts";
import {
  publishAdminSiteSettingAtomic,
  publishAllAdminSiteSettingsAtomic,
  updateAdminSiteSettingAtomic,
} from "../src/lib/site-settings-write.ts";

type Row = {
  setting_key: "brand_name" | "contact_zalo_url" | "primary_color";
  group_name: "brand" | "contact";
  label: string;
  description: string;
  value_type: "text" | "url" | "color";
  draft_value: string;
  published_value: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
};

class FakeStatement {
  readonly query: string;
  values: unknown[] = [];
  runCalls = 0;

  constructor(readonly database: FakeSiteDatabase, query: string) {
    this.query = query.replace(/\s+/g, " ").trim();
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    const rows = this.query.includes("draft_value <> published_value")
      ? [...this.database.rows.values()].filter((row) => row.draft_value !== row.published_value)
      : [...this.database.rows.values()];
    return { results: rows as unknown as T[] };
  }

  async first<T>() {
    const key = String(this.values[0]);
    return (this.database.rows.get(key) ?? null) as unknown as T | null;
  }

  async run() {
    this.runCalls += 1;
    throw new Error("atomic site setting writer must not call statement.run()");
  }
}

class FakeSiteDatabase {
  readonly rows = new Map<string, Row>();
  readonly prepared: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];
  markerPlan: boolean[] = [];

  constructor() {
    this.rows.set("brand_name", this.row("brand_name", "brand", "text", "Draft brand", "Published brand"));
    this.rows.set("contact_zalo_url", this.row("contact_zalo_url", "contact", "url", "https://zalo.me/new", "https://zalo.me/old"));
    this.rows.set("primary_color", this.row("primary_color", "brand", "color", "#6cbe45", "#6cbe45"));
  }

  prepare(query: string) {
    const statement = new FakeStatement(this, query);
    this.prepared.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    const createdMarkers = new Set<string>();
    const results: Array<{ results: unknown[] }> = [];

    for (const statement of statements) {
      if (statement.query.includes("INSERT INTO audit_logs")) {
        const auditId = String(statement.values[0]);
        const key = String(statement.values[5]);
        const expectedVersion = Number(statement.values[6]);
        const row = this.rows.get(key);
        const planned = this.markerPlan.length ? Boolean(this.markerPlan.shift()) : true;
        const dirtyAllowed = !statement.query.includes("draft_value <> published_value")
          || (row !== undefined && row.draft_value !== row.published_value);
        const created = planned && row?.version === expectedVersion && dirtyAllowed;
        if (created) createdMarkers.add(auditId);
        results.push({ results: created ? [{ id: auditId }] : [] });
        continue;
      }

      if (statement.query.includes("UPDATE site_settings")) {
        const key = String(statement.values[2]);
        const expectedVersion = Number(statement.values[3]);
        const auditId = String(statement.values[4]);
        const row = this.rows.get(key);
        if (row && row.version === expectedVersion && createdMarkers.has(auditId)) {
          if (statement.query.includes("published_value = draft_value")) {
            row.published_value = row.draft_value;
            row.published_by = String(statement.values[0]);
            row.published_at = "2026-08-18T00:00:00Z";
            row.updated_by = String(statement.values[1]);
          } else {
            row.draft_value = String(statement.values[0]);
            row.updated_by = String(statement.values[1]);
          }
          row.version += 1;
          row.updated_at = "2026-08-18T00:00:00Z";
        }
        results.push({ results: [] });
        continue;
      }

      results.push({ results: [] });
    }

    return results;
  }

  private row(
    key: Row["setting_key"],
    group: Row["group_name"],
    type: Row["value_type"],
    draft: string,
    published: string,
  ): Row {
    return {
      description: "",
      draft_value: draft,
      group_name: group,
      label: key,
      published_at: null,
      published_by: null,
      published_value: published,
      setting_key: key,
      updated_at: "2026-08-17T00:00:00Z",
      updated_by: null,
      value_type: type,
      version: 1,
    };
  }
}

const repoRoot = path.join(import.meta.dirname, "..");

function assertNoIndividualWrites(database: FakeSiteDatabase) {
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
}

test("draft update and audit marker commit in one exact-version D1 batch", async () => {
  const database = new FakeSiteDatabase();
  const updated = await updateAdminSiteSettingAtomic(database, {
    actorSubject: "owner",
    expectedVersion: 1,
    key: "brand_name",
    value: "New draft",
  });

  assert.equal(updated.draftValue, "New draft");
  assert.equal(updated.publishedValue, "Published brand");
  assert.equal(updated.version, 2);
  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 2);
  assert.match(batch[0]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(batch[0]?.query ?? "", /version = \?/);
  assert.match(batch[0]?.query ?? "", /RETURNING id/);
  assert.match(batch[1]?.query ?? "", /UPDATE site_settings/);
  assert.match(batch[1]?.query ?? "", /version = version \+ 1/);
  assert.match(batch[1]?.query ?? "", /EXISTS \(SELECT 1 FROM audit_logs WHERE id = \?\)/);
  assert.equal(batch[1]?.values.at(-1), batch[0]?.values[0]);
  assertNoIndividualWrites(database);
});

test("single publish and audit marker commit in one exact-version D1 batch", async () => {
  const database = new FakeSiteDatabase();
  const published = await publishAdminSiteSettingAtomic(database, {
    actorSubject: "owner",
    expectedVersion: 1,
    key: "brand_name",
  });

  assert.equal(published.publishedValue, "Draft brand");
  assert.equal(published.dirty, false);
  assert.equal(published.version, 2);
  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 2);
  assert.match(batch[1]?.query ?? "", /published_value = draft_value/);
  assertNoIndividualWrites(database);
});

test("a concurrent site-setting revision change becomes a guarded no-op and conflict", async () => {
  const database = new FakeSiteDatabase();
  database.markerPlan = [false];

  await assert.rejects(
    updateAdminSiteSettingAtomic(database, {
      actorSubject: "owner",
      expectedVersion: 1,
      key: "brand_name",
      value: "Stale draft",
    }),
    SiteSettingConflictError,
  );
  assert.equal(database.rows.get("brand_name")?.draft_value, "Draft brand");
  assert.equal(database.batches.length, 1);
  assertNoIndividualWrites(database);
});

test("publish-all sends every dirty setting through one D1 batch and reports stale rows as skipped", async () => {
  const database = new FakeSiteDatabase();
  database.markerPlan = [true, false];

  const result = await publishAllAdminSiteSettingsAtomic(database, { actorSubject: "owner" });

  assert.equal(database.batches.length, 1, "bulk publish must use one transaction for the whole dirty set");
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 4, "two dirty settings produce marker+publish pairs");
  assert.equal(result.published.length, 1);
  assert.equal(result.skipped, 1);
  assert.ok(batch.filter((statement) => statement.query.includes("INSERT INTO audit_logs")).length === 2);
  assert.ok(batch.filter((statement) => statement.query.includes("UPDATE site_settings")).length === 2);
  assert.ok(batch.every((statement, index) => index % 2 === 0
    ? statement.query.includes("draft_value <> published_value")
    : statement.query.includes("EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)")
  ));
  assertNoIndividualWrites(database);
});

test("invalid setting values fail before any transactional write is prepared", async () => {
  const database = new FakeSiteDatabase();
  await assert.rejects(
    updateAdminSiteSettingAtomic(database, {
      actorSubject: "owner",
      expectedVersion: 1,
      key: "primary_color",
      value: "red",
    }),
    SiteSettingValidationError,
  );
  assert.equal(database.batches.length, 0);
});

test("site-setting mutation routes use only the atomic writer", async () => {
  const [saveRoute, publishRoute, publishAllRoute] = await Promise.all([
    readFile(path.join(repoRoot, "src/app/api/admin/site-settings/route.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/app/api/admin/site-settings/publish/route.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/app/api/admin/site-settings/publish-all/route.ts"), "utf8"),
  ]);

  assert.match(saveRoute, /updateAdminSiteSettingAtomic/);
  assert.doesNotMatch(saveRoute, /\bupdateAdminSiteSetting\b/);
  assert.match(publishRoute, /publishAdminSiteSettingAtomic/);
  assert.doesNotMatch(publishRoute, /\bpublishAdminSiteSetting\b/);
  assert.match(publishAllRoute, /publishAllAdminSiteSettingsAtomic/);
  assert.doesNotMatch(publishAllRoute, /\bpublishAllAdminSiteSettings\b/);
});
