import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminMemberPayload } from "../src/lib/admin-members-input.ts";
import { canManage, canManageMembers, canManageNavigation, canManagePages } from "../src/lib/admin-permissions.ts";

test("member payloads normalize identity fields and role", () => {
  const parsed = parseAdminMemberPayload({
    accessSubject: "  access-subject-1 ",
    displayName: "  Người vận hành  ",
    email: " ADMIN@EXAMPLE.COM ",
    isActive: true,
    role: "content_manager",
  });
  assert.deepEqual(parsed.fieldErrors, {});
  assert.deepEqual(parsed.input, {
    accessSubject: "access-subject-1",
    displayName: "Người vận hành",
    email: "admin@example.com",
    isActive: true,
    role: "content_manager",
  });
});

test("member payloads reject unsafe identity values and unknown roles", () => {
  const parsed = parseAdminMemberPayload({
    accessSubject: "<script>",
    displayName: "",
    email: "not-an-email",
    isActive: "yes",
    role: "administrator",
  });
  assert.equal(parsed.input, null);
  assert.ok(Object.keys(parsed.fieldErrors).length >= 4);
});

test("admin capabilities separate owner, content, catalog, sales and viewer access", () => {
  assert.equal(canManageMembers("owner"), true);
  assert.equal(canManageMembers("content_manager"), false);
  assert.equal(canManagePages("content_manager"), true);
  assert.equal(canManageNavigation("content_manager"), true);
  assert.equal(canManage("catalog_manager", "catalog.write"), true);
  assert.equal(canManage("sales_manager", "leads.write"), true);
  assert.equal(canManage("viewer", "catalog.read"), true);
  assert.equal(canManage("viewer", "members.read"), false);
  assert.equal(canManage("administrator", "pages.write"), false);
});
