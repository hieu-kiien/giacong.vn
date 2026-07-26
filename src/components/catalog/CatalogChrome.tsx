import type { ReactNode } from "react";

import { CapturedFloatingContact } from "@/components/CapturedPage";
import { GiacongInteractions } from "@/components/GiacongInteractions";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { getCatalogChrome, getStorefrontNavCategories } from "@/lib/catalog-chrome";

interface CatalogChromeProps {
  children: ReactNode;
  floatingContact?: boolean;
}

export async function CatalogChrome({ children, floatingContact = true }: CatalogChromeProps) {
  const [chrome, categories] = await Promise.all([getCatalogChrome(), getStorefrontNavCategories()]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: chrome.pageStyles }} />
      <div className={chrome.bodyClasses} suppressHydrationWarning>
        <a className="skip-link screen-reader-text" href="#catalog-main">Bỏ qua nội dung</a>
        <StorefrontHeader categories={categories} />
        <div id="wrapper">
          {children}
          <div dangerouslySetInnerHTML={{ __html: chrome.footerMarkup }} />
        </div>
      </div>
      {floatingContact ? <CapturedFloatingContact /> : null}
      <GiacongInteractions bodyClasses={chrome.bodyClasses} htmlClasses={chrome.htmlClasses} />
    </>
  );
}
