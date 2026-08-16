import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { listAdminLeads, type LeadStatus } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const leadStatuses = new Set<LeadStatus>([
  "new",
  "qualified",
  "contacted",
  "quotation_sent",
  "sampling",
  "negotiation",
  "won",
  "lost",
  "spam",
]);

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 20), 100);
  const requestedStatus = url.searchParams.get("status");
  const status = requestedStatus && leadStatuses.has(requestedStatus as LeadStatus)
    ? requestedStatus as LeadStatus
    : undefined;

  try {
    const data = await listAdminLeads(guard.database, { page, pageSize, status });
    return adminSuccess(crypto.randomUUID(), {
      ...data,
      pagination: {
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(data.total / pageSize)),
        pageSize,
        total: data.total,
      },
    });
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Chưa có bảng lead trong D1.",
    );
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}