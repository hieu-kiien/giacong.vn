import { getCloudflareContext } from "@opennextjs/cloudflare";
import { deliverCustomerContact, type CustomerContactDeliveryDatabase, type CustomerContactDeliveryEnvironment, type CustomerContactDeliveryMessage } from "./customer-contact-delivery.ts";

interface ContactDeliveryBindings extends CustomerContactDeliveryEnvironment {
  GIACONG_VN_LEAD_QUEUE?: { send(message: CustomerContactDeliveryMessage): Promise<void> };
}
export function getCustomerContactDeliveryBindings(): ContactDeliveryBindings {
  try { return getCloudflareContext().env as unknown as ContactDeliveryBindings; } catch { return {}; }
}
export async function enqueueCustomerContact(customerId: string, database: CustomerContactDeliveryDatabase): Promise<void> {
  const bindings = getCustomerContactDeliveryBindings();
  if (bindings.GIACONG_VN_LEAD_QUEUE) {
    try { await bindings.GIACONG_VN_LEAD_QUEUE.send({ type: "customer-contact", customerId }); return; } catch { /* Keep the D1 event and try the direct delivery fallback. */ }
  }
  try { await deliverCustomerContact(customerId, bindings, database); } catch { /* D1 retains each pending channel for owner retry; never report a saved profile as lost. */ }
}
