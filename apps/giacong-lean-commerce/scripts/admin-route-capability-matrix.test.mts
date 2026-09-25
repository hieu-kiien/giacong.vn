import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type RouteOperation =
  | "read"
  | "owner-read"
  | "create"
  | "update"
  | "delete"
  | "upload"
  | "write"
  | "publish"
  | "batch"
  | "batch-snapshot"
  | "import"
  | "session";

type CapabilityRow = {
  route: string;
  method: HttpMethod;
  operation: RouteOperation;
  kind: "capability";
  guard: "direct" | "helper";
  capability: string;
  helper?: string;
};

type OwnerOnlyRow = {
  route: string;
  method: HttpMethod;
  operation: "owner-read";
  kind: "owner-only";
  guard: "literal" | "helper";
  helper?: string;
};

type SessionRow = {
  route: string;
  method: "GET";
  operation: "session";
  kind: "session";
};

type RouteCapabilityRow = CapabilityRow | OwnerOnlyRow | SessionRow;

const routeRoot = new URL("../src/app/api/admin/", import.meta.url);

function directRead(route: string, capability: string): CapabilityRow {
  return { route, method: "GET", operation: "read", kind: "capability", guard: "direct", capability };
}

function writeGuard(
  route: string,
  method: HttpMethod,
  helper: string,
  capability: string,
  operation: Exclude<RouteOperation, "read" | "owner-read" | "session"> = "write",
): CapabilityRow {
  return { route, method, operation, kind: "capability", guard: "helper", helper, capability };
}

function ownerOnly(route: string, method: HttpMethod, helper: string): OwnerOnlyRow {
  return { route, method, operation: "owner-read", kind: "owner-only", guard: "helper", helper };
}

function ownerLiteral(route: string): OwnerOnlyRow {
  return { route, method: "GET", operation: "owner-read", kind: "owner-only", guard: "literal" };
}

const adminRouteCapabilityMatrix: readonly RouteCapabilityRow[] = [
  ownerLiteral("audit/route.ts"),
  directRead("categories/[id]/route.ts", "catalog.read"),
  writeGuard("categories/[id]/route.ts", "PATCH", "canManageCatalog", "catalog.write", "update"),
  writeGuard("categories/batch/route.ts", "GET", "canManageCatalog", "catalog.write", "batch-snapshot"),
  writeGuard("categories/batch/route.ts", "POST", "canManageCatalog", "catalog.write", "batch"),
  directRead("categories/route.ts", "catalog.read"),
  writeGuard("categories/route.ts", "POST", "canManageCatalog", "catalog.write", "create"),
  directRead("crm/customers/[id]/route.ts", "crm.read"),
  writeGuard("crm/customers/[id]/route.ts", "PATCH", "canManageCrm", "crm.write", "update"),
  writeGuard("crm/customers/[id]/route.ts", "DELETE", "canManageCrm", "crm.write", "delete"),
  directRead("crm/customers/[id]/timeline/route.ts", "crm.read"),
  writeGuard("crm/customers/[id]/timeline/route.ts", "POST", "canManageCrm", "crm.write", "create"),
  directRead("crm/customers/route.ts", "crm.read"),
  writeGuard("crm/customers/route.ts", "POST", "canManageCrm", "crm.write", "create"),
  directRead("dashboard/route.ts", "dashboard.read"),
  writeGuard("leads/[id]/route.ts", "PATCH", "canManageLeads", "leads.write", "update"),
  directRead("leads/route.ts", "leads.read"),
  writeGuard("media/[id]/route.ts", "DELETE", "canManageMedia", "media.write", "delete"),
  writeGuard("media/[id]/route.ts", "PATCH", "canManageMedia", "media.write", "update"),
  writeGuard("media/cleanup/route.ts", "POST", "canManageMedia", "media.write", "write"),
  directRead("media/route.ts", "media.read"),
  writeGuard("media/route.ts", "POST", "canManageMedia", "media.write", "upload"),
  ownerOnly("members/[id]/route.ts", "GET", "canManageMembers"),
  ownerOnly("members/[id]/route.ts", "PATCH", "canManageMembers"),
  ownerOnly("members/route.ts", "GET", "canManageMembers"),
  ownerOnly("members/route.ts", "POST", "canManageMembers"),
  writeGuard("navigation/[id]/publish/route.ts", "POST", "canPublishNavigation", "navigation.publish", "publish"),
  directRead("navigation/[id]/route.ts", "navigation.read"),
  writeGuard("navigation/[id]/route.ts", "PATCH", "canManageNavigation", "navigation.write", "update"),
  writeGuard("navigation/publish-all/route.ts", "POST", "canPublishNavigation", "navigation.publish", "publish"),
  directRead("navigation/route.ts", "navigation.read"),
  writeGuard("navigation/route.ts", "POST", "canManageNavigation", "navigation.write", "create"),
  // admin-permissions.ts exposes no news.publish capability; publish is a news write.
  writeGuard("news/[id]/publish/route.ts", "POST", "canManageNews", "news.write", "publish"),
  directRead("news/[id]/route.ts", "news.read"),
  writeGuard("news/[id]/route.ts", "PATCH", "canManageNews", "news.write", "update"),
  writeGuard("news/[id]/route.ts", "DELETE", "canManageNews", "news.write", "delete"),
  writeGuard("news/batch/route.ts", "POST", "canManageNews", "news.write", "batch"),
  directRead("news/route.ts", "news.read"),
  writeGuard("news/route.ts", "POST", "canManageNews", "news.write", "create"),
  writeGuard("pages/[pageKey]/publish/route.ts", "POST", "canPublishPages", "pages.publish", "publish"),
  directRead("pages/[pageKey]/route.ts", "pages.read"),
  writeGuard("pages/[pageKey]/route.ts", "PATCH", "canManagePages", "pages.write", "update"),
  directRead("pages/route.ts", "pages.read"),
  writeGuard("pages/route.ts", "POST", "canManagePages", "pages.write", "create"),
  directRead("products/[id]/gallery/route.ts", "catalog.read"),
  writeGuard("products/[id]/gallery/route.ts", "POST", "canManageCatalog", "catalog.write", "update"),
  directRead("products/[id]/route.ts", "catalog.read"),
  writeGuard("products/[id]/route.ts", "PATCH", "canManageCatalog", "catalog.write", "update"),
  writeGuard("products/[id]/route.ts", "DELETE", "canManageCatalog", "catalog.write", "delete"),
  directRead("products/[id]/specs/route.ts", "catalog.read"),
  writeGuard("products/[id]/specs/route.ts", "POST", "canManageCatalog", "catalog.write", "update"),
  directRead("products/[id]/variants/[variantId]/route.ts", "catalog.read"),
  writeGuard("products/[id]/variants/[variantId]/route.ts", "PATCH", "canManageCatalog", "catalog.write", "update"),
  writeGuard("products/[id]/variants/[variantId]/route.ts", "DELETE", "canManageCatalog", "catalog.write", "delete"),
  directRead("products/[id]/variants/route.ts", "catalog.read"),
  writeGuard("products/[id]/variants/route.ts", "POST", "canManageCatalog", "catalog.write", "create"),
  writeGuard("products/batch/route.ts", "GET", "canManageCatalog", "catalog.write", "batch-snapshot"),
  writeGuard("products/batch/route.ts", "POST", "canManageCatalog", "catalog.write", "batch"),
  writeGuard("products/import/route.ts", "POST", "canManageCatalog", "catalog.write", "import"),
  directRead("products/route.ts", "catalog.read"),
  writeGuard("products/route.ts", "POST", "canManageCatalog", "catalog.write", "create"),
  directRead("services/[id]/route.ts", "services.read"),
  writeGuard("services/[id]/route.ts", "PATCH", "canManageServices", "services.write", "update"),
  writeGuard("services/[id]/route.ts", "DELETE", "canManageServices", "services.write", "delete"),
  writeGuard("services/batch/route.ts", "GET", "canManageServices", "services.write", "batch-snapshot"),
  writeGuard("services/batch/route.ts", "POST", "canManageServices", "services.write", "batch"),
  directRead("services/route.ts", "services.read"),
  writeGuard("services/route.ts", "POST", "canManageServices", "services.write", "create"),
  { route: "session/route.ts", method: "GET", operation: "session", kind: "session" },
  writeGuard("site-settings/media/route.ts", "POST", "canManageSiteContent", "content.write", "upload"),
  writeGuard("site-settings/publish-all/route.ts", "POST", "canPublishSiteContent", "content.publish", "publish"),
  writeGuard("site-settings/publish/route.ts", "POST", "canPublishSiteContent", "content.publish", "publish"),
  directRead("site-settings/route.ts", "content.read"),
  writeGuard("site-settings/route.ts", "PATCH", "canManageSiteContent", "content.write", "update"),
];

const permissionHelperCapabilities = [
  ["canManageCatalog", "catalog.write"],
  ["canManageCrm", "crm.write"],
  ["canManageLeads", "leads.write"],
  ["canManageMedia", "media.write"],
  ["canManageMembers", "members.write"],
  ["canManageNews", "news.write"],
  ["canManageNavigation", "navigation.write"],
  ["canManagePages", "pages.write"],
  ["canManageServices", "services.write"],
  ["canManageSiteContent", "content.write"],
  ["canPublishSiteContent", "content.publish"],
  ["canPublishNavigation", "navigation.publish"],
  ["canPublishPages", "pages.publish"],
] as const;

type DiscoveredHandler = { route: string; method: HttpMethod; source: string };

async function listRouteFiles(directory: URL, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await listRouteFiles(new URL(`${entry.name}/`, directory), `${relative}/`));
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(relative);
    }
  }
  return files.sort();
}

function parseHandlers(source: string): Array<{ method: HttpMethod; source: string }> {
  const matches = [...source.matchAll(/export\s+async\s+function\s+([A-Z]+)\s*\(/g)];
  return matches.map((match, index) => {
    const method = match[1];
    assert.ok(["GET", "POST", "PATCH", "DELETE"].includes(method), `unsupported admin HTTP method: ${method}`);
    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? source.length;
    return { method: method as HttpMethod, source: source.slice(start, nextStart) };
  });
}

async function discoverAdminHandlers(): Promise<{ routeFiles: string[]; handlers: DiscoveredHandler[]; sources: Map<string, string> }> {
  const routeFiles = await listRouteFiles(routeRoot);
  const sources = new Map<string, string>();
  const handlers: DiscoveredHandler[] = [];
  for (const route of routeFiles) {
    const source = await readFile(new URL(route, routeRoot), "utf8");
    sources.set(route, source);
    for (const handler of parseHandlers(source)) handlers.push({ route, ...handler });
  }
  return { routeFiles, handlers, sources };
}

function rowKey(row: { route: string; method: string }): string {
  return `${row.route}::${row.method}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capabilityGuardPattern(row: CapabilityRow): RegExp {
  const role = "guard\\.member\\.role";
  if (row.guard === "direct") {
    return new RegExp(`if\\s*\\(\\s*!\\s*canManage\\s*\\(\\s*${role}\\s*,\\s*[\"']${escapeRegExp(row.capability)}[\"']\\s*\\)\\s*\\)`);
  }
  return new RegExp(`if\\s*\\(\\s*!\\s*${escapeRegExp(row.helper ?? "")}\\s*\\(\\s*${role}\\s*\\)\\s*\\)`);
}

function ownerLiteralPattern(): RegExp {
  return /if\s*\(\s*guard\.member\.role\s*!==\s*["']owner["']\s*\)/;
}

function ownerHelperPattern(helper: string): RegExp {
  return new RegExp(`if\\s*\\(\\s*!\\s*${escapeRegExp(helper)}\\s*\\(\\s*guard\\.member\\.role\\s*\\)\\s*\\)`);
}

test("admin capability matrix covers every discovered route handler exactly once", async () => {
  const discovered = await discoverAdminHandlers();
  const expectedRouteFiles = [...new Set(adminRouteCapabilityMatrix.map((row) => row.route))].sort();
  const actualKeys = discovered.handlers.map(rowKey).sort();
  const expectedKeys = adminRouteCapabilityMatrix.map(rowKey).sort();

  assert.deepEqual(expectedRouteFiles, discovered.routeFiles, "matrix must be built from every real admin route file");
  assert.equal(new Set(expectedKeys).size, expectedKeys.length, "matrix rows must be unique");
  assert.deepEqual(expectedKeys, actualKeys, "matrix must cover every exported admin route handler");
});

test("admin route handlers enforce the matrix-declared read/write/publish/owner guard", async () => {
  const discovered = await discoverAdminHandlers();
  const actual = new Map(discovered.handlers.map((handler) => [rowKey(handler), handler.source]));

  for (const row of adminRouteCapabilityMatrix) {
    const handler = actual.get(rowKey(row));
    assert.ok(handler, `${row.route} ${row.method} must be discoverable`);

    if (row.kind === "session") {
      assert.match(handler, /handleAdminSession\(request\s*,\s*\{/,
        `${row.route} GET must use the session admission boundary`);
      continue;
    }

    assert.match(handler, /const guard\s*=\s*await requireAdmin\(request\)/,
      `${row.route} ${row.method} must authenticate with requireAdmin`);
    assert.match(handler, /if\s*\(guard\s+instanceof\s+Response\)\s*return guard/,
      `${row.route} ${row.method} must fail closed when admin admission fails`);

    if (row.kind === "capability") {
      assert.match(handler, capabilityGuardPattern(row),
        `${row.route} ${row.method} must enforce ${row.capability} via ${row.guard === "direct" ? "canManage" : row.helper}`);
    } else if (row.guard === "literal") {
      assert.match(handler, ownerLiteralPattern(), `${row.route} ${row.method} must remain literal owner-only`);
    } else {
      assert.match(handler, ownerHelperPattern(row.helper ?? ""),
        `${row.route} ${row.method} must remain owner-only through ${row.helper}`);
    }
  }
});

test("permission helpers used by the route matrix map to canonical capabilities", async () => {
  const source = await readFile(new URL("../src/lib/admin-permissions.ts", import.meta.url), "utf8");

  for (const [helper, capability] of permissionHelperCapabilities) {
    assert.match(
      source,
      new RegExp(`export function ${escapeRegExp(helper)}\\([\\s\\S]*?return canManage\\(role, [\"']${escapeRegExp(capability)}[\"']\\);`),
      `${helper} must delegate to ${capability}`,
    );
  }
});
