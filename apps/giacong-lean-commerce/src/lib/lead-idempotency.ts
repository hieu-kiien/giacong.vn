export const LEAD_IDEMPOTENCY_CONFLICT = "LEAD_IDEMPOTENCY_CONFLICT";

export class LeadIdempotencyConflictError extends Error {
  readonly code = LEAD_IDEMPOTENCY_CONFLICT;

  constructor() {
    super("Request id already belongs to a different lead payload.");
    this.name = "LeadIdempotencyConflictError";
  }
}

/**
 * Compare a new canonical lead payload with the JSON already stored for a request id.
 * Object-key order is ignored, while array order and every JSON value remain significant.
 */
export async function storedLeadPayloadMatches(
  storedPayloadJson: string,
  candidate: unknown,
): Promise<boolean> {
  let stored: unknown;
  try {
    stored = JSON.parse(storedPayloadJson);
  } catch {
    return false;
  }

  try {
    const [storedFingerprint, candidateFingerprint] = await Promise.all([
      fingerprintLeadPayload(stored),
      fingerprintLeadPayload(candidate),
    ]);
    return storedFingerprint === candidateFingerprint;
  } catch {
    return false;
  }
}

export async function fingerprintLeadPayload(value: unknown): Promise<string> {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError("Lead payload must be JSON serializable.");

  const jsonValue = JSON.parse(serialized) as unknown;
  const canonical = canonicalJson(jsonValue);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError("Lead payload contains a non-JSON value.");
    return serialized;
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
