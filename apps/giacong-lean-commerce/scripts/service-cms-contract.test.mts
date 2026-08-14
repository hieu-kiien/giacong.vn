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

test("validates and merges managed CMS copy without replacing service navigation", () => {
  const managed = parseManagedServiceResponse({
    data: {
      slug: "say-thuc-pham-say",
      name: "Tên quản trị",
      summary: "Tóm tắt quản trị",
      description: "Mô tả quản trị",
      meta_title: "SEO quản trị",
    },
    meta: { channel: "default", locale: "vi", contract_version: 1 },
  });

  assert.deepEqual(mergeManagedService(fallback, managed), {
    ...fallback,
    name: "Tên quản trị",
    summary: "Tóm tắt quản trị",
    description: "Mô tả quản trị",
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

test("D1 managed services fall back to static content when bindings are unavailable", async () => {
  const source = await readFile(new URL("../src/lib/cloudflare-services.ts", import.meta.url), "utf8");

  assert.match(source, /getCloudflareContext/);
  assert.match(source, /GIACONG_VN_CATALOG/);
  assert.match(source, /catch\s*\{\s*return fallback;/);
  assert.doesNotMatch(source, /Bagisto|BAGISTO_/);
});
