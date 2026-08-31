import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  adminJsonBodyLimit,
  hasOnlyKeys,
  isAdminRequestId,
  readBoundedAdminJson,
} from "../src/lib/admin-request.ts";

test("admin JSON parser rejects a non-JSON content type before reading the body", async () => {
  const result = await readBoundedAdminJson(new Request("https://admin-staging.kienhieu.id.vn/api/admin/site-settings", {
    method: "PATCH",
    headers: { "content-type": "text/plain" },
    body: "{}",
  }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 415);
    assert.equal(result.code, "UNSUPPORTED_MEDIA");
  }
});

test("admin JSON parser enforces the byte limit before JSON parsing", async () => {
  const result = await readBoundedAdminJson(new Request("https://admin-staging.kienhieu.id.vn/api/admin/site-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "x".repeat(adminJsonBodyLimit + 1),
  }));

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
});

test("admin JSON parser reports malformed JSON and accepts JSON charset parameters", async () => {
  const malformed = await readBoundedAdminJson(new Request("https://admin-staging.kienhieu.id.vn/api/admin/site-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.status, 400);

  const valid = await readBoundedAdminJson(new Request("https://admin-staging.kienhieu.id.vn/api/admin/site-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ok: true }),
  }));
  assert.deepEqual(valid.ok ? valid.body : null, { ok: true });
});

test("admin request IDs are UUIDs and request bodies can be exact-key checked", () => {
  assert.equal(isAdminRequestId("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isAdminRequestId("not-a-request-id"), false);
  assert.equal(hasOnlyKeys({ requestId: "id", key: "brand_name" }, ["requestId", "key"]), true);
  assert.equal(hasOnlyKeys({ requestId: "id", unexpected: true }, ["requestId", "key"]), false);
});

test("page and navigation admin JSON writes use the bounded request parser", async () => {
  const routeFiles = [
    "../src/app/api/admin/navigation/route.ts",
    "../src/app/api/admin/navigation/[id]/route.ts",
    "../src/app/api/admin/navigation/[id]/publish/route.ts",
    "../src/app/api/admin/pages/route.ts",
    "../src/app/api/admin/pages/[pageKey]/route.ts",
    "../src/app/api/admin/pages/[pageKey]/publish/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(source, /readBoundedAdminJson/, routeFile);
    assert.doesNotMatch(source, /request\.json\(\)/, routeFile);
  }
});

test("member, lead, service and media JSON writes use the bounded request parser", async () => {
  const routeFiles = [
    "../src/app/api/admin/members/route.ts",
    "../src/app/api/admin/members/[id]/route.ts",
    "../src/app/api/admin/leads/[id]/route.ts",
    "../src/app/api/admin/media/[id]/route.ts",
    "../src/app/api/admin/media/cleanup/route.ts",
    "../src/app/api/admin/services/route.ts",
    "../src/app/api/admin/services/[id]/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(source, /readBoundedAdminJson/, routeFile);
    assert.doesNotMatch(source, /request\.json\(\)/, routeFile);
  }
});

test("operational collection reads enforce their declared read capabilities", async () => {
  const expectations = [
    ["../src/app/api/admin/services/route.ts", /canManage\(guard\.member\.role, "services\.read"\)/],
    ["../src/app/api/admin/services/[id]/route.ts", /canManage\(guard\.member\.role, "services\.read"\)/],
    ["../src/app/api/admin/leads/route.ts", /canManage\(guard\.member\.role, "leads\.read"\)/],
    ["../src/app/api/admin/media/route.ts", /canManage\(guard\.member\.role, "media\.read"\)/],
  ] as const;

  for (const [routeFile, capability] of expectations) {
    const source = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(source, capability, routeFile);
  }
});

test("operational mutation errors keep the bounded parser request ID", async () => {
  const expectations = [
    ["../src/app/api/admin/services/route.ts", /adminErrorFrom\(parsedRequest\.requestId/],
    ["../src/app/api/admin/services/[id]/route.ts", /adminErrorFrom\(parsedRequest\.requestId/],
    ["../src/app/api/admin/members/[id]/route.ts", /memberFailure\(error, "Không thể cập nhật thành viên\.", parsedRequest\.requestId\)/],
    ["../src/app/api/admin/leads/[id]/route.ts", /adminFailure\(parsedRequest\.requestId, 404/],
    ["../src/app/api/admin/leads/[id]/route.ts", /adminErrorFrom\(parsedRequest\.requestId/],
    ["../src/app/api/admin/media/route.ts", /adminErrorFrom\(requestId/],
    ["../src/app/api/admin/media/cleanup/route.ts", /adminErrorFrom\(parsedRequest\.requestId/],
  ] as const;

  for (const [routeFile, pattern] of expectations) {
    const source = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(source, pattern, routeFile);
  }
});

test("member and media JSON mutations reject unknown fields", async () => {
  const expectations = [
    ["../src/app/api/admin/members/route.ts", /hasOnlyKeys/],
    ["../src/app/api/admin/members/[id]/route.ts", /hasOnlyKeys/],
    ["../src/app/api/admin/media/[id]/route.ts", /hasOnlyKeys\(body, \["altText"\]\)/],
  ] as const;

  for (const [routeFile, pattern] of expectations) {
    const source = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(source, pattern, routeFile);
  }
});

test("operational malformed bodies use INVALID_REQUEST and preserve field bounds", async () => {
  const [memberDetail, mediaDetail] = await Promise.all([
    readFile(new URL("../src/app/api/admin/members/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/media/[id]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(memberDetail, /body\.expectedRevision < 1/);
  assert.match(memberDetail, /adminFailure\(parsedRequest\.requestId, 400, "INVALID_REQUEST"/);
  assert.match(mediaDetail, /adminFailure\(parsedRequest\.requestId, 400, "INVALID_REQUEST"/);
  assert.match(mediaDetail, /rawAltText\.trim\(\)\.length > 300/);
  assert.doesNotMatch(mediaDetail, /slice\(0, 300\)/);
});

test("product and variant JSON writes use the bounded request parser", async () => {
  const routeFiles = [
    "../src/app/api/admin/products/route.ts",
    "../src/app/api/admin/products/[id]/route.ts",
    "../src/app/api/admin/products/[id]/variants/route.ts",
    "../src/app/api/admin/products/[id]/variants/[variantId]/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = await readFile(new URL(routeFile, import.meta.url), "utf8");
    assert.match(source, /readBoundedAdminJson/, routeFile);
    assert.doesNotMatch(source, /request\.json\(\)/, routeFile);
  }
});

test("admin collection read models enforce an explicit hard bound", async () => {
  const sources = [
    "../src/lib/admin-data.ts",
    "../src/lib/admin-members.ts",
    "../src/lib/site-pages.ts",
    "../src/lib/site-navigation.ts",
    "../src/lib/site-settings.ts",
    "../src/lib/media-data.ts",
  ];

  for (const sourceFile of sources) {
    const source = await readFile(new URL(sourceFile, import.meta.url), "utf8");
    assert.match(source, /LIMIT 100/, sourceFile);
  }
});
