import Link from "next/link";
import { Leaf } from "lucide-react";

import { MobileCommerceNav } from "@/components/commerce/MobileCommerceNav";
import type { CommerceMegaMenuModel } from "@/components/commerce/commerce-navigation";
import homePage from "@/data/pages/home.json";
import styles from "@/components/commerce/CommerceTabHeader.module.css";

interface CommerceTabHeaderProps {
  menu: CommerceMegaMenuModel;
}

function extractHomeHeader(markup: string): string {
  const start = markup.indexOf("<header");
  const end = markup.indexOf("</header>", start);
  if (start < 0 || end < 0) return "";

  return markup
    .slice(start, end + "</header>".length)
    .replace(
      /(<li\b[^>]*\bid="menu-item-5166"[\s\S]*?<a\b[^>]*\bhref=")[^"]*(")/i,
      "$1/thue-gia-cong/$2",
    );
}

const capturedHomeHeader = extractHomeHeader(homePage.markup);

/**
 * The desktop header is the captured Home chrome itself. Its styles are scoped
 * to this component, so only the catalog and service tabs inherit it.
 */
export function CommerceTabHeader({ menu }: CommerceTabHeaderProps) {
  return (
    <div data-commerce-header data-storefront-header>
      <div
        className={styles.capturedHeader}
        dangerouslySetInnerHTML={{ __html: capturedHomeHeader }}
      />
      <header className={styles.mobileHeader}>
        <MobileCommerceNav menu={menu} />
        <Link className={styles.mobileBrand} href="/">
          <Leaf aria-hidden="true" className="size-8 fill-white text-white -rotate-12" strokeWidth={1.25} />
          <span>GIACONG.VN</span>
        </Link>
      </header>
    </div>
  );
}
