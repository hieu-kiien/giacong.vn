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
};

class FakeSiteDatabase {
  readonly rows = new Map<string, Row>();
  readonly audits: string[] = [];

  constructor() {
    this.rows.set("brand_name", this.row("brand_name", "brand", "text", "Draft brand", "Published brand"));
    this.rows.set("contact_zalo_url", this.row("contact_zalo_url", "contact", "url", "https://zalo.me/old", "https://zalo.me/old"));
    this.rows.set("primary_color", this.row("primary_color", "brand", "color", "#6cbe45", "#6cbe45"));
  }

  prepare(query: string) {
    let values: unknown[] = [];
    return {
      bind: (...nextValues: unknown[]) => {
        values = nextValues;
        return this.prepareWithValues(query, () => values);
      },
      all: async <T,>() => ({ results: [...this.rows.values()] as unknown as T[] }),
      first: async <T,>() => {
        const key = String(values[0]);
        return (this.rows.get(key) ?? null) as unknown as T | null;
      },
      run: async () => {
        if (query.includes("INSERT INTO audit_logs")) {
          this.audits.push(String(values[2]));
          return { meta: { changes: 1 } };
        }
        const key = String(values[2] ?? values[0]);
        const row = this.rows.get(key);
        if (!row) return { meta: { changes: 0 } };
        const expectedVersion = Number(values.at(-1));
        if (row.version !== expectedVersion) return { meta: { changes: 0 } };
        if (query.includes("published_value = draft_value")) {
          row.published_value = row.draft_value;
          row.published_by = String(values[0]);
          row.published_at = "2026-08-16T00:00:00Z";
          row.updated_by = String(values[1]);
        } else {
          row.draft_value = String(values[0]);
          row.updated_by = String(values[1]);
        }
        row.version += 1;
        row.updated_at = "2026-08-16T00:00:00Z";
        return { meta: { changes: 1 } };
      },
    };
  }

  private prepareWithValues(query: string, readValues: () => unknown[]) {
    const statement = this.prepare(query);
    return {
      ...statement,
      first: async <T,>() => {
        const key = String(readValues()[0]);
        return (this.rows.get(key) ?? null) as unknown as T | null;
      },
      run: async () => {
        if (query.includes("INSERT INTO audit_logs")) {
          this.audits.push(String(readValues()[3]));
          return { meta: { changes: 1 } };
        }
        const values = readValues();
        const key = String(values[2] ?? values[0]);
        const row = this.rows.get(key);
        if (!row) return { meta: { changes: 0 } };
        const expectedVersion = Number(values.at(-1));
        if (row.version !== expectedVersion) return { meta: { changes: 0 } };
        if (query.includes("published_value = draft_value")) {
          row.published_value = row.draft_value;
          row.published_by = String(values[0]);
          row.published_at = "2026-08-16T00:00:00Z";
          row.updated_by = String(values[1]);
        } else {
          row.draft_value = String(values[0]);
          row.updated_by = String(values[1]);
        }
        row.version += 1;
        row.updated_at = "2026-08-16T00:00:00Z";
        return { meta: { changes: 1 } };
      },
    };
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
  assert.equal(canManageSiteContent("content_manager"), true);
  assert.equal(canManageSiteContent("catalog_manager"), false);
  assert.equal(canPublishSiteContent("sales_manager"), false);
  assert.equal(canPublishSiteContent("viewer"), false);
});