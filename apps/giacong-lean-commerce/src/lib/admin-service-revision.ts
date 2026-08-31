import type { AdminService, D1DatabaseLike } from "./admin-data.ts";

export interface AdminServiceWithRevision extends AdminService {
  revision: number;
}

export class AdminServiceRevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceRevisionError";
  }
}

export async function attachAdminServiceRevisions(
  database: D1DatabaseLike,
  services: readonly AdminService[],
): Promise<AdminServiceWithRevision[]> {
  if (services.length === 0) return [];
  const ids = services.map((service) => service.id);
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await database.prepare(`
    SELECT id, revision
    FROM services
    WHERE id IN (${placeholders})
  `).bind(...ids).all<{ id: number; revision: number }>();
  const revisions = new Map<number, number>();
  for (const row of rows.results) revisions.set(row.id, requireRevision(row.revision, row.id));

  return services.map((service) => {
    const revision = revisions.get(service.id);
    if (revision === undefined) throw new AdminServiceRevisionError(`Thiếu revision cho dịch vụ #${service.id}.`);
    return { ...service, revision };
  });
}

export async function attachAdminServiceRevision(
  database: D1DatabaseLike,
  service: AdminService,
): Promise<AdminServiceWithRevision> {
  const row = await database.prepare(`
    SELECT revision
    FROM services
    WHERE id = ?
    LIMIT 1
  `).bind(service.id).first<{ revision: number }>();
  if (!row) throw new AdminServiceRevisionError(`Thiếu revision cho dịch vụ #${service.id}.`);
  return { ...service, revision: requireRevision(row.revision, service.id) };
}

function requireRevision(value: unknown, serviceId: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new AdminServiceRevisionError(`Revision không hợp lệ cho dịch vụ #${serviceId}.`);
  }
  return value;
}
