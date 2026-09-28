export type AdminToastKind = "success" | "error" | "info";

export interface AdminToastItem {
  id: number;
  kind: AdminToastKind;
  message: string;
}

const MAX_ROUTINE_TOASTS = 3;
const MAX_ERROR_TOASTS = 6;

export function appendAdminToast(current: AdminToastItem[], nextToast: AdminToastItem): AdminToastItem[] {
  if (nextToast.kind === "error" && current.some((toast) => toast.kind === "error" && toast.message === nextToast.message)) {
    return current;
  }

  const next = [...current, nextToast];
  const oldestRoutineIndex = next.findIndex((toast) => toast.kind !== "error");
  const withRoutineLimit = next.length > MAX_ROUTINE_TOASTS && oldestRoutineIndex >= 0
    ? next.filter((_, index) => index !== oldestRoutineIndex)
    : next;
  const errorCount = withRoutineLimit.filter((toast) => toast.kind === "error").length;
  if (errorCount <= MAX_ERROR_TOASTS) return withRoutineLimit;

  const oldestErrorIndex = withRoutineLimit.findIndex((toast) => toast.kind === "error");
  return withRoutineLimit.filter((_, index) => index !== oldestErrorIndex);
}
