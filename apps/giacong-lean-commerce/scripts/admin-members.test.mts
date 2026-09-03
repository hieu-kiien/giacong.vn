import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";
import { findAdminMember } from "../src/lib/admin-data.ts";
import { parseAdminMemberPayload } from "../src/lib/admin-members-input.ts";
import { ADMIN_CAPABILITIES, canManage, canManageMembers, canManageNavigation, canManagePages } from "../src/lib/admin-permissions.ts";

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

test("admin capability matrix is explicit for every supported role", () => {
  const expected: Record<string, readonly string[]> = {
    owner: [...ADMIN_CAPABILITIES],
    content_manager: [
      "dashboard.read",
      "catalog.read",
      "content.read",
      "content.write",
      "content.publish",
      "navigation.read",
      "navigation.write",
      "navigation.publish",
      "pages.read",
      "pages.write",
      "pages.publish",
      "media.read",
      "media.write",
      "news.read",
      "news.write",
      "services.read",
      "services.write",
    ],
    catalog_manager: ["dashboard.read", "catalog.read", "catalog.write", "media.read", "media.write"],
    sales_manager: ["dashboard.read", "leads.read", "leads.write"],
    viewer: [
      "dashboard.read",
      "catalog.read",
      "content.read",
      "navigation.read",
      "pages.read",
      "media.read",
      "news.read",
      "services.read",
      "leads.read",
    ],
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
