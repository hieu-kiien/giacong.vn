import Link from "next/link";
import { Phone } from "lucide-react";

import { CommerceIcon } from "@/components/commerce/CommerceIcon";
import { CommerceRail } from "@/components/commerce/CommerceRail";
import { CommerceRequestBadge } from "@/components/commerce/CommerceRequestBadge";
import { MobileCommerceNav } from "@/components/commerce/MobileCommerceNav";
import { ProductMegaMenu } from "@/components/commerce/ProductMegaMenu";
import {
  COMMERCE_HOTLINE,
  COMMERCE_HOTLINE_HREF,
  COMMERCE_NAV_ITEMS,
  COMMERCE_QUOTE_LABEL,
  COMMERCE_REQUEST_HREF,
} from "@/components/commerce/commerce-navigation";
import type { CommerceMegaMenuModel } from "@/components/commerce/commerce-navigation";

interface CommerceHeaderProps {
  menu: CommerceMegaMenuModel;
}

const sourceLeftNavItems = COMMERCE_NAV_ITEMS.filter(
  (item) => item.label === "Trang chủ" || item.label === "Giới thiệu",
);

const sourceRightNavItems = COMMERCE_NAV_ITEMS.filter(
  (item) => item.label === "Thuê gia công" || item.label === "Tin tức" || item.label === "Liên hệ",
);

/**
 * Commerce header: the same deep-green storefront band and desktop rhythm as the
 * service and information tabs, with a compact 56 px mobile form on the shared rail.
 *
 * The wordmark is set as text. No third-party logo asset is verified for this
 * project, so bundling one would put an unlicensed brand mark in the UI.
 *
 * The rail is the mega-menu's positioning context, which is what makes the panel
 * open flush below the band and share the catalog's left and right edges.
 *
 * `data-storefront-header` is kept alongside `data-commerce-header`: it is the hook
 * the existing QA harnesses use to assert that exactly one React header ships on a
 * catalog route, and this header is what now satisfies that.
 */
export function CommerceHeader({ menu }: CommerceHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 bg-brand-700 text-white"
      data-commerce-header
      data-storefront-header
    >
      <CommerceRail className="relative grid h-commerce-header-compact grid-cols-[auto_1fr_auto] items-center gap-1 md:h-commerce-header md:gap-2 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex h-commerce-header-compact items-center gap-1 md:h-commerce-header md:gap-2">
          <MobileCommerceNav menu={menu} />
          <nav aria-label="Điều hướng chính trái" className="max-lg:hidden">
            <ul className="flex items-center">
              {sourceLeftNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    className="flex commerce-target items-center rounded-commerce-control px-2.5 text-sm font-bold text-white transition-colors hover:bg-white/12 focus-visible:commerce-focus-ring motion-reduce:transition-none"
                    href={item.href}
                    prefetch={false}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ProductMegaMenu menu={menu} />
        </div>

        <Link
          className="flex commerce-target shrink-0 items-center justify-self-center rounded-commerce-control px-1 text-lg font-bold tracking-tight text-white focus-visible:commerce-focus-ring md:text-xl"
          href="/"
        >
          Giacong<span className="font-semibold opacity-80">.vn</span>
        </Link>

        <div className="flex items-center justify-self-end gap-1 md:gap-2">
          <nav aria-label="Điều hướng chính phải" className="max-lg:hidden">
            <ul className="flex items-center">
              {sourceRightNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    className="flex commerce-target items-center rounded-commerce-control px-2.5 text-sm font-bold text-white transition-colors hover:bg-white/12 focus-visible:commerce-focus-ring motion-reduce:transition-none"
                    href={item.href}
                    prefetch={false}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <a
            className="flex commerce-target items-center gap-1.5 rounded-commerce-control px-2 text-sm font-bold text-white max-xl:hidden focus-visible:commerce-focus-ring"
            href={COMMERCE_HOTLINE_HREF}
          >
            <CommerceIcon icon={Phone} size="sm" />
            {COMMERCE_HOTLINE}
          </a>

          <Link
            className="flex commerce-target items-center justify-center rounded-commerce-control border border-white px-4 text-sm font-bold text-white transition-colors max-lg:hidden hover:bg-white hover:text-brand-800 focus-visible:commerce-focus-ring motion-reduce:transition-none"
            href={COMMERCE_REQUEST_HREF}
            prefetch={false}
          >
            {COMMERCE_QUOTE_LABEL}
          </Link>

          <CommerceRequestBadge />
        </div>
      </CommerceRail>
    </header>
  );
}
