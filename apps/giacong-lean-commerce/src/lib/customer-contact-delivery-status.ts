import type { CustomerContactDeliveryDatabase } from "./customer-contact-delivery.ts";
export interface CustomerContactDeliveryStatus {
  sheet: "pending" | "delivered" | "not_required";
  email: "pending" | "delivered" | "not_required";
  failed: boolean;
  reviewRequired: boolean;
}
export async function readCustomerContactDeliveryStatus(database: CustomerContactDeliveryDatabase, customerId: string): Promise<CustomerContactDeliveryStatus> {
  const table = await database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'customer_contact_delivery'").first();
  if (!table) return { sheet: "not_required", email: "not_required", failed: false, reviewRequired: false };
  const row = await database.prepare("SELECT revision,sheet_revision,email_status,last_error FROM customer_contact_delivery WHERE customer_id = ?").bind(customerId).first<{ revision: number; sheet_revision: number; email_status: "pending" | "delivered" | "not_required"; last_error: string | null }>();
  return row ? { sheet: row.sheet_revision >= row.revision ? "delivered" : "pending", email: row.email_status, failed: Boolean(row.last_error), reviewRequired: row.last_error?.includes("requires_delivery_review") ?? false } : { sheet: "not_required", email: "not_required", failed: false, reviewRequired: false };
}
