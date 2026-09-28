export type AdminProductVisibilityAction = "hide" | "show" | "restore-draft" | "none";

/** Keep list actions aligned with the server rule that only published products can be active. */
export function getAdminProductVisibilityAction(
  product: { isActive: boolean; status: string },
): AdminProductVisibilityAction {
  if (product.isActive) return "hide";
  if (product.status === "published") return "show";
  if (product.status === "archived") return "restore-draft";
  return "none";
}
