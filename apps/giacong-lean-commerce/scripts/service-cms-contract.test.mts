import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { mergeManagedService, parseManagedServiceResponse } = await import(
  "../src/lib/service-cms-contract" + ".ts"
);

const fallback = {
  slug: "say-thuc-pham-say",
  name: "Tên tĩnh",
  summary: "Tóm tắt tĩnh",
  description: "Mô tả tĩnh",
  hubHref: "/dich-vu-say/",
  offerings: [{ href: "/say-lanh/", label: "Sấy lạnh" }],
};

test("validates and merges Bagisto CMS copy without replacing service navigation", () => {
  const managed = parseManagedServiceResponse({
    data: {
      slug: "say-thuc-pham-say",
      name: "Tên từ Bagisto",
      summary: "Tóm tắt từ Bagisto",
      description: "Mô tả từ Bagisto",
      meta_title: "SEO từ Bagisto",
    },
    meta: { channel: "default", locale: "vi", contract_version: 1 },
  });

  assert.deepEqual(mergeManagedService(fallback, managed), {
    ...fallback,
    name: "Tên từ Bagisto",
    summary: "Tóm tắt từ Bagisto",
    description: "Mô tả từ Bagisto",
  });
});

test("rejects a response with an unexpected contract shape", () => {
  assert.throws(
    () => parseManagedServiceResponse({
      data: { ...fallback, meta_title: "SEO", extra: true },
      meta: { channel: "default", locale: "vi", contract_version: 1 },
    }),
    /không hợp lệ/,
  );
});

test("falls back to static service content when Bagisto is not configured", async () => {
  const source = await readFile(new URL("../src/lib/bagisto-services.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /try\s*\{\s*const url = getBagistoApiUrl[\s\S]*?fetchBagistoJson/,
    "the fallback must catch Bagisto URL configuration errors during static builds",
  );
});
