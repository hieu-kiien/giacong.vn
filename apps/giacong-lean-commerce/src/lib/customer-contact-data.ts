import "server-only";
import type { D1DatabaseLike } from "./admin-data.ts";
import type { CustomerContactInput } from "./customer-contact-input.ts";

export async function getCustomerContact(database: D1DatabaseLike, customerId: string): Promise<CustomerContactInput | null> {
  const row = await database.prepare("SELECT full_name, phone, company_name FROM customer_contact_profiles WHERE customer_id = ?")
    .bind(customerId).first<{ full_name: string; phone: string; company_name: string }>();
  return row ? { name: row.full_name, phone: row.phone, companyName: row.company_name } : null;
}

export async function saveCustomerContact(database: D1DatabaseLike, customerId: string, input: CustomerContactInput): Promise<void> {
  const now = new Date().toISOString();
  await database.prepare(`INSERT INTO customer_contact_profiles
    (customer_id, full_name, phone, company_name, contact_consent_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET full_name = excluded.full_name, phone = excluded.phone,
      company_name = excluded.company_name, contact_consent_at = excluded.contact_consent_at, updated_at = excluded.updated_at`)
    .bind(customerId, input.name, input.phone, input.companyName, now, now).run();
}
