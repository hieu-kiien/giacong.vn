import type { ReactNode } from "react";

import { CommerceShell } from "@/components/commerce/CommerceShell";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { getCommerceNavCategories } from "@/lib/commerce-nav";

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
 * `StorefrontHeader` is reused as-is. It is already a React component with no
 * dependency on the cloned CSS, and rebuilding the header is a later step — this
 * layout only has to establish the clean boundary it will be rebuilt inside.
 */
export default async function CommerceLayout({ children }: { children: ReactNode }) {
  const categories = await getCommerceNavCategories();

  return (
    <CommerceShell header={<StorefrontHeader categories={categories} />}>
      {children}
    </CommerceShell>
  );
}
