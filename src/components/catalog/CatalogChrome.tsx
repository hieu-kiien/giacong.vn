import type { ReactNode } from "react";

import { CapturedFloatingContact } from "@/components/CapturedPage";
import { GiacongInteractions } from "@/components/GiacongInteractions";
import { getCatalogChrome } from "@/lib/catalog-chrome";

interface CatalogChromeProps {
  children: ReactNode;
}

export async function CatalogChrome({ children }: CatalogChromeProps) {
  const chrome = await getCatalogChrome();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: chrome.pageStyles }} />
      <div className={chrome.bodyClasses} suppressHydrationWarning>
        <a className="skip-link screen-reader-text" href="#catalog-main">Bỏ qua nội dung</a>
        <div id="wrapper">
          <div dangerouslySetInnerHTML={{ __html: chrome.headerMarkup }} />
          {children}
          <div dangerouslySetInnerHTML={{ __html: chrome.footerMarkup }} />
        </div>
        <div dangerouslySetInnerHTML={{ __html: chrome.trailingMarkup }} />
      </div>
      <CapturedFloatingContact />
      <GiacongInteractions bodyClasses={chrome.bodyClasses} htmlClasses={chrome.htmlClasses} />
    </>
  );
}
