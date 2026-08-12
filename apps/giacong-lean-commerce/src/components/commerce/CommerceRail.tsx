import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CommerceRailProps {
  /** Element to render. Sections and navs both need the rail, so it is not fixed to `div`. */
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

/**
 * The centred commerce content rail: 1390 px maximum, with 12/16/24 px horizontal
 * padding from mobile up. Both numbers are measured on the 1672 px reference
 * canvas, so the rail is what keeps the header, catalog body, mega-menu panel and
 * detail page on one vertical edge.
 *
 * Written as literal utilities rather than a `max-w-commerce-rail` theme lookup so
 * the measured value reads at the call site.
 */
export function CommerceRail({ as: Component = "div", children, className }: CommerceRailProps) {
  return (
    <Component className={cn("mx-auto w-full max-w-[1390px] px-3 sm:px-4 lg:px-6", className)}>
      {children}
    </Component>
  );
}
