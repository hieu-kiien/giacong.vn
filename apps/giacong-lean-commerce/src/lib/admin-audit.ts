import "server-only";

import { tableExists, type D1DatabaseLike } from "./admin-data.ts";

export const MAX_ADMIN_AUDIT_PAGE_SIZE = 50;
export const MAX_ADMIN_AUDIT_PAGE = 10_000;
export const MAX_ADMIN_AUDIT_SEARCH_LENGTH = 100;

export const ADMIN_AUDIT_ENTITY_TYPES = [
  "category",
  "lead",
  "media",
  "member",
  "news_post",
  "page",
  "product",
  "service",
  "setting",
  "site_setting",
  "site_navigation",
  "tier_prices",
  "variant",
] as const;

export type AdminAuditEntityType = (typeof ADMIN_AUDIT_ENTITY_TYPES)[number];

export interface AdminAuditQuery {
  entityType?: AdminAuditEntityType;
  page: number;
  pageSize: number;
  search: string;
}

export interface AdminAuditEntry {
  action: string;
  actorSubject: string;
  createdAt: string;
  entityKey: string;
  entityType: string;
  operation: string | null;
  previousRevision: number | null;
  requestId: string | null;
  resultingRevision: number | null;
  source: string;
}

export interface AdminAuditPage {
  entries: AdminAuditEntry[];
  pagination: {
    currentPage: number;
    lastPage: number;
    pageSize: number;
    total: number;
  };
  total: number;
}

export class AdminAuditValidationError extends Error {}
export class AdminAuditStorageError extends Error {}

// Keep the compound tree shallow enough that every nested SELECT has headroom
// for the outer paging/count wrappers. D1's limit is five terms, and the audit
// registry grows over time.
const MAX_D1_COMPOUND_SELECT_TERMS = 4;

interface AdminAuditDbRow {
  action: unknown;
  actor_subject: unknown;
  created_at: unknown;
  entity_key: unknown;
  entity_type: unknown;
  operation: unknown;
  previous_revision: unknown;
  request_id: unknown;
  resulting_revision: unknown;
  source: unknown;
  source_id: unknown;
}

interface AuditSource {
  tableName: string;
  query: string;
}

const auditSources: readonly AuditSource[] = [
  {
    tableName: "audit_logs",
    query: `
      SELECT
        'audit_logs' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        NULL AS operation,
        entity_type,
        COALESCE(entity_id, '') AS entity_key,
        NULL AS request_id,
        NULL AS previous_revision,
        NULL AS resulting_revision,
        created_at
      FROM audit_logs
    `,
  },
  {
    tableName: "admin_audit_log",
    query: `
      SELECT
        'admin_audit_log' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        NULL AS operation,
        entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_audit_log
    `,
  },
  {
    tableName: "admin_member_audit",
    query: `
      SELECT
        'admin_member_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        NULL AS operation,
        'member' AS entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_member_audit
    `,
  },
  {
    tableName: "admin_lead_audit",
    query: `
      SELECT
        'admin_lead_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        NULL AS operation,
        'lead' AS entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_lead_audit
    `,
  },
  {
    tableName: "admin_media_audit",
    query: `
      SELECT
        'admin_media_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        NULL AS operation,
        'media' AS entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_media_audit
    `,
  },
  {
    tableName: "admin_news_audit",
    query: `
      SELECT
        'admin_news_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        operation,
        entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_news_audit
    `,
  },
  {
    tableName: "admin_news_bulk_audit",
    query: `
      SELECT
        'admin_news_bulk_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        operation,
        'news_post' AS entity_type,
        'bulk:' || operation AS entity_key,
        request_id,
        NULL AS previous_revision,
        NULL AS resulting_revision,
        created_at
      FROM admin_news_bulk_audit
    `,
  },
  {
    tableName: "admin_site_setting_audit",
    query: `
      SELECT
        'admin_site_setting_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        operation,
        entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_site_setting_audit
    `,
  },
  {
    tableName: "admin_site_setting_bulk_audit",
    query: `
      SELECT
        'admin_site_setting_bulk_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        operation,
        'site_setting' AS entity_type,
        'bulk:' || operation AS entity_key,
        request_id,
        NULL AS previous_revision,
        NULL AS resulting_revision,
        created_at
      FROM admin_site_setting_bulk_audit
    `,
  },
  {
    tableName: "admin_site_page_audit",
    query: `
      SELECT
        'admin_site_page_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        operation,
        entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_site_page_audit
    `,
  },
  {
    tableName: "admin_navigation_audit",
    query: `
      SELECT
        'admin_navigation_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        operation,
        entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_navigation_audit
    `,
  },
  {
    tableName: "admin_navigation_create_audit",
    query: `
      SELECT
        'admin_navigation_create_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        operation,
        entity_type,
        entity_key,
        request_id,
        previous_revision,
        resulting_revision,
        created_at
      FROM admin_navigation_create_audit
    `,
  },
  {
    tableName: "admin_navigation_bulk_audit",
    query: `
      SELECT
        'admin_navigation_bulk_audit' AS source,
        CAST(id AS TEXT) AS source_id,
        actor_subject,
        action,
        operation,
        'site_navigation' AS entity_type,
        'bulk:' || operation AS entity_key,
        request_id,
        NULL AS previous_revision,
        NULL AS resulting_revision,
        created_at
      FROM admin_navigation_bulk_audit
    `,
  },
];

export function parseAdminAuditQuery(searchParams: Pick<URLSearchParams, "get">): AdminAuditQuery | null {
  const page = parseBoundedInteger(searchParams.get("page"), 1, MAX_ADMIN_AUDIT_PAGE);
  const pageSize = parseBoundedInteger(searchParams.get("pageSize"), 20, MAX_ADMIN_AUDIT_PAGE_SIZE);
  if (page === null || pageSize === null) return null;

  const search = searchParams.get("query")?.trim() ?? "";
  if (search.length > MAX_ADMIN_AUDIT_SEARCH_LENGTH) return null;

  const rawEntityType = searchParams.get("entityType")?.trim() ?? "";
  if (rawEntityType && !isAuditEntityType(rawEntityType)) return null;
  const entityType = rawEntityType ? (rawEntityType as AdminAuditEntityType) : undefined;

  return {
    entityType,
    page,
    pageSize,
    search,
  };
}

export async function listAdminAudit(database: D1DatabaseLike, query: AdminAuditQuery): Promise<AdminAuditPage> {
  assertAuditQuery(query);
  const sources = (await Promise.all(
    auditSources.map(async (source) => (await tableExists(database, source.tableName) ? source : null)),
  )).filter((source): source is AuditSource => source !== null);

  if (sources.length === 0) return emptyAuditPage(query);

  const unionQuery = buildAuditUnionQuery(sources.map((source) => source.query));
  const filter = buildFilter(query);
  const countQuery = "SELECT COUNT(*) AS count FROM (" + unionQuery + ") AS audit_entries" + filter.sql;
  const rowsQuery = [
    "SELECT source, source_id, actor_subject, action, operation, entity_type, entity_key,",
    "       request_id, previous_revision, resulting_revision, created_at",
    "FROM (" + unionQuery + ") AS audit_entries",
    filter.sql,
    "ORDER BY created_at DESC, source ASC, source_id DESC",
    "LIMIT ? OFFSET ?",
  ].join("\n");
  const countStatement = database.prepare(countQuery).bind(...filter.values);
  const rowsStatement = database.prepare(rowsQuery).bind(...filter.values, query.pageSize, (query.page - 1) * query.pageSize);
  const [countRow, rows] = await Promise.all([
    countStatement.first<{ count: unknown }>(),
    rowsStatement.all<AdminAuditDbRow>(),
  ]);

  const total = normalizeCount(countRow?.count);
  const entries = rows.results.map(toAdminAuditEntry);
  return {
    entries,
    pagination: {
      currentPage: query.page,
      lastPage: Math.max(1, Math.ceil(total / query.pageSize)),
      pageSize: query.pageSize,
      total,
    },
    total,
  };
}

function buildAuditUnionQuery(queries: readonly string[]): string {
  if (queries.length <= MAX_D1_COMPOUND_SELECT_TERMS) return queries.join("\nUNION ALL\n");

  const groups: string[] = [];
  for (let index = 0; index < queries.length; index += MAX_D1_COMPOUND_SELECT_TERMS) {
    const group = buildAuditUnionQuery(queries.slice(index, index + MAX_D1_COMPOUND_SELECT_TERMS));
    groups.push(`SELECT * FROM (${group}) AS audit_group`);
  }
  return buildAuditUnionQuery(groups);
}

function assertAuditQuery(query: AdminAuditQuery): void {
  if (!Number.isSafeInteger(query.page) || query.page < 1 || query.page > MAX_ADMIN_AUDIT_PAGE
    || !Number.isSafeInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > MAX_ADMIN_AUDIT_PAGE_SIZE
    || typeof query.search !== "string" || query.search.length > MAX_ADMIN_AUDIT_SEARCH_LENGTH
    || (query.entityType !== undefined && !isAuditEntityType(query.entityType))) {
    throw new AdminAuditValidationError("Bộ lọc lịch sử thay đổi không hợp lệ.");
  }
}

function buildFilter(query: AdminAuditQuery): { sql: string; values: string[] } {
  const clauses: string[] = [];
  const values: string[] = [];
  if (query.search) {
    const pattern = "%" + query.search.toLowerCase() + "%";
    clauses.push("(LOWER(actor_subject) LIKE ? OR LOWER(action) LIKE ? OR LOWER(COALESCE(operation, '')) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(entity_key) LIKE ?)");
    values.push(pattern, pattern, pattern, pattern, pattern);
  }
  if (query.entityType) {
    clauses.push("entity_type = ?");
    values.push(query.entityType);
  }
  return { sql: clauses.length > 0 ? " WHERE " + clauses.join(" AND ") : "", values };
}

function emptyAuditPage(query: AdminAuditQuery): AdminAuditPage {
  return {
    entries: [],
    pagination: { currentPage: query.page, lastPage: 1, pageSize: query.pageSize, total: 0 },
    total: 0,
  };
}

function toAdminAuditEntry(row: AdminAuditDbRow): AdminAuditEntry {
  return {
    action: requiredText(row.action, "action"),
    actorSubject: requiredText(row.actor_subject, "actor_subject"),
    createdAt: requiredText(row.created_at, "created_at"),
    entityKey: requiredText(row.entity_key, "entity_key"),
    entityType: requiredText(row.entity_type, "entity_type"),
    operation: nullableText(row.operation),
    previousRevision: nullableRevision(row.previous_revision),
    requestId: nullableText(row.request_id),
    resultingRevision: nullableRevision(row.resulting_revision),
    source: requiredText(row.source, "source"),
  };
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string") throw new AdminAuditStorageError("Audit field " + field + " không hợp lệ.");
  return value;
}

function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new AdminAuditStorageError("Audit text field không hợp lệ.");
  return value;
}

function nullableRevision(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new AdminAuditStorageError("Audit revision không hợp lệ.");
  }
  return value;
}

function normalizeCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new AdminAuditStorageError("Không đọc được tổng lịch sử thay đổi.");
  return count;
}

function parseBoundedInteger(value: string | null, fallback: number, max: number): number | null {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

function isAuditEntityType(value: string): value is AdminAuditEntityType {
  return (ADMIN_AUDIT_ENTITY_TYPES as readonly string[]).includes(value);
}
