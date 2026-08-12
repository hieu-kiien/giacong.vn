import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Skip target and main landmark id. It keeps the value the catalog and request-cart
 * routes already used, so in-page anchors and the existing QA selectors stay valid
 * across the move into this shell.
 */
export const COMMERCE_MAIN_ID = "catalog-main";

interface CommerceShellProps {
  children: ReactNode;
  className?: string;
  /**
   * Closing slot. Composed by the caller like the header, which is also what keeps
   * the contentinfo landmark element itself in `CommerceFooter.tsx` rather than
   * here — the foundation contract asserts this file declares none.
   */
  footer?: ReactNode;
  /**
   * Header slot. The shell owns the landmarks and the skip target; the header
   * itself is composed by the caller so the shell stays independent of it.
   */
  header?: ReactNode;
  /** Slot below the main region — the B2B support strip and floating contacts. */
  support?: ReactNode;
}

/**
 * Page frame for every commerce route.
 *
 * Deliberately free of legacy chrome: it renders no cloned footer, imports no
 * cloned stylesheet and uses no class that only the cloned cascade defines. Its
 * accessibility utilities come from Tailwind (`sr-only`), which is what lets the
 * `(commerce)` route group skip that cascade altogether.
 *
 * It owns the only `<main>` on a commerce route, so pages render sections.
 */
export function CommerceShell({ children, className, footer, header, support }: CommerceShellProps) {
  return (
    <div className={cn("min-h-dvh bg-white text-commerce-body", className)}>
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-commerce-control focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-commerce-brand-dark focus:commerce-focus-ring"
        href={`#${COMMERCE_MAIN_ID}`}
      >
        Bỏ qua nội dung
      </a>
      {header}
      <main id={COMMERCE_MAIN_ID}>{children}</main>
      {support}
      {footer}
    </div>
  );
}
