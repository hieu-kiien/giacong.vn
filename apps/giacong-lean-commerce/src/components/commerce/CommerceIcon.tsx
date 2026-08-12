import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Icon sizes in use across the commerce UI. Line icons only — the specifications
 * call for simple line iconography and no decorative motion.
 */
const SIZE_CLASS = {
  lg: "size-6",
  md: "size-5",
  sm: "size-4",
} as const;

interface CommerceIconProps {
  className?: string;
  /** Any `lucide-react` icon; the dependency is already in the project. */
  icon: LucideIcon;
  /**
   * Accessible name. Omit it for icons that sit beside their own visible text,
   * which is the common case — those must not be announced twice.
   */
  label?: string;
  size?: keyof typeof SIZE_CLASS;
}

/**
 * Wraps a lucide glyph so accessibility is decided once instead of per call site:
 * decorative by default (`aria-hidden`), promoted to `role="img"` with a name only
 * when a label is passed. Stroke width is pinned so icons keep one weight across
 * the header, benefit rows and cards.
 */
export function CommerceIcon({ className, icon: Icon, label, size = "md" }: CommerceIconProps) {
  return (
    <Icon
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      className={cn("shrink-0", SIZE_CLASS[size], className)}
      role={label ? "img" : undefined}
      strokeWidth={1.75}
    />
  );
}
