import type { ReactNode } from "react";

import { CommerceFloatingContacts } from "@/components/commerce/CommerceFloatingContacts";
import { CommerceHeader } from "@/components/commerce/CommerceHeader";
import { CommerceShell } from "@/components/commerce/CommerceShell";
import { CommerceSupportStrip } from "@/components/commerce/CommerceSupportStrip";
import { buildCommerceMegaMenu } from "@/components/commerce/commerce-navigation";
import { getCommerceNavCategories, getCommerceNavProducts } from "@/lib/commerce-nav";

/**
 * Layout for the commerce routes (`/san-pham`, `/san-pham/[slug]`,
 * `/gui-yeu-cau`).
 *
 * This route group exists so these routes stop inheriting the cloned cascade. The
 * sibling `(storefront)` group imports `captured-layers.css`, which pulls nine
 * cloned stylesheets — including bare element selectors — plus the cloned footer
 * markup. Both are scoped to a layout, so moving a route between groups is what
 * detaches it; there is no way to opt a single route out from inside the other
 * group.
 *
 * What that buys: Tailwind utilities on these routes are no longer contested by
 * `!important` rules from the cloned sheets, the cloned footer is gone from the
 * first viewport as the topology requires, and the routes stop shipping ~9 cloned
 * stylesheets they never used.
 *
 * The chrome is now the commerce header, mega-menu and mobile drawer built against
 * the approved reference, replacing the reused storefront header this layout
 * mounted while the clean boundary was being established.
 *
 * Navigation data is read here rather than per page so the header renders once per
 * route. Both reads degrade to an empty menu instead of throwing: navigation is not
 * the content of any route, and a statically prerendered page must still build with
 * no upstream available.
 */
export default async function CommerceLayout({ children }: { children: ReactNode }) {
  const [categories, products] = await Promise.all([getCommerceNavCategories(), getCommerceNavProducts()]);

  /**
   * The leading category is chosen by the menu itself: a layout cannot read the
   * request's search parameters, so the active group cannot come from the URL here.
   * Hovering or focusing a group switches it on the client.
   */
  const menu = buildCommerceMegaMenu({ activeCategorySlug: "", categories, products });

  return (
    <CommerceShell
      header={<CommerceHeader menu={menu} />}
      support={
        <>
          <CommerceSupportStrip />
          <CommerceFloatingContacts />
        </>
      }
    >
      {children}
    </CommerceShell>
  );
}
