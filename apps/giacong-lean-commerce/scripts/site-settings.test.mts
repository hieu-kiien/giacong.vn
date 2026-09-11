import assert from "node:assert/strict";
import test from "node:test";
import {
  publishAdminSiteSetting,
  selectPublishedSiteSettings,
  SiteSettingConflictError,
  SiteSettingValidationError,
  updateAdminSiteSetting,
} from "../src/lib/site-settings.ts";
import { canManageSiteContent, canPublishSiteContent } from "../src/lib/admin-permissions.ts";

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
  last_request_id?: string | null;
};

class FakeSiteDatabase {
  readonly rows = new Map<string, Row>();
  readonly audits: string[] = [];
  readonly mutationAudits = new Map<string, { operation: string; payload_sha256: string }>();
  batchCalls = 0;

  constructor() {
    this.rows.set("brand_name", this.row("brand_name", "brand", "text", "Draft brand", "Published brand"));
    this.rows.set("contact_zalo_url", this.row("contact_zalo_url", "contact", "url", "https://zalo.me/old", "https://zalo.me/old"));
    this.rows.set("primary_color", this.row("primary_color", "brand", "color", "#6cbe45", "#6cbe45"));
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
      return (this.mutationAudits.get(String(values[0])) ?? null) as T | null;
    }
    return (this.rows.get(String(values[0])) ?? null) as T | null;
  }

  private async run(query: string, values: unknown[]) {
    if (query.includes("site-setting-write-postcondition")) {
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO admin_site_setting_audit")) {
      const requestId = String(values[0]);
      const key = String(values[5]);
      const row = this.rows.get(key);
      if (!row || row.last_request_id !== requestId || row.version !== Number(values[6])) {
        return { meta: { changes: 0 } };
      }
      this.mutationAudits.set(requestId, {
        operation: String(values[2]),
        payload_sha256: String(values[4]),
      });
      this.audits.push(key);
      return { meta: { changes: 1 } };
    }
    if (query.includes("INSERT INTO audit_logs")) {
      this.audits.push(String(values[3]));
      return { meta: { changes: 1 } };
    }
    if (!query.includes("UPDATE site_settings")) return { meta: { changes: 1 } };

    const key = String(values.find((value) => this.rows.has(String(value))) ?? "");
    const row = this.rows.get(key);
    const expectedVersion = Number(values.at(-1));
    const requestId = String(values.find((value) => this.isUuid(value)) ?? "");
    if (!row || row.version !== expectedVersion) return { meta: { changes: 0 } };
    if (query.includes("published_value = draft_value")) {
      row.published_value = row.draft_value;
      row.published_by = String(values[0]);
      row.published_at = "2026-08-16T00:00:00Z";
      row.updated_by = String(values[1]);
    } else {
      row.draft_value = String(values[0]);
      row.updated_by = String(values[1]);
    }
    row.last_request_id = requestId;
    row.version += 1;
    row.updated_at = "2026-08-16T00:00:00Z";
    return { meta: { changes: 1 } };
  }

  private isUuid(value: unknown): boolean {
    return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
      last_request_id: null,
      published_at: null,
      published_by: null,
      published_value: published,
      setting_key: key,
      updated_at: "2026-08-15T00:00:00Z",
      updated_by: null,
      value_type: type,
      version: 1,
    };
  }
}

test("public selection only uses published values, never drafts", () => {
  const settings = selectPublishedSiteSettings([
    { setting_key: "brand_name", published_value: "Published brand" },
  ]);
  assert.equal(settings.brand_name, "Published brand");
  assert.notEqual(settings.brand_name, "Draft brand");
});

test("draft save and publish are separate versioned operations", async () => {
  const database = new FakeSiteDatabase();
  const draft = await updateAdminSiteSetting(database, {
    actorSubject: "owner",
    expectedVersion: 1,
    key: "brand_name",
    value: "New draft",
  });
  assert.equal(draft.draftValue, "New draft");
  assert.equal(draft.publishedValue, "Published brand");
  assert.equal(draft.dirty, true);
  assert.equal(draft.version, 2);

  const published = await publishAdminSiteSetting(database, {
    actorSubject: "owner",
    expectedVersion: 2,
    key: "brand_name",
  });
  assert.equal(published.draftValue, "New draft");
  assert.equal(published.publishedValue, "New draft");
  assert.equal(published.dirty, false);
  assert.equal(published.version, 3);
  assert.deepEqual(database.audits, ["brand_name", "brand_name"]);
});

test("rejects stale writes instead of overwriting another editor", async () => {
  const database = new FakeSiteDatabase();
  await updateAdminSiteSetting(database, {
    actorSubject: "editor-a",
    expectedVersion: 1,
    key: "brand_name",
    value: "First writer",
  });
  await assert.rejects(
    updateAdminSiteSetting(database, {
      actorSubject: "editor-b",
      expectedVersion: 1,
      key: "brand_name",
      value: "Stale writer",
    }),
    SiteSettingConflictError,
  );
  assert.equal(database.rows.get("brand_name")?.draft_value, "First writer");
});

test("rejects malformed colors and unsafe URLs", async () => {
  const database = new FakeSiteDatabase();
  await assert.rejects(
    updateAdminSiteSetting(database, { actorSubject: "owner", expectedVersion: 1, key: "primary_color", value: "red" }),
    SiteSettingValidationError,
  );
  await assert.rejects(
    updateAdminSiteSetting(database, { actorSubject: "owner", expectedVersion: 1, key: "contact_zalo_url", value: "javascript:alert(1)" }),
    SiteSettingValidationError,
  );
});

test("only owner and content manager can edit or publish site content", () => {
  assert.equal(canManageSiteContent("owner"), true);
  assert.equal(canManageSiteContent("content_manager"), false);
  assert.equal(canManageSiteContent("catalog_manager"), false);
  assert.equal(canPublishSiteContent("sales_manager"), false);
  assert.equal(canPublishSiteContent("viewer"), false);
});
