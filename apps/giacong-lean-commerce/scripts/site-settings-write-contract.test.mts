import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  publishAdminSiteSetting,
  selectPublishedSiteSettings,
  SiteSettingConflictError,
  SiteSettingIdempotencyConflictError,
  SiteSettingValidationError,
  updateAdminSiteSetting,
} from "../src/lib/site-settings.ts";

type SettingRow = {
  setting_key: "brand_name" | "primary_color";
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
  last_request_id?: string | null;
};

const draftRequestId = "11111111-1111-4111-8111-111111111111";
const publishRequestId = "22222222-2222-4222-8222-222222222222";

class ContractDatabase {
  readonly rows = new Map<string, SettingRow>();
  readonly audits = new Map<string, { fingerprint: string; operation: string }>();
  batchCalls = 0;

  constructor() {
    this.rows.set("brand_name", this.row("brand_name", "text", "Draft brand", "Published brand"));
    this.rows.set("primary_color", this.row("primary_color", "color", "#6cbe45", "#6cbe45"));
  }

  prepare(query: string) {
    let values: unknown[] = [];
    const statement = {
      bind: (...nextValues: unknown[]) => {
        values = nextValues;
        return statement;
      },
      all: async <T,>() => ({ results: [...this.rows.values()] as unknown as T[] }),
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

  private async first<T>(query: string, values: unknown[]): Promise<T | null> {
    if (query.includes("site-setting-write-postcondition-read")) {
      return { complete: 1 } as T;
    }
    if (query.includes("admin_site_setting_audit")) {
      const requestId = String(values[0]);
      const audit = this.audits.get(requestId);
      return (audit ? { payload_sha256: audit.fingerprint, operation: audit.operation } : null) as T | null;
    }
    const key = String(values[0]);
    return (this.rows.get(key) ?? null) as T | null;
  }

  private async run(query: string, values: unknown[]) {
    if (query.includes("site-setting-write-postcondition")) {
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO admin_site_setting_audit")) {
      const requestId = String(values.find((value) => this.isUuid(value)) ?? "");
      const key = String(values.find((value) => this.rows.has(String(value))) ?? "");
      const row = this.rows.get(key);
      const fingerprint = String(values.find((value) => this.isFingerprint(value)) ?? "");
      const expectedResultingVersion = Number(values[6]);
      if (!row || row.last_request_id !== requestId || row.version !== expectedResultingVersion) {
        return { meta: { changes: 0 } };
      }
      this.audits.set(requestId, { fingerprint, operation: String(values[2]) });
      return { meta: { changes: 1 } };
    }
    if (query.includes("UPDATE site_settings")) {
      const key = String(values.find((value) => this.rows.has(String(value))) ?? "");
      const row = this.rows.get(key);
      const expectedVersion = Number(values.at(-1));
      const requestId = String(values.find((value) => this.isUuid(value)) ?? "");
      if (!row || row.version !== expectedVersion) return { meta: { changes: 0 } };
      if (query.includes("published_value = draft_value")) {
        row.published_value = row.draft_value;
        row.published_by = String(values[0]);
        row.published_at = "2026-08-28T00:00:00Z";
      } else {
        row.draft_value = String(values[0]);
      }
      row.last_request_id = requestId;
      row.updated_by = String(values[1]);
      row.version += 1;
      row.updated_at = "2026-08-28T00:00:00Z";
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  }

  private row(
    key: SettingRow["setting_key"],
    type: SettingRow["value_type"],
    draft: string,
    published: string,
  ): SettingRow {
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
      value_type: type,
      version: 1,
    };
  }

  private isUuid(value: unknown): boolean {
    return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private isFingerprint(value: unknown): boolean {
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  }
}

test("replaying the same draft request is idempotent", async () => {
  const database = new ContractDatabase();
  const input = {
    actorSubject: "owner",
    expectedVersion: 1,
    key: "brand_name",
    requestId: draftRequestId,
    value: "New draft",
  };

  const first = await updateAdminSiteSetting(database, input);
  const replay = await updateAdminSiteSetting(database, input);

  assert.equal(first.version, 2);
  assert.equal(replay.version, 2);
  assert.equal(database.rows.get("brand_name")?.draft_value, "New draft");
  assert.equal(database.audits.size, 1);
  assert.equal(database.batchCalls, 1);
});

test("reusing a request id with another payload conflicts without mutation", async () => {
  const database = new ContractDatabase();
  await updateAdminSiteSetting(database, {
    actorSubject: "owner",
    expectedVersion: 1,
    key: "brand_name",
    requestId: draftRequestId,
    value: "New draft",
  });

  await assert.rejects(
    updateAdminSiteSetting(database, {
      actorSubject: "owner",
      expectedVersion: 1,
      key: "brand_name",
      requestId: draftRequestId,
      value: "Different draft",
    }),
    SiteSettingIdempotencyConflictError,
  );
  assert.equal(database.rows.get("brand_name")?.draft_value, "New draft");
  assert.equal(database.rows.get("brand_name")?.version, 2);
  assert.equal(database.audits.size, 1);
});

test("stale and invalid writes do not mutate the draft or audit", async () => {
  const database = new ContractDatabase();
  await updateAdminSiteSetting(database, {
    actorSubject: "editor-a",
    expectedVersion: 1,
    key: "brand_name",
    requestId: draftRequestId,
    value: "First writer",
  });

  await assert.rejects(
    updateAdminSiteSetting(database, {
      actorSubject: "editor-b",
      expectedVersion: 1,
      key: "brand_name",
      requestId: "33333333-3333-4333-8333-333333333333",
      value: "Stale writer",
    }),
    SiteSettingConflictError,
  );
  await assert.rejects(
    updateAdminSiteSetting(database, {
      actorSubject: "editor-b",
      expectedVersion: 2,
      key: "primary_color",
      requestId: "44444444-4444-4444-8444-444444444444",
      value: "red",
    }),
    SiteSettingValidationError,
  );
  assert.equal(database.rows.get("brand_name")?.draft_value, "First writer");
  assert.equal(database.rows.get("brand_name")?.version, 2);
  assert.equal(database.audits.size, 1);
});

test("publish replay is idempotent and public selection ignores draft values", async () => {
  const database = new ContractDatabase();
  await updateAdminSiteSetting(database, {
    actorSubject: "owner",
    expectedVersion: 1,
    key: "brand_name",
    requestId: draftRequestId,
    value: "Published later",
  });
  const input = { actorSubject: "owner", expectedVersion: 2, key: "brand_name", requestId: publishRequestId };
  const first = await publishAdminSiteSetting(database, input);
  const replay = await publishAdminSiteSetting(database, input);

  assert.equal(first.publishedValue, "Published later");
  assert.equal(replay.version, 3);
  assert.equal(database.rows.get("brand_name")?.version, 3);
  assert.equal(database.audits.size, 2);
  assert.equal(selectPublishedSiteSettings([{ setting_key: "brand_name", published_value: "Published later" }]).brand_name, "Published later");
});

test("settings UI sends a fresh request id for draft saves and publishes", async () => {
  const source = await readFile(new URL("../src/app/admin/noi-dung/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const requestId = crypto\.randomUUID\(\);[\s\S]*?body: \{ requestId, key: setting\.key, value: setting\.draftValue, expectedVersion: setting\.version \}/);
  assert.match(source, /const requestId = crypto\.randomUUID\(\);[\s\S]*?body: \{ requestId, key: setting\.key, expectedVersion: setting\.version \}/);
  assert.match(source, /if \(value === setting\.draftValue\) next\.delete\(key\);/);
});
