import Link from "next/link";
import { Phone } from "lucide-react";

import { CategoryMegaMenu } from "@/components/storefront/CategoryMegaMenu";
import { MobileNavDrawer } from "@/components/storefront/MobileNavDrawer";
import { RequestCartBadge } from "@/components/storefront/RequestCartBadge";
import { STOREFRONT_NAV_ITEMS } from "@/components/storefront/navigation";
import type { CatalogCategory } from "@/types/catalog";

interface StorefrontHeaderProps {
  categories: CatalogCategory[];
}

const HOTLINE = "0868408115";

/**
 * React storefront chrome. This replaces the captured Flatsome header, whose
 * "Sản Phẩm" dropdown listed gia công services behind `href="#"` and whose only
 * catalog entry point was a single top-level link. The wordmark is set as text so
 * no unverified third-party logo asset ships in this demo.
 */
export function StorefrontHeader({ categories }: StorefrontHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-brand-700 text-white" data-storefront-header>
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-2 px-4 py-2 md:gap-4 md:px-6">
        <MobileNavDrawer categories={categories} navItems={STOREFRONT_NAV_ITEMS} />
        <Link
          className="flex min-h-11 items-center rounded-md px-1 text-lg font-bold tracking-tight text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          href="/"
        >
          Kienhieu
        </Link>
        <nav aria-label="Điều hướng chính" className="max-md:hidden">
          <ul className="flex items-center">
            {STOREFRONT_NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  className="flex min-h-11 items-center px-3 text-sm font-bold tracking-wide text-white hover:text-brand-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
                  href={item.href}
                  prefetch={false}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <CategoryMegaMenu categories={categories} />
        <div className="ml-auto flex items-center gap-1 md:gap-3">
          <a
            className="flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-white max-md:hidden focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
            href={`tel:${HOTLINE}`}
          >
            <Phone aria-hidden="true" className="size-4" />
            {HOTLINE}
          </a>
          <RequestCartBadge />
        </div>
      </div>
    </header>
  );
}
