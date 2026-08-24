import assert from "node:assert/strict";
import test from "node:test";

import { parseAdminNewsPayload } from "../src/lib/admin-news-input.ts";

const valid = {
  content: "Đoạn đầu.\n\nĐoạn sau.",
  coverImageUrl: "https://media.example.test/news/cover.jpg",
  excerpt: "Tóm tắt ngắn cho danh sách tin.",
  isPublished: false,
  slug: "ra-mat-dong-bot-moi",
  title: "Ra mắt dòng bột mới",
};

test("parses a valid news payload", () => {
  const parsed = parseAdminNewsPayload(valid);

  assert.equal(parsed.fieldErrors && Object.keys(parsed.fieldErrors).length, 0);
  assert.deepEqual(parsed.input, { ...valid });
});

test("rejects missing title/slug and unsafe cover URLs per field", () => {
  const parsed = parseAdminNewsPayload({ ...valid, coverImageUrl: "javascript:x", slug: "", title: "" });

  assert.equal(parsed.input, null);
  assert.ok(parsed.fieldErrors?.title);
  assert.ok(parsed.fieldErrors?.slug);
  assert.match(parsed.fieldErrors?.coverImageUrl ?? "", /http/);
});

test("published posts require non-empty excerpt for the listing surface", () => {
  const ok = parseAdminNewsPayload({ ...valid, isPublished: true });
  assert.equal(ok.input?.isPublished, true);

  const blocked = parseAdminNewsPayload({ ...valid, excerpt: "   ", isPublished: true });
  assert.equal(blocked.input, null);
  assert.ok(blocked.fieldErrors?.excerpt);
});
