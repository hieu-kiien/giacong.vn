import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";
import { findAdminMember } from "../src/lib/admin-data.ts";
import { parseAdminMemberCreatePayload, parseAdminMemberPayload } from "../src/lib/admin-members-input.ts";
import { ADMIN_CAPABILITIES, canManage, canManageMembers, canManageNavigation, canManagePages } from "../src/lib/admin-permissions.ts";

test("single admin role rejects retired permissions and member payloads", () => {
  for (const role of ["content_manager", "catalog_manager", "sales_manager", "viewer"]) {
    for (const capability of ADMIN_CAPABILITIES) assert.equal(canManage(role, capability), false, `${role}: ${capability}`);
    const parsed = parseAdminMemberPayload({ accessSubject: "retired-actor", displayName: "Retired", email: "retired@example.test", role, isActive: true });
    assert.equal(parsed.input, null);
    assert.ok(parsed.fieldErrors.role);
  }
  for (const capability of ADMIN_CAPABILITIES) assert.equal(canManage("owner", capability), true);
});

test("single admin admission rejects retired exact and email matches without promoting them", async () => {
  for (const role of ["content_manager", "catalog_manager", "sales_manager", "viewer"] as const) {
    const retired: LookupRow = {id:"retired", access_subject:"retired-subject", email:"retired@example.test", display_name:"Retired",role};
    const owner: LookupRow = {...retired,id:"owner",access_subject:"owner-subject",role:"owner"};
    assert.equal(await findAdminMember(new LookupDatabase(retired, [owner]), "retired-subject", retired.email!), null);
    assert.equal(await findAdminMember(new LookupDatabase(null, [retired]), "unknown-subject", retired.email!), null);
  }
});

interface LookupRow {
  access_subject: string;
  display_name: string;
  email: string | null;
  id: string;
  role: "catalog_manager" | "content_manager" | "owner" | "sales_manager" | "viewer";
}

class LookupStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];
  private readonly rows: LookupRow[];

  constructor(rows: LookupRow[]) {
    this.rows = rows;
  }

  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    void this.values;
    return { results: this.rows as T[] };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    void this.values;
    return (this.rows[0] as T | undefined) ?? null;
  }

  async run(): Promise<unknown> {
    return { meta: { changes: 1 } };
  }
}

class LookupDatabase implements D1DatabaseLike {
  readonly queries: string[] = [];
  private readonly exactRow: LookupRow | null;
  private readonly emailRows: LookupRow[];

  constructor(exactRow: LookupRow | null, emailRows: LookupRow[]) {
    this.exactRow = exactRow;
    this.emailRows = emailRows;
  }

  prepare(query: string): D1PreparedStatementLike {
    this.queries.push(query);
    return new LookupStatement(query.includes("access_subject = ?") ? (this.exactRow ? [this.exactRow] : []) : this.emailRows);
  }
}

test("member payloads normalize identity fields and role", () => {
  const parsed = parseAdminMemberPayload({
    accessSubject: "  access-subject-1 ",
    displayName: "  Người vận hành  ",
    email: " ADMIN@EXAMPLE.COM ",
    isActive: true,
    role: "owner",
  });
  assert.deepEqual(parsed.fieldErrors, {});
  assert.deepEqual(parsed.input, {
    accessSubject: "access-subject-1",
    displayName: "Người vận hành",
    email: "admin@example.com",
    isActive: true,
    role: "owner",
  });
});

test("member creation needs only verified-email identity fields", () => {
  const parsed = parseAdminMemberCreatePayload({
    displayName: "  Người mới  ",
    email: " NEW.ADMIN@EXAMPLE.COM ",
    isActive: true,
  });
  assert.deepEqual(parsed.fieldErrors, {});
  assert.deepEqual(parsed.input, {
    accessSubject: "pending-email:new.admin@example.com",
    displayName: "Người mới",
    email: "new.admin@example.com",
    isActive: true,
    role: "owner",
  });

  const missingEmail = parseAdminMemberCreatePayload({
    displayName: "Người mới",
    email: "",
    isActive: true,
  });
  assert.equal(missingEmail.input, null);
  assert.ok(missingEmail.fieldErrors.email);
});

test("first verified-email login binds a pending Access subject", async () => {
  const pending: LookupRow = {
    access_subject: "pending-email:new.admin@example.com",
    display_name: "Người mới",
    email: "new.admin@example.com",
    id: "owner-pending",
    role: "owner",
  };
  const database = new LookupDatabase(null, [pending]);
  const member = await findAdminMember(database, "cloudflare-sub-123", "NEW.ADMIN@EXAMPLE.COM");
  assert.deepEqual(member, {
    accessSubject: "cloudflare-sub-123",
    displayName: "Người mới",
    email: "new.admin@example.com",
    id: "owner-pending",
    role: "owner",
  });
  assert.ok(database.queries.some((query) => /UPDATE admin_members/.test(query)));
});

test("admin account UI hides accessSubject and exposes Cloudflare logout", async () => {
  const [manager, shell] = await Promise.all([
    readFile(new URL("../src/components/admin/AdminMembersManager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminShell.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(manager, /member-new-subject/);
  assert.match(manager, /Email đăng nhập/);
  assert.match(manager, /newMember\.email\.trim\(\)/);
  assert.match(shell, /\/cdn-cgi\/access\/logout/);
  assert.match(shell, /link-admin-logout/);
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

test("admin capabilities admit only the full administrator", () => {
  assert.equal(canManageMembers("owner"), true);
  assert.equal(canManageMembers("content_manager"), false);
  assert.equal(canManagePages("content_manager"), false);
  assert.equal(canManageNavigation("content_manager"), false);
  assert.equal(canManage("catalog_manager", "catalog.write"), false);
  assert.equal(canManage("sales_manager", "leads.write"), false);
  assert.equal(canManage("viewer", "catalog.read"), false);
  assert.equal(canManage("viewer", "members.read"), false);
  assert.equal(canManage("administrator", "pages.write"), false);
});

test("admin capability matrix is explicit for every supported role", () => {
  const expected: Record<string, readonly string[]> = {
    owner: [...ADMIN_CAPABILITIES],
    content_manager: [],
    catalog_manager: [],
    sales_manager: [],
    viewer: [],
  };

  for (const [role, capabilities] of Object.entries(expected)) {
    for (const capability of ADMIN_CAPABILITIES) {
      assert.equal(
        canManage(role, capability),
        capabilities.includes(capability),
        `${role} ${capability}`,
      );
    }
  }
});

test("Access subject wins over a different member email and duplicate email matches fail closed", async () => {
  const owner: LookupRow = {
    access_subject: "access-owner",
    display_name: "Chủ sở hữu",
    email: "shared@example.com",
    id: "owner-1",
    role: "owner",
  };
  const viewer: LookupRow = {
    access_subject: "access-viewer",
    display_name: "Người xem",
    email: "operator@example.com",
    id: "viewer-1",
    role: "viewer",
  };
  const exactFirst = new LookupDatabase(owner, [viewer]);
  const exactMember = await findAdminMember(exactFirst, "access-owner", "operator@example.com");
  assert.deepEqual(exactMember, {
    accessSubject: "access-owner",
    displayName: "Chủ sở hữu",
    email: "shared@example.com",
    id: "owner-1",
    role: "owner",
  });
  assert.match(exactFirst.queries[0], /WHERE is_active = 1\s+AND access_subject = \?/);

  const duplicateEmail = new LookupDatabase(null, [owner, viewer]);
  assert.equal(await findAdminMember(duplicateEmail, "unknown-subject", "shared@example.com"), null);
});

test("admin role validation fails closed for inherited object keys", () => {
  assert.equal(canManage("constructor", "catalog.write"), false);
  assert.equal(canManage("toString", "catalog.write"), false);
});

test("admin collection and detail reads enforce their read capability server-side", async () => {
  const routes = [
    ["dashboard/route.ts", "dashboard.read"],
    ["products/route.ts", "catalog.read"],
    ["products/[id]/route.ts", "catalog.read"],
    ["products/[id]/variants/route.ts", "catalog.read"],
    ["products/[id]/variants/[variantId]/route.ts", "catalog.read"],
    ["navigation/route.ts", "navigation.read"],
    ["navigation/[id]/route.ts", "navigation.read"],
    ["pages/route.ts", "pages.read"],
    ["pages/[pageKey]/route.ts", "pages.read"],
    ["news/route.ts", "news.read"],
    ["news/[id]/route.ts", "news.read"],
    ["site-settings/route.ts", "content.read"],
  ] as const;

  for (const [route, capability] of routes) {
    const source = await readFile(new URL("../src/app/api/admin/" + route, import.meta.url), "utf8");
    const start = source.indexOf("export async function GET");
    assert.notEqual(start, -1, route + " must expose GET");
    const nextHandler = source.indexOf("\nexport async function", start + 1);
    const getHandler = source.slice(start, nextHandler === -1 ? undefined : nextHandler);
    assert.match(
      getHandler,
      new RegExp("canManage\\(guard\\.member\\.role, [\"']" + capability.replace(".", "\\.") + "[\"']\\)"),
      route + " GET must enforce " + capability,
    );
  }
});

test("admin guard returns a safe internal error instead of leaking runtime details", async () => {
  const source = await readFile(new URL("../src/lib/admin-guard.ts", import.meta.url), "utf8");

  assert.match(source, /Không thể xác minh quyền admin lúc này/);
  assert.doesNotMatch(source, /error instanceof Error[\s\S]*error\.message/);
});
