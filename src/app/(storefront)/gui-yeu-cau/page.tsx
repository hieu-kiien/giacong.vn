import type { Metadata } from "next";
import Link from "next/link";

import { RequestCartView } from "@/components/request-cart/RequestCartView";
import { CapturedStorefrontShell } from "@/components/site/CapturedStorefrontShell";

export const metadata: Metadata = {
  title: "Giỏ hàng | Giacong.vn",
  description: "Xem lại sản phẩm đã chọn và gửi yêu cầu để được tư vấn, báo giá.",
};

export default function RequestCartPage() {
  return (
    <CapturedStorefrontShell activeNavigation="products">
      <main id="main">
        <div className="blog-wrapper blog-archive page-wrapper" id="content">
          <header className="archive-page-header">
            <div className="row">
              <div className="large-12 text-center col">
                <nav aria-label="breadcrumbs" className="rank-math-breadcrumb">
                  <p>
                    <Link href="/">Trang chủ</Link>
                    <span className="separator"> » </span>
                    <span className="last">Giỏ hàng</span>
                  </p>
                </nav>
                <h1 className="page-title is-large uppercase"><span>Giỏ hàng</span></h1>
              </div>
            </div>
          </header>
          <div className="row align-center">
            <div className="large-12 col"><RequestCartView /></div>
          </div>
        </div>
      </main>
    </CapturedStorefrontShell>
  );
}
