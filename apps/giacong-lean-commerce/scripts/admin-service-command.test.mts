import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAdminServiceArchiveCommand,
  parseAdminServiceCreateCommand,
  parseAdminServiceUpdateCommand,
} from "../src/lib/admin-service-command.ts";

const requestId = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";

const serviceFields = {
  description: "Mô tả dịch vụ",
  imageUrl: null,
  isActive: false,
  leadTimeDays: 14,
  moqSummary: "Từ 500 kg / mẻ",
  name: "Gia công thử nghiệm",
  slug: "gia-cong-thu-nghiem",
  status: "draft" as const,
  summary: "Tóm tắt dịch vụ",
};

test("service create command keeps an exact envelope and normalizes requestId", () => {
  const parsed = parseAdminServiceCreateCommand({ requestId, ...serviceFields });

  assert.equal(parsed.command?.requestId, requestId.toLowerCase());
  assert.deepEqual(parsed.command?.input, serviceFields);
  assert.deepEqual(parsed.fieldErrors, {});
});

test("service create command rejects missing, extra and numeric-string fields", () => {
  assert.equal(parseAdminServiceCreateCommand({ requestId, ...serviceFields, revision: 1 }).command, null);
  assert.equal(parseAdminServiceCreateCommand({ requestId, ...serviceFields, unexpected: true }).command, null);
  assert.equal(parseAdminServiceCreateCommand({ requestId, ...serviceFields, leadTimeDays: "14" }).command, null);
  assert.equal(parseAdminServiceCreateCommand({ requestId: "not-a-uuid", ...serviceFields }).command, null);
});

test("service update command requires a positive integer revision", () => {
  const parsed = parseAdminServiceUpdateCommand({ requestId, revision: 7, ...serviceFields });

  assert.equal(parsed.command?.revision, 7);
  assert.equal(parseAdminServiceUpdateCommand({ requestId, ...serviceFields }).command, null);
  assert.equal(parseAdminServiceUpdateCommand({ requestId, revision: 0, ...serviceFields }).command, null);
  assert.equal(parseAdminServiceUpdateCommand({ requestId, revision: "7", ...serviceFields }).command, null);
});

test("service archive command accepts only requestId and revision", () => {
  const parsed = parseAdminServiceArchiveCommand({ requestId, revision: 3 });

  assert.deepEqual(parsed.command, { requestId: requestId.toLowerCase(), revision: 3 });
  assert.equal(parseAdminServiceArchiveCommand({ requestId, revision: 3, extra: true }).command, null);
  assert.equal(parseAdminServiceArchiveCommand({ requestId, revision: Number.MAX_SAFE_INTEGER + 1 }).command, null);
});
