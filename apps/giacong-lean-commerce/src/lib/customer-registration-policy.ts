import type { D1DatabaseLike } from "./admin-data";

/** Read canonical published policy on every registration; never use the UI cache. */
export async function isCustomerEmailRegistrationAllowed(database: D1DatabaseLike): Promise<boolean> {
  const row = await database.prepare(
    "SELECT published_value FROM site_settings WHERE setting_key = 'customer_email_registration'",
  ).first<{ published_value: string }>();
  return row === null || row.published_value === "on";
}
