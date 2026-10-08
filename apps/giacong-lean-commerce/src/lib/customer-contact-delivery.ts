/** D1 remains canonical; each sink acknowledges independently. Queue bodies contain only an account ID. */
export interface CustomerContactDeliveryDatabase {
  prepare(sql: string): {
    bind(...values: unknown[]): ReturnType<CustomerContactDeliveryDatabase["prepare"]>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run(): Promise<unknown>;
  };
}
export interface CustomerContactDeliveryEnvironment {
  GOOGLE_SHEETS_WEBHOOK_URL?: string;
  GOOGLE_SHEETS_WEBHOOK_SECRET?: string;
  CUSTOMER_NOTIFICATION_FROM?: string;
  CUSTOMER_NOTIFICATION_TO?: string;
  RESEND_API_KEY?: string;
}
interface ContactSnapshot { name: string; phone: string; companyName: string; email: string }
interface DeliveryRow extends ContactSnapshot {
  revision: number; sheet_revision: number; email_status: string; email_payload_json: string;
  email_started_at: number | null; updated_at: string;
}
export interface CustomerContactDeliveryMessage { type: "customer-contact"; customerId: string }

const GOOGLE_HOSTS = new Set(["script.google.com", "script.googleusercontent.com"]);
function googleUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !GOOGLE_HOSTS.has(url.hostname) || url.username || url.password || url.port) throw new Error("contact_sheet_url_invalid");
  return url;
}
async function sendSheet(customerId: string, row: DeliveryRow, env: CustomerContactDeliveryEnvironment, fetcher: typeof fetch) {
  if (!env.GOOGLE_SHEETS_WEBHOOK_URL || !env.GOOGLE_SHEETS_WEBHOOK_SECRET) throw new Error("contact_sheet_not_configured");
  let url = googleUrl(env.GOOGLE_SHEETS_WEBHOOK_URL);
  let init: RequestInit = { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ event: "customer.contact.updated", customer_id: customerId, revision: row.revision, updated_at: row.updated_at, name: row.name, phone: row.phone, company_name: row.companyName, email: row.email, secret: env.GOOGLE_SHEETS_WEBHOOK_SECRET }) };
  const signal = AbortSignal.timeout(15000);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetcher(url.toString(), { ...init, redirect: "manual", signal });
    if ([301,302,303].includes(response.status)) {
      if (redirects === 3) throw new Error("contact_sheet_redirect_limit");
      url = googleUrl(new URL(response.headers.get("location") ?? "", url).toString());
      // Google ContentService redirects return the result; never forward the signed POST body.
      init = { method: "GET", headers: { Accept: "application/json" } }; continue;
    }
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("contact_sheet_delivery_failed");
    const ack: unknown = await response.json();
    if (!ack || typeof ack !== "object" || !("ok" in ack) || ack.ok !== true || !("customer_id" in ack) || ack.customer_id !== customerId || !("revision" in ack) || ack.revision !== row.revision) throw new Error("contact_sheet_ack_invalid");
    return;
  }
}
async function sendNotification(customerId: string, row: DeliveryRow, env: CustomerContactDeliveryEnvironment, database: CustomerContactDeliveryDatabase, fetcher: typeof fetch) {
  const to = env.CUSTOMER_NOTIFICATION_TO?.trim(); const from = env.CUSTOMER_NOTIFICATION_FROM?.trim();
  if (!env.RESEND_API_KEY || !from || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || /[\r\n]/.test(from)) throw new Error("contact_email_not_configured");
  // Provider deduplication expires after 24 hours. Stop ambiguous late retries for operator review.
  if (row.email_started_at && Date.now() - row.email_started_at >= 23 * 3600000) throw new Error("contact_email_requires_delivery_review");
  // Freeze the newest data atomically on the first send; later retries must retain the same provider body.
  const frozen = await database.prepare("UPDATE customer_contact_delivery SET email_started_at = COALESCE(email_started_at, ?) WHERE customer_id = ? RETURNING email_payload_json").bind(Date.now(), customerId).first<{ email_payload_json: string }>();
  if (!frozen) throw new Error("contact_delivery_missing");
  const contact = JSON.parse(frozen.email_payload_json) as ContactSnapshot;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(customerId));
  const key = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2,"0")).join("");
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `customer-contact/${key}` },
    body: JSON.stringify({ from, to: [to], subject: "Kienhieu — Khách hàng mới để liên hệ", text: `Khách đã hoàn thiện thông tin liên hệ.\nHọ tên: ${contact.name}\nĐiện thoại: ${contact.phone}\nEmail: ${contact.email}\nCông ty: ${contact.companyName || "Chưa cung cấp"}\n\nThông tin tại thời điểm bắt đầu gửi thông báo. Xem mục Khách hàng trong quản trị để lấy thông tin cập nhật trước khi liên hệ. Đây là thông tin liên hệ, chưa phải giao dịch đã chốt.` }),
  });
  if (!response.ok) throw new Error("contact_email_delivery_failed");
  const ack: unknown = await response.json();
  if (!ack || typeof ack !== "object" || !("id" in ack) || typeof ack.id !== "string" || !ack.id) throw new Error("contact_email_ack_invalid");
}
export async function deliverCustomerContact(customerId: string, env: CustomerContactDeliveryEnvironment, database: CustomerContactDeliveryDatabase, fetcher: typeof fetch = fetch): Promise<void> {
  if (!customerId || customerId.length > 128) throw new Error("contact_customer_id_invalid");
  const customer = await database.prepare('SELECT "emailVerified" FROM "user" WHERE id = ?').bind(customerId).first<{ emailVerified: number | boolean }>();
  if (customer?.emailVerified !== 1 && customer?.emailVerified !== true) return;
  const token = crypto.randomUUID();
  const claimed = await database.prepare("UPDATE customer_contact_delivery SET lease_token = ?, lease_until = ? WHERE customer_id = ? AND (lease_until IS NULL OR lease_until < ?) RETURNING customer_id").bind(token, Date.now() + 90000, customerId, Date.now()).first();
  if (!claimed) {
    const existing = await database.prepare("SELECT customer_id FROM customer_contact_delivery WHERE customer_id = ?").bind(customerId).first();
    if (existing) throw new Error("contact_delivery_busy");
    return; // Existing profiles without a changed contact have no delivery event.
  }
  const failures: string[] = [];
  try {
    const row = await database.prepare('SELECT d.*,p.full_name AS name,p.phone,p.company_name AS companyName,u.email,p.updated_at FROM customer_contact_delivery d JOIN customer_contact_profiles p ON p.customer_id = d.customer_id JOIN "user" u ON u.id = d.customer_id WHERE d.customer_id = ?').bind(customerId).first<DeliveryRow>();
    if (!row) throw new Error("contact_delivery_missing");
    if (row.sheet_revision < row.revision) {
      try { await sendSheet(customerId, row, env, fetcher); await database.prepare("UPDATE customer_contact_delivery SET sheet_revision = MAX(sheet_revision, ?) WHERE customer_id = ? AND lease_token = ?").bind(row.revision,customerId,token).run(); }
      catch { failures.push("contact_sheet_delivery_failed"); }
    }
    if (row.email_status === "pending") {
      try { await sendNotification(customerId,row,env,database,fetcher); await database.prepare("UPDATE customer_contact_delivery SET email_status = 'delivered' WHERE customer_id = ? AND lease_token = ?").bind(customerId,token).run(); }
      catch (error) { failures.push(error instanceof Error && error.message === "contact_email_requires_delivery_review" ? error.message : "contact_email_delivery_failed"); }
    }
  } finally {
    await database.prepare("UPDATE customer_contact_delivery SET lease_token = NULL, lease_until = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE customer_id = ? AND lease_token = ?").bind(failures.join(",") || null,customerId,token).run();
  }
  if (failures.length) throw new Error(failures.join(","));
}
