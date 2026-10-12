export function resolveCustomerSessionView(input: {
  revoked: boolean;
  pending: boolean;
  error: unknown;
  expectedUserId: string;
  user: { id: string; emailVerified: boolean } | null | undefined;
}): "expired" | "pending" | "unavailable" | "changed" | "verified" {
  if (input.revoked) return "expired";
  if (input.pending) return "pending";
  if (input.error) return "unavailable";
  if (!input.user?.emailVerified) return "expired";
  if (input.user.id !== input.expectedUserId) return "changed";
  return "verified";
}
