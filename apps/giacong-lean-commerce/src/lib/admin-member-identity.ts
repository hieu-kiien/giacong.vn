export const ADMIN_PENDING_ACCESS_SUBJECT_PREFIX = "pending-email:";

export function normalizeAdminEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function pendingAdminAccessSubject(email: string): string {
  return `${ADMIN_PENDING_ACCESS_SUBJECT_PREFIX}${normalizeAdminEmail(email)}`;
}

export function shouldBindAdminAccessSubject(accessSubject: string, email: string): boolean {
  const normalizedEmail = normalizeAdminEmail(email);
  const normalizedSubject = accessSubject.trim().toLowerCase();
  return normalizedSubject === normalizedEmail
    || normalizedSubject === pendingAdminAccessSubject(normalizedEmail);
}
