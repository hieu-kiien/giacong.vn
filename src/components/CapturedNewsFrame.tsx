import type { ReactNode } from "react";
import Link from "next/link";

import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";
import { getStorefrontNavigationForPath } from "@/components/site/storefront-navigation";

interface CapturedNewsFrameProps {
  activePath: "/san-pham" | "/thue-gia-cong";
  children: ReactNode;
  title: "Sản phẩm" | "Thuê gia công";
}

/**
 * Archive-specific content frame for the two approved index tabs. The shared site
 * Header, Footer, styles and interactions live in `CapturedStorefrontShell`.
 */
export function CapturedNewsFrame({ activePath, children, title }: CapturedNewsFrameProps) {
  const activeNavigation = getStorefrontNavigationForPath(activePath)?.key;
  if (!activeNavigation) throw new Error(`Missing storefront navigation for ${activePath}`);

  return (
    <CapturedStorefrontShell activeNavigation={activeNavigation}>
      <main id="main">
        <div className="blog-wrapper blog-archive page-wrapper" id="content">
          <header className="archive-page-header">
            <div className="row">
              <div className="large-12 text-center col">
                <nav aria-label="breadcrumbs" className="rank-math-breadcrumb">
                  <p><Link href="/">Trang chủ</Link><span className="separator"> » </span><span className="last">{title}</span></p>
                </nav>
                <h1 className="page-title is-large uppercase"><span>{title}</span></h1>
              </div>
            </div>
          </header>
          <div className="row align-center">
            <div className="large-12 col">{children}</div>
          </div>
        </div>
      </main>
    </CapturedStorefrontShell>
  );
}
