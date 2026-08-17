import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SiteSettingConflictError } from "../src/lib/site-settings.ts";
import {
  cleanupSiteMediaAsset,
  createAndActivateSiteMedia,
} from "../src/lib/site-media-lifecycle-core.ts";

type SettingRow = {
  setting_key: "logo_url";
  group_name: "brand";
  label: string;
  description: string;
  value_type: "image";
  draft_value: string;
  published_value: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
};

type MediaRow = {
  byte_size: number;
  checksum_sha256: string;
  content_type: string;
  created_at: string;
  id: string;
  original_filename: string;
  setting_key: string;
  status: "active" | "deleted" | "replaced";
  storage_key: string;
};

class FakeStatement {
  readonly database: FakeDatabase;
  readonly query: string;
  values: unknown[] = [];
  runCalls = 0;

  constructor(database: FakeDatabase, query: string) {
    this.database = database;
    this.query = query.replace(/\s+/g, " ").trim();
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    return { results: [] as T[] };
  }

  async first<T>() {
    if (this.query.includes("FROM site_settings")) {
      const key = String(this.values[0]);
      return (key === this.database.setting.setting_key ? this.database.setting : null) as T | null;
    }
    if (this.query.includes("FROM site_media_assets")) {
      const id = String(this.values[0]);
      return (this.database.media.get(id) ?? null) as T | null;
    }
    return null;
  }

  async run() {
    this.runCalls += 1;
    throw new Error("site media lifecycle must not call statement.run()");
  }
}

class FakeBucket {
  readonly events: string[];
  readonly puts: string[] = [];
  readonly deletes: string[] = [];

  constructor(events: string[]) {
    this.events = events;
  }

  async put(key: string) {
    this.puts.push(key);
    this.events.push(`r2-put:${key}`);
  }

  async delete(key: string) {
    this.deletes.push(key);
    this.events.push(`r2-delete:${key}`);
  }
}

class FakeDatabase {
  readonly batches: FakeStatement[][] = [];
  readonly events: string[];
  readonly media = new Map<string, MediaRow>();
  readonly prepared: FakeStatement[] = [];
  setting: SettingRow;
  markerPlan: boolean[] = [];
  throwOnBatch = false;

  constructor(events: string[]) {
    this.events = events;
    this.setting = {
      description: "",
      draft_value: "/media/site-settings/logo_url/old.webp",
      group_name: "brand",
      label: "Logo",
      published_at: null,
      published_by: null,
      published_value: "/media/site-settings/logo_url/old.webp",
      setting_key: "logo_url",
      updated_at: "2026-08-17T00:00:00Z",
      updated_by: null,
      value_type: "image",
      version: 1,
    };
    this.media.set("old-media", {
      byte_size: 100,
      checksum_sha256: "old",
      content_type: "image/webp",
      created_at: "2026-08-17T00:00:00Z",
      id: "old-media",
      original_filename: "old.webp",
      setting_key: "logo_url",
      status: "active",
      storage_key: "site-settings/logo_url/old.webp",
    });
  }

  prepare(query: string) {
    const statement = new FakeStatement(this, query);
    this.prepared.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    this.events.push("d1-batch");
    if (this.throwOnBatch) throw new Error("simulated D1 batch failure");

    const markers = new Set<string>();
    const results: Array<{ results: unknown[] }> = [];

    for (const statement of statements) {
      if (statement.query.includes("INSERT INTO audit_logs") && statement.query.includes("RETURNING id")) {
        const markerId = String(statement.values[0]);
        const planned = this.markerPlan.length ? Boolean(this.markerPlan.shift()) : true;
        let allowed = planned;
        if (statement.query.includes("FROM site_settings")) {
          const key = String(statement.values[4]);
          const expectedVersion = Number(statement.values[5]);
          allowed = allowed && key === this.setting.setting_key && expectedVersion === this.setting.version;
        } else if (statement.query.includes("FROM site_media_assets")) {
          const id = String(statement.values[4]);
          const row = this.media.get(id);
          allowed = allowed && row !== undefined && row.status !== "deleted";
        }
        if (allowed) markers.add(markerId);
        results.push({ results: allowed ? [{ id: markerId }] : [] });
        continue;
      }

      if (statement.query.includes("INSERT INTO site_media_assets")) {
        const markerId = String(statement.values[8]);
        if (markers.has(markerId)) {
          const id = String(statement.values[0]);
          this.media.set(id, {
            byte_size: Number(statement.values[5]),
            checksum_sha256: String(statement.values[6]),
            content_type: String(statement.values[4]),
            created_at: "2026-08-18T00:00:00Z",
            id,
            original_filename: String(statement.values[3]),
            setting_key: String(statement.values[1]),
            status: "active",
            storage_key: String(statement.values[2]),
          });
        }
        results.push({ results: [] });
        continue;
      }

      if (statement.query.includes("UPDATE site_settings")) {
        const markerId = String(statement.values[4]);
        if (markers.has(markerId) && Number(statement.values[3]) === this.setting.version) {
          this.setting.draft_value = String(statement.values[0]);
          this.setting.updated_by = String(statement.values[1]);
          this.setting.updated_at = "2026-08-18T00:00:00Z";
          this.setting.version += 1;
        }
        results.push({ results: [] });
        continue;
      }

      if (statement.query.includes("SET status = 'replaced'")) {
        const markerId = String(statement.values[2]);
        if (markers.has(markerId)) {
          const settingKey = String(statement.values[0]);
          const exceptId = String(statement.values[1]);
          for (const row of this.media.values()) {
            if (row.setting_key === settingKey && row.status === "active" && row.id !== exceptId) row.status = "replaced";
          }
        }
        results.push({ results: [] });
        continue;
      }

      if (statement.query.includes("SET status = 'deleted'")) {
        const markerId = String(statement.values[1]);
        const row = this.media.get(String(statement.values[0]));
        if (row && markers.has(markerId)) row.status = "deleted";
        results.push({ results: [] });
        continue;
      }

      results.push({ results: [] });
    }

    return results;
  }
}

const upload = {
  actorSubject: "owner@example.com",
  bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer,
  checksumSha256: "abc123",
  contentType: "image/webp" as const,
  expectedVersion: 1,
  originalFilename: "logo.webp",
  settingKey: "logo_url" as const,
};

test("site media create, setting activation, audits and old-media replacement share one D1 batch", async () => {
  const events: string[] = [];
  const database = new FakeDatabase(events);
  const bucket = new FakeBucket(events);

  const result = await createAndActivateSiteMedia(database, bucket, upload);

  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 5, "marker + media row + media audit + setting update + replacement");
  assert.match(batch[0]?.query ?? "", /site_setting\.updated/);
  assert.match(batch[0]?.query ?? "", /setting_key = \? AND version = \?/);
  assert.match(batch[0]?.query ?? "", /RETURNING id/);
  assert.match(batch[1]?.query ?? "", /INSERT INTO site_media_assets/);
  assert.match(batch[2]?.query ?? "", /site_media\.created/);
  assert.match(batch[3]?.query ?? "", /UPDATE site_settings/);
  assert.match(batch[4]?.query ?? "", /SET status = 'replaced'/);
  const marker = batch[0]?.values[0];
  assert.ok(batch.slice(1).every((statement) => statement.values.includes(marker)));
  assert.equal(result.setting.version, 2);
  assert.equal(result.setting.draftValue, result.media.publicUrl);
  assert.equal(database.media.get("old-media")?.status, "replaced");
  assert.equal(database.media.get(result.media.id)?.status, "active");
  assert.equal(bucket.puts.length, 1);
  assert.equal(bucket.deletes.length, 0);
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
});

test("a concurrent setting change leaves D1 untouched and compensates the uploaded R2 object", async () => {
  const events: string[] = [];
  const database = new FakeDatabase(events);
  const bucket = new FakeBucket(events);
  database.markerPlan = [false];

  await assert.rejects(
    createAndActivateSiteMedia(database, bucket, upload),
    SiteSettingConflictError,
  );

  assert.equal(database.setting.version, 1);
  assert.equal(database.setting.draft_value, "/media/site-settings/logo_url/old.webp");
  assert.equal(database.media.size, 1);
  assert.equal(database.media.get("old-media")?.status, "active");
  assert.equal(bucket.puts.length, 1);
  assert.deepEqual(bucket.deletes, bucket.puts);
});

test("a D1 transaction failure compensates R2 instead of leaving a canonical media row", async () => {
  const events: string[] = [];
  const database = new FakeDatabase(events);
  const bucket = new FakeBucket(events);
  database.throwOnBatch = true;

  await assert.rejects(createAndActivateSiteMedia(database, bucket, upload), /simulated D1 batch failure/);
  assert.equal(database.media.size, 1);
  assert.deepEqual(bucket.deletes, bucket.puts);
});

test("missing D1 batch fails before the R2 upload begins", async () => {
  const events: string[] = [];
  const source = new FakeDatabase(events);
  const database = { prepare: source.prepare.bind(source) };
  const bucket = new FakeBucket(events);

  await assert.rejects(
    createAndActivateSiteMedia(database, bucket, upload),
    /D1 batch\(\) là bắt buộc/,
  );
  assert.equal(bucket.puts.length, 0);
});

test("site media cleanup commits D1 soft-delete before deleting the R2 object and retries idempotently", async () => {
  const events: string[] = [];
  const database = new FakeDatabase(events);
  const bucket = new FakeBucket(events);

  await cleanupSiteMediaAsset(database, bucket, { actorSubject: "owner", assetId: "old-media" });
  assert.equal(database.media.get("old-media")?.status, "deleted");
  assert.ok(events.indexOf("d1-batch") < events.findIndex((event) => event.startsWith("r2-delete:")));
  assert.equal(database.batches.length, 1);

  await cleanupSiteMediaAsset(database, bucket, { actorSubject: "owner", assetId: "old-media" });
  assert.equal(database.batches.length, 1, "retry after D1 soft-delete must not create another audit batch");
  assert.equal(bucket.deletes.length, 2, "retry only repeats the idempotent R2 delete");
});

test("site-settings media route uses the atomic lifecycle and no legacy split writers", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/site-settings/media/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /createAndActivateSiteMedia/);
  assert.doesNotMatch(route, /\bcreateSiteMediaAsset\b/);
  assert.doesNotMatch(route, /\bupdateAdminSiteSetting\b/);
  assert.doesNotMatch(route, /\breplaceActiveSiteMedia\b/);
  assert.doesNotMatch(route, /\bdeleteSiteMediaAsset\b/);
});
