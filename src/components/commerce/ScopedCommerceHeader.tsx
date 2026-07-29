"use client";

import { usePathname } from "next/navigation";

import { CommerceHeader } from "@/components/commerce/CommerceHeader";
import { CommerceTabHeader } from "@/components/commerce/CommerceTabHeader";
import type { CommerceMegaMenuModel } from "@/components/commerce/commerce-navigation";

interface ScopedCommerceHeaderProps {
  menu: CommerceMegaMenuModel;
}

/** Keeps the first redesign stage confined to the catalog and service tabs. */
export function ScopedCommerceHeader({ menu }: ScopedCommerceHeaderProps) {
  const pathname = usePathname();
  const hasTabHeader = pathname.startsWith("/san-pham") || pathname.startsWith("/thue-gia-cong");

  return hasTabHeader ? <CommerceTabHeader menu={menu} /> : <CommerceHeader menu={menu} />;
}
