export interface EscapeFocusable {
  focus(): void;
  blur(): void;
}

export interface EscapeScope {
  querySelector(selectors: string): EscapeFocusable | null;
}

export interface EscapeActiveElement {
  closest(selectors: string): EscapeScope | null;
}

export type DesktopDropdownEscapeOutcome =
  | { readonly action: "focus"; readonly element: EscapeFocusable }
  | { readonly action: "blur"; readonly element: EscapeFocusable }
  | { readonly action: "none" };

const TOP_LEVEL_ITEM_SELECTOR = "ul.header-nav-main > li";

export function resolveDesktopDropdownEscapeTarget(
  activeElement: EscapeActiveElement | null,
  isDropdownOpen: (dropdown: EscapeFocusable) => boolean,
): DesktopDropdownEscapeOutcome {
  if (!activeElement) return { action: "none" };
  // Desktop dropdowns are CSS hover/focus driven (no JS open state), so Escape
  // can only close them by moving focus: back to the top-level link when focus
  // sits inside its open dropdown, or off the top link when it owns focus.
  const scope = activeElement.closest(TOP_LEVEL_ITEM_SELECTOR);
  if (!scope) return { action: "none" };
  const dropdown = scope.querySelector(":scope .nav-dropdown");
  if (!dropdown || !isDropdownOpen(dropdown)) return { action: "none" };
  const topLink = scope.querySelector(":scope > a");
  if (!topLink) return { action: "none" };
  if ((topLink as unknown) === (activeElement as unknown)) {
    return { action: "blur", element: topLink };
  }
  return { action: "focus", element: topLink };
}
