import { adminFailure, type AdminApiErrorCode } from "./admin-api.ts";

export interface MappedAdminWriteError {
  code: AdminApiErrorCode;
  fieldErrors?: Record<string, string>;
  message: string;
  status: 409 | 503;
}

export interface AdminConflictShape {
  /** Operator-facing field errors for the conflict branch. */
  fieldErrors?: Record<string, string>;
  /** Operator-facing text for the conflict branch; falls back to `fallbackMessage`. */
  message?: string;
}

/**
 * D1 surfaces constraint violations as free-form messages with no stable error
 * code property, so classification has to inspect the text. Uniqueness only:
 * CHECK failures are validation problems, not conflicts, so they must not be
 * reported as "already exists". This is the one place allowed to classify;
 * every admin route maps failures through `adminErrorFrom` so internals never
 * reach a client body.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(error.message);
}

export function mapAdminWriteError(
  error: unknown,
  fallbackMessage: string,
  conflict?: AdminConflictShape,
): MappedAdminWriteError {
  if (isUniqueConstraintError(error)) {
    return {
      code: "UNIQUE_CONFLICT",
      fieldErrors: conflict?.fieldErrors,
      message: conflict?.message ?? fallbackMessage,
      status: 409,
    };
  }
  return { code: "INTERNAL_ERROR", message: fallbackMessage, status: 503 };
}

/** Logs server-side, then answers with the mapped envelope; raw errors never reach the body. */
export function adminErrorFrom(
  requestId: string,
  error: unknown,
  fallbackMessage: string,
  conflict?: AdminConflictShape,
): Response {
  console.error("[admin] write failed", error);
  const mapped = mapAdminWriteError(error, fallbackMessage, conflict);
  return adminFailure(requestId, mapped.status, mapped.code, mapped.message, mapped.fieldErrors);
}
