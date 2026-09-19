// Regression: admin display copy (label/description) for site settings comes
// from the code definitions, so wording fixes apply without a data migration.
// Values, versions and audit metadata still come from the database row.
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { listAdminSiteSettings } from "../src/lib/site-settings.ts";

function fakeDb(rows: Array<Record<string, unknown>>) {
  return {
    prepare() {
      return {
        all: async () => ({ results: rows }),
      };
    },
  };
}

function oldCopyRow() {
  return {
    setting_key: "site_title",
    group_name: "seo",
    label: "SEO title",
    description: "Tieu de cu",
    value_type: "text",
    draft_value: "Tieu de moi",
    published_value: "Tieu de cu",
    version: 2,
    updated_by: "owner",
    updated_at: "2026-09-04T00:00:00.000Z",
    published_by: null,
    published_at: null,
  };
}

test("setting display copy comes from code definitions, not stale database copy", async () => {
  const settings = await listAdminSiteSettings(fakeDb([oldCopyRow()]) as never);

  assert.equal(settings.length, 1);
  assert.equal(settings[0]?.key, "site_title");
  assert.equal(settings[0]?.label, "Tiêu đề tìm kiếm Google");
  assert.match(settings[0]?.description ?? "", /Hiện ở:/);
});

test("setting values and versions still come from the database row", async () => {
  const settings = await listAdminSiteSettings(fakeDb([oldCopyRow()]) as never);

  assert.equal(settings[0]?.draftValue, "Tieu de moi");
  assert.equal(settings[0]?.publishedValue, "Tieu de cu");
  assert.equal(settings[0]?.version, 2);
  assert.equal(settings[0]?.dirty, true);
});

test("unknown setting keys fall back to the database copy", async () => {
  const settings = await listAdminSiteSettings(
    fakeDb([{ ...oldCopyRow(), setting_key: "legacy_key", label: "Nhan cu" }]) as never,
  );

  assert.equal(settings[0]?.key, "legacy_key");
  assert.equal(settings[0]?.label, "Nhan cu");
});

test("empty published value reports the built-in default as effective", async () => {
  const settings = await listAdminSiteSettings(
    fakeDb([{ ...oldCopyRow(), draft_value: "", published_value: "" }]) as never,
  );

  assert.equal(settings[0]?.effectiveValue, "Kienhieu - Giải pháp gia công toàn diện");
  assert.equal(settings[0]?.isDefaultValue, true);
});

test("saved published value reports itself as effective", async () => {
  const settings = await listAdminSiteSettings(
    fakeDb([{ ...oldCopyRow(), draft_value: "", published_value: "Ten da luu" }]) as never,
  );

  assert.equal(settings[0]?.effectiveValue, "Ten da luu");
  assert.equal(settings[0]?.isDefaultValue, false);
});

test("admin editor explains the effective value without replacing an empty draft", async () => {
  const source = await readFile(new URL("../src/app/admin/noi-dung/page.tsx", import.meta.url), "utf8");

  assert.match(source, /setting-effective-\$\{setting\.key\}/);
  assert.match(source, /ngoài web đang dùng giá trị mặc định/);
  assert.match(source, /ngoài web đang dùng bản đã đăng/);
  assert.match(source, /placeholder=\{setting\.isDefaultValue && setting\.effectiveValue/);
});
