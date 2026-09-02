import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  publishAllAdminSiteSettings,
} from "../src/lib/site-settings.ts";

type SettingKey = "brand_name" | "brand_tagline" | "primary_color";

type Row = {
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

const bulkRequestId = "55555555-5555-4555-8555-555555555555";

class BulkSettingsDatabase {
  readonly rows = new Map<SettingKey, Row>();
  readonly bulkAudits = new Map<string, { selected: number; published: number; fingerprint: string }>();
  readonly settingAudits: Array<{ bulkRequestId: string; key: SettingKey }> = [];
  batchCalls = 0;
  staleKey: SettingKey | null = null;

  constructor() {
    this.rows.set("brand_name", this.row("brand_name", "Giacong mới", "Giacong cũ", "text"));
    this.rows.set("brand_tagline", this.row("brand_tagline", "Khẩu hiệu", "Khẩu hiệu", "text"));
    this.rows.set("primary_color", this.row("primary_color", "#123456", "#6cbe45", "color"));
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
    this.batchCalls += 1;
    const results: unknown[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  private async all<T>(query: string, values: unknown[]): Promise<{ results: T[] }> {
    if (query.includes("admin_site_setting_audit") && query.includes("bulk_request_id")) {
      const bulkRequestId = String(values[0]);
      return {
        results: this.settingAudits
          .filter((audit) => audit.bulkRequestId === bulkRequestId)
          .map((audit) => ({ entity_key: audit.key })) as T[],
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
    if (query.includes("admin_site_setting_bulk_audit")) {
      const audit = this.bulkAudits.get(String(values[0]));
      return (audit
        ? {
            operation: "publish_all",
            payload_sha256: audit.fingerprint,
            selected_count: audit.selected,
            published_count: audit.published,
          }
        : null) as T | null;
    }
    const row = this.rows.get(String(values[0]) as SettingKey);
    return (row ?? null) as T | null;
  }

  private async run(query: string, values: unknown[]) {
    if (query.includes("INSERT INTO admin_site_setting_bulk_audit")) {
      this.bulkAudits.set(String(values[0]), {
        fingerprint: String(values[2]),
        published: Number(values[4] ?? 0),
        selected: Number(values[3]),
      });
      return { meta: { changes: 1 } };
    }
    if (query.includes("UPDATE admin_site_setting_bulk_audit")) {
      const bulkRequestId = String(values[0]);
      const requestId = String(values[1]);
      const audit = this.bulkAudits.get(requestId);
      if (!audit || audit.selected < 0 || requestId !== bulkRequestId) return { meta: { changes: 0 } };
      audit.published = this.settingAudits.filter((item) => item.bulkRequestId === bulkRequestId).length;
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO admin_site_setting_audit")) {
      const key = String(values[5]) as SettingKey;
      const row = this.rows.get(key);
      const bulkRequestId = String(values[4]);
      if (!row || row.version !== Number(values[6]) || row.last_request_id !== String(values[0])) {
        return { meta: { changes: 0 } };
      }
      this.settingAudits.push({ bulkRequestId, key });
      return { meta: { changes: 1 } };
    }
    if (query.includes("UPDATE site_settings")) {
      const key = String(values[3]) as SettingKey;
      const row = this.rows.get(key);
      if (!row || key === this.staleKey || row.version !== Number(values[4])) {
        return { meta: { changes: 0 } };
      }
      row.published_value = row.draft_value;
      row.published_by = String(values[0]);
      row.updated_by = String(values[1]);
      row.last_request_id = String(values[2]);
      row.version += 1;
      row.updated_at = "2026-08-28T00:00:00Z";
      row.published_at = row.updated_at;
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  }

  private row(
    key: SettingKey,
    draft: string,
    published: string,
    valueType: Row["value_type"],
  ): Row {
    return {
      description: "",
      draft_value: draft,
      group_name: "brand",
      label: key,
      last_request_id: null,
      published_at: null,
      published_by: null,
      published_value: published,
      setting_key: key,
      updated_at: "2026-08-27T00:00:00Z",
      updated_by: null,
      value_type: valueType,
      version: 1,
    };
  }
}

test("bulk settings publish is atomic, audited per setting and idempotent on replay", async () => {
  const database = new BulkSettingsDatabase();

  const first = await publishAllAdminSiteSettings(database, {
    actorSubject: "owner",
    requestId: bulkRequestId,
  });
  const replay = await publishAllAdminSiteSettings(database, {
    actorSubject: "owner",
    requestId: bulkRequestId,
  });

  assert.deepEqual(first.published.map((setting) => setting.key), ["brand_name", "primary_color"]);
  assert.deepEqual(replay.published.map((setting) => setting.key), ["brand_name", "primary_color"]);
  assert.equal(first.skipped, 0);
  assert.equal(replay.skipped, 0);
  assert.equal(database.rows.get("brand_name")?.version, 2);
  assert.equal(database.rows.get("primary_color")?.version, 2);
  assert.equal(database.settingAudits.length, 2);
  assert.equal(database.bulkAudits.size, 1);
  assert.equal(database.batchCalls, 1);
});

test("bulk settings publish preserves per-item stale skips and replay result", async () => {
  const database = new BulkSettingsDatabase();
  database.staleKey = "primary_color";

  const first = await publishAllAdminSiteSettings(database, {
    actorSubject: "owner",
    requestId: bulkRequestId,
  });
  const replay = await publishAllAdminSiteSettings(database, {
    actorSubject: "owner",
    requestId: bulkRequestId,
  });

  assert.deepEqual(first.published.map((setting) => setting.key), ["brand_name"]);
  assert.deepEqual(replay.published.map((setting) => setting.key), ["brand_name"]);
  assert.equal(first.skipped, 1);
  assert.equal(replay.skipped, 1);
  assert.equal(database.settingAudits.length, 1);
  assert.equal(database.batchCalls, 1);
});

test("bulk settings write contract has a tracked migration and exact request bodies", async () => {
  const migration = await readFile(new URL("../migrations/0011_site_settings_bulk_publish.sql", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/app/api/admin/site-settings/publish-all/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/admin/noi-dung/page.tsx", import.meta.url), "utf8");

  assert.match(migration, /CREATE TABLE admin_site_setting_bulk_audit/);
  assert.match(migration, /ALTER TABLE admin_site_setting_audit ADD COLUMN bulk_request_id TEXT/);
  assert.match(route, /readBoundedAdminJson/);
  assert.match(route, /hasOnlyKeys\(body, \["requestId"\]\)/);
  assert.match(page, /body: \{ requestId \}/);
  assert.match(page, /publishAllRequestId/);
  assert.match(page, /if \(publishingAll\) return/);
  assert.match(page, /status >= 400 && clientError\.status < 500/);
});

test("read-only content roles cannot change the color picker", async () => {
  const page = await readFile(new URL("../src/app/admin/noi-dung/page.tsx", import.meta.url), "utf8");

  assert.match(page, /className="admin-color-input" disabled=\{!canEdit\}/);
});

test("bulk result keeps the existing AdminSiteSetting response shape", async () => {
  const database = new BulkSettingsDatabase();
  const result = await publishAllAdminSiteSettings(database, {
    actorSubject: "owner",
    requestId: bulkRequestId,
  });
  assert.equal(typeof result.published[0]?.draftValue, "string");
  assert.equal(typeof result.published[0]?.publishedValue, "string");
  assert.equal(result.published[0] instanceof Object, true);
});
