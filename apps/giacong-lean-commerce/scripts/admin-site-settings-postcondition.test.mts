import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  publishAdminSiteSetting,
  publishAllAdminSiteSettings,
  SiteSettingStorageError,
  updateAdminSiteSetting,
} from "../src/lib/site-settings.ts";

type SettingKey = "brand_name" | "brand_tagline" | "primary_color";

type SettingRow = {
  setting_key: SettingKey;
  group_name: "brand";
  label: string;
  description: string;
  value_type: "text" | "color";
  draft_value: string;
  published_value: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
  last_request_id: string | null;
};

type SettingAudit = {
  requestId: string;
  actorSubject: string;
  operation: "draft" | "publish";
  entityKey: SettingKey;
  previousRevision: number;
  resultingRevision: number;
  payloadSha256: string;
  bulkRequestId: string | null;
};

class OmittedResultSettingsDatabase {
  readonly rows = new Map<SettingKey, SettingRow>();
  readonly audits = new Map<string, SettingAudit>();
  readonly bulkAudits = new Map<string, { actorSubject: string; payloadSha256: string; selectedCount: number; publishedCount: number }>();
  omitBatchResults = true;
  failPostcondition = false;
  staleKey: SettingKey | null = null;

  constructor() {
    this.rows.set("brand_name", this.row("brand_name", "Bản nháp", "Bản public", "text"));
    this.rows.set("brand_tagline", this.row("brand_tagline", "Khẩu hiệu nháp", "Khẩu hiệu public", "text"));
    this.rows.set("primary_color", this.row("primary_color", "#6cbe45", "#6cbe45", "color"));
  }

  prepare(query: string) {
    let values: unknown[] = [];
    const statement = {
      bind: (...nextValues: unknown[]) => {
        values = nextValues;
        return statement;
      },
      all: async <T,>() => this.all<T>(query, values),
      first: async <T,>() => this.first<T>(query, values),
      run: async () => this.run(query, values),
    };
    return statement;
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
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

  private async all<T>(query: string, values: unknown[]): Promise<{ results: T[] }> {
    if (query.includes("admin_site_setting_audit") && query.includes("bulk_request_id")) {
      const bulkRequestId = String(values[0]);
      return {
        results: [...this.audits.values()]
          .filter((audit) => audit.bulkRequestId === bulkRequestId)
          .map((audit) => ({
            entity_key: audit.entityKey,
            request_id: audit.requestId,
            previous_revision: audit.previousRevision,
            resulting_revision: audit.resultingRevision,
            payload_sha256: audit.payloadSha256,
            last_request_id: this.rows.get(audit.entityKey)?.last_request_id ?? null,
            version: this.rows.get(audit.entityKey)?.version ?? null,
            draft_value: this.rows.get(audit.entityKey)?.draft_value ?? null,
            published_value: this.rows.get(audit.entityKey)?.published_value ?? null,
          })) as T[],
      };
    }
    if (query.includes("FROM site_settings")) {
      const rows = [...this.rows.values()];
      return {
        results: (query.includes("draft_value <> published_value")
          ? rows.filter((row) => row.draft_value !== row.published_value)
          : rows) as T[],
      };
    }
    return { results: [] };
  }

  private async first<T>(query: string, values: unknown[]): Promise<T | null> {
    if (query.includes("site-setting-write-postcondition-read")) {
      return { complete: this.failPostcondition ? 0 : 1 } as T;
    }
    if (query.includes("admin_site_setting_bulk_audit")) {
      const audit = this.bulkAudits.get(String(values[0]));
      return (audit
        ? {
            operation: "publish_all",
            payload_sha256: audit.payloadSha256,
            selected_count: audit.selectedCount,
            published_count: audit.publishedCount,
          }
        : null) as T | null;
    }
    if (query.includes("admin_site_setting_audit")) {
      const audit = this.audits.get(String(values[0]));
      return (audit
        ? { operation: audit.operation, payload_sha256: audit.payloadSha256 }
        : null) as T | null;
    }
    return (this.rows.get(String(values[0]) as SettingKey) ?? null) as T | null;
  }

  private async run(query: string, values: unknown[]) {
    if (query.includes("site-setting-write-postcondition") || query.includes("site-setting-bulk-postcondition")) {
      if (this.failPostcondition) throw new Error("site-setting-write-postcondition failed");
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO admin_site_setting_bulk_audit")) {
      this.bulkAudits.set(String(values[0]), {
        actorSubject: String(values[1]),
        payloadSha256: String(values[2]),
        selectedCount: Number(values[3]),
        publishedCount: Number(values[4] ?? 0),
      });
      return { meta: { changes: 1 } };
    }
    if (query.includes("UPDATE admin_site_setting_bulk_audit")) {
      const requestId = String(values[1]);
      const audit = this.bulkAudits.get(requestId);
      if (!audit) return { meta: { changes: 0 } };
      audit.publishedCount = [...this.audits.values()].filter((item) => item.bulkRequestId === requestId).length;
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO admin_site_setting_audit")) {
      const isBulk = query.includes("bulk_request_id");
      const requestId = String(values[0]);
      const entityKey = String(values[isBulk ? 5 : 5]) as SettingKey;
      const row = this.rows.get(entityKey);
      const previousRevision = Number(values[isBulk ? 2 : 3]);
      const resultingRevision = Number(values[6]);
      const payloadSha256 = String(values[isBulk ? 3 : 4]);
      if (!row || row.version !== resultingRevision || row.last_request_id !== requestId) {
        return { meta: { changes: 0 } };
      }
      this.audits.set(requestId, {
        requestId,
        actorSubject: String(values[1]),
        operation: isBulk ? "publish" : String(values[2]) as "draft" | "publish",
        entityKey,
        previousRevision,
        resultingRevision,
        payloadSha256,
        bulkRequestId: isBulk ? String(values[4]) : null,
      });
      return { meta: { changes: 1 } };
    }
    if (query.includes("UPDATE site_settings")) {
      const key = String(values.at(-2)) as SettingKey;
      const expectedVersion = Number(values.at(-1));
      const row = this.rows.get(key);
      if (!row || row.version !== expectedVersion || key === this.staleKey) {
        return { meta: { changes: 0 } };
      }
      const isPublish = query.includes("published_value = draft_value");
      const actorSubject = String(values[isPublish ? 0 : 1]);
      row.last_request_id = String(values[2]);
      row.updated_by = actorSubject;
      row.updated_at = "2026-09-03T00:00:00Z";
      if (isPublish) {
        row.published_value = row.draft_value;
        row.published_by = actorSubject;
        row.published_at = row.updated_at;
      } else {
        row.draft_value = String(values[0]);
      }
      row.version += 1;
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  }

  private row(key: SettingKey, draft: string, published: string, valueType: SettingRow["value_type"]): SettingRow {
    return {
      setting_key: key,
      group_name: "brand",
      label: key,
      description: "",
      value_type: valueType,
      draft_value: draft,
      published_value: published,
      version: 1,
      updated_by: null,
      updated_at: "2026-09-03T00:00:00Z",
      published_by: null,
      published_at: null,
      last_request_id: null,
    };
  }

  private snapshot() {
    return {
      rows: structuredClone([...this.rows.entries()]),
      audits: structuredClone([...this.audits.entries()]),
      bulkAudits: structuredClone([...this.bulkAudits.entries()]),
    };
  }

  private restore(snapshot: ReturnType<OmittedResultSettingsDatabase["snapshot"]>) {
    this.rows.clear();
    this.audits.clear();
    this.bulkAudits.clear();
    for (const [key, value] of snapshot.rows) this.rows.set(key, value);
    for (const [key, value] of snapshot.audits) this.audits.set(key, value);
    for (const [key, value] of snapshot.bulkAudits) this.bulkAudits.set(key, value);
  }
}

test("single settings writes succeed when D1 omits batch result rows", async () => {
  const database = new OmittedResultSettingsDatabase();
  const draft = await updateAdminSiteSetting(database, {
    actorSubject: "owner",
    expectedVersion: 1,
    key: "brand_name",
    requestId: "11111111-1111-4111-8111-111111111111",
    value: "Bản nháp mới",
  });
  const published = await publishAdminSiteSetting(database, {
    actorSubject: "owner",
    expectedVersion: draft.version,
    key: "brand_name",
    requestId: "22222222-2222-4222-8222-222222222222",
  });

  assert.equal(draft.draftValue, "Bản nháp mới");
  assert.equal(published.publishedValue, "Bản nháp mới");
  assert.equal(database.audits.size, 2);
});

test("single settings write rolls back when its postcondition is missing", async () => {
  const database = new OmittedResultSettingsDatabase();
  database.failPostcondition = true;

  await assert.rejects(
    updateAdminSiteSetting(database, {
      actorSubject: "owner",
      expectedVersion: 1,
      key: "brand_name",
      requestId: "33333333-3333-4333-8333-333333333333",
      value: "Không được lưu",
    }),
    SiteSettingStorageError,
  );
  assert.equal(database.rows.get("brand_name")?.version, 1);
  assert.equal(database.rows.get("brand_name")?.draft_value, "Bản nháp");
  assert.equal(database.audits.size, 0);
  assert.equal(database.bulkAudits.size, 0);
});

test("bulk settings publish succeeds and replays when D1 omits result rows", async () => {
  const database = new OmittedResultSettingsDatabase();
  const result = await publishAllAdminSiteSettings(database, {
    actorSubject: "owner",
    requestId: "44444444-4444-4444-8444-444444444444",
  });
  const replay = await publishAllAdminSiteSettings(database, {
    actorSubject: "owner",
    requestId: "44444444-4444-4444-8444-444444444444",
  });

  assert.deepEqual(result.published.map((setting) => setting.key), ["brand_name", "brand_tagline"]);
  assert.deepEqual(replay.published.map((setting) => setting.key), ["brand_name", "brand_tagline"]);
  assert.equal(result.skipped, 0);
  assert.equal(database.bulkAudits.size, 1);
});

test("bulk settings publish rolls back when a postcondition is missing", async () => {
  const database = new OmittedResultSettingsDatabase();
  database.failPostcondition = true;

  await assert.rejects(
    publishAllAdminSiteSettings(database, {
      actorSubject: "owner",
      requestId: "55555555-5555-4555-8555-555555555555",
    }),
    SiteSettingStorageError,
  );
  assert.equal(database.rows.get("brand_name")?.version, 1);
  assert.equal(database.rows.get("brand_tagline")?.version, 1);
  assert.equal(database.audits.size, 0);
  assert.equal(database.bulkAudits.size, 0);
});

class SqliteSettingsDatabase {
  readonly db = new DatabaseSync(":memory:");
  readonly omitBatchResults = true;

  constructor() {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE site_settings (
        setting_key TEXT PRIMARY KEY,
        group_name TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        value_type TEXT NOT NULL,
        draft_value TEXT NOT NULL,
        published_value TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_by TEXT,
        updated_at TEXT NOT NULL,
        published_by TEXT,
        published_at TEXT,
        last_request_id TEXT
      );
      CREATE TABLE admin_site_setting_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        actor_subject TEXT NOT NULL,
        action TEXT NOT NULL,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_key TEXT NOT NULL REFERENCES site_settings(setting_key),
        previous_revision INTEGER NOT NULL,
        resulting_revision INTEGER NOT NULL,
        payload_sha256 TEXT NOT NULL,
        bulk_request_id TEXT
      );
      CREATE TABLE admin_site_setting_bulk_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        actor_subject TEXT NOT NULL,
        action TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_sha256 TEXT NOT NULL,
        selected_count INTEGER NOT NULL,
        published_count INTEGER NOT NULL
      );
      INSERT INTO site_settings (
        setting_key, group_name, label, description, value_type,
        draft_value, published_value, version, updated_at
      ) VALUES
        ('brand_name', 'brand', 'Tên', '', 'text', 'SQLite draft', 'SQLite public', 1, '2026-09-03T00:00:00Z'),
        ('brand_tagline', 'brand', 'Khẩu hiệu', '', 'text', 'Tagline draft', 'Tagline public', 1, '2026-09-03T00:00:00Z'),
        ('primary_color', 'brand', 'Màu', '', 'color', '#6cbe45', '#6cbe45', 1, '2026-09-03T00:00:00Z');
    `);
  }

  prepare(query: string) {
    const prepared = this.db.prepare(query);
    let values: unknown[] = [];
    const statement = {
      bind: (...nextValues: unknown[]) => {
        values = nextValues;
        return statement;
      },
      all: async <T,>() => ({ results: prepared.all(...values) as T[] }),
      first: async <T,>() => (prepared.get(...values) as T | undefined) ?? null,
      run: async () => {
        const result = prepared.run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
    };
    return statement;
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    this.db.exec("BEGIN");
    try {
      for (const statement of statements) await statement.run();
      this.db.exec("COMMIT");
      return this.omitBatchResults ? [] : [];
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

test("SQLite settings postconditions stay atomic when D1 omits batch results", async () => {
  const database = new SqliteSettingsDatabase();
  const draft = await updateAdminSiteSetting(database, {
    actorSubject: "owner",
    expectedVersion: 1,
    key: "brand_name",
    requestId: "66666666-6666-4666-8666-666666666666",
    value: "SQLite saved draft",
  });
  const published = await publishAdminSiteSetting(database, {
    actorSubject: "owner",
    expectedVersion: draft.version,
    key: "brand_name",
    requestId: "77777777-7777-4777-8777-777777777777",
  });
  const bulk = await publishAllAdminSiteSettings(database, {
    actorSubject: "owner",
    requestId: "88888888-8888-4888-8888-888888888888",
  });

  assert.equal(published.publishedValue, "SQLite saved draft");
  assert.deepEqual(bulk.published.map((setting) => setting.key), ["brand_tagline"]);
});
