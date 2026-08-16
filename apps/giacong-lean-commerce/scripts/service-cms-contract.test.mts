import assert from "node:assert/strict";
import test from "node:test";
import { mergeManagedService, parseManagedServiceResponse } from "../src/lib/service-cms-contract.ts";

const payload = {
  data: {
    description: "Mô tả quản trị.",
    meta_title: "Dịch vụ quản trị",
    name: "Sấy theo yêu cầu",
    slug: "say-thuc-pham-say",
    summary: "Tóm tắt quản trị.",
  },
  meta: {
    channel: "web",
    contract_version: 1,
    locale: "vi-VN",
  },
};

test("accepts the exact managed service contract and merges editable copy", () => {
  const managed = parseManagedServiceResponse(payload);
  const fallback = {
    description: "Fallback",
    name: "Fallback name",
    slug: "say-thuc-pham-say",
    summary: "Fallback summary",
  };
  assert.deepEqual(mergeManagedService(fallback, managed), {
    ...fallback,
    description: "Mô tả quản trị.",
    name: "Sấy theo yêu cầu",
    summary: "Tóm tắt quản trị.",
  });
});

test("rejects contract drift instead of silently rendering partial CMS data", () => {
  assert.throws(() => parseManagedServiceResponse({
    ...payload,
    meta: { ...payload.meta, contract_version: 2 },
  }), /không hợp lệ/);
});