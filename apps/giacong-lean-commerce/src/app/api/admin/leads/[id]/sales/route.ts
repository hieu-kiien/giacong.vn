import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import {
  AdminZaloSaleConflictError,
  AdminZaloSaleStorageError,
  AdminZaloSaleValidationError,
  createAdminZaloSaleAtomically,
  parseAdminZaloSaleCommand,
  readAdminZaloSale,
} from "@/lib/admin-zalo-sale-write.ts";
import { canManage, canManageLeads } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { getZaloSaleDeliveryBindings } from "@/lib/zalo-sale-queue.ts";
import { deliverQueuedZaloSale } from "@/lib/zalo-sale-delivery-worker.ts";

export const dynamic = "force-dynamic";

interface LeadSalesRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: LeadSalesRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "leads.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem giao dịch.");
  }

  const { id } = await context.params;
  if (!isLeadId(id)) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy yêu cầu.");

  try {
    const sale = await readAdminZaloSale(guard.database, id.toLowerCase());
    return adminSuccess(crypto.randomUUID(), { sale });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải giao dịch Zalo.");
  }
}

export async function POST(request: Request, context: LeadSalesRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageLeads(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được ghi nhận giao dịch.");
  }

  const { id } = await context.params;
  if (!isLeadId(id)) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy yêu cầu.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) {
    return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  }

  try {
    const command = parseAdminZaloSaleCommand(parsedRequest.body);
    const createdSale = await createAdminZaloSaleAtomically(guard.database, id.toLowerCase(), guard.actorSubject, command);
    if (createdSale.sheetSync.status !== "delivered") {
      await enqueueOrDeliverSale(createdSale.id, guard.database);
    }
    const sale = await readAdminZaloSale(guard.database, id.toLowerCase()).catch(() => null) ?? createdSale;
    return adminSuccess(parsedRequest.requestId, { sale }, 201);
  } catch (error) {
    if (error instanceof AdminZaloSaleValidationError) {
      return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof AdminZaloSaleConflictError) {
      return adminFailure(parsedRequest.requestId, 409, "STALE_WRITE", error.message);
    }
    if (error instanceof AdminZaloSaleStorageError) {
      return adminErrorFrom(parsedRequest.requestId, error, error.message);
    }
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể ghi nhận giao dịch Zalo.");
  }
}

async function enqueueOrDeliverSale(saleId: string, database: Parameters<typeof deliverQueuedZaloSale>[2]): Promise<void> {
  const bindings = getZaloSaleDeliveryBindings();
  if (bindings.queue) {
    try {
      await bindings.queue.send({ saleId, type: "zalo-sale" });
      return;
    } catch (error) {
      console.error("Zalo sale queue enqueue failed; trying the webhook synchronously.", {
        error: error instanceof Error ? error.message : "unknown_error",
        saleId,
      });
    }
  }

  try {
    await deliverQueuedZaloSale({ saleId }, bindings.environment, database, false);
  } catch {
    // The canonical D1 sale remains saved; the outbox records the failed sheet delivery.
  }
}

function isLeadId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
