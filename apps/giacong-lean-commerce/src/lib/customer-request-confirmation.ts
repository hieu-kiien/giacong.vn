import { parseAcceptedRequest, serializeAcceptedRequest, type AcceptedRequestSnapshot } from "./request-cart-client.ts";

export function serializeCustomerConfirmation(snapshot: AcceptedRequestSnapshot, customerId: string): string {
  return JSON.stringify({ customerId, snapshot: serializeAcceptedRequest(snapshot) });
}

export function parseCustomerConfirmation(value: string | null, customerId: string | null): AcceptedRequestSnapshot | null {
  if (!value || !customerId) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || !("customerId" in parsed) || parsed.customerId !== customerId
      || !("snapshot" in parsed) || typeof parsed.snapshot !== "string") return null;
    return parseAcceptedRequest(parsed.snapshot);
  } catch { return null; }
}
