import type { Metadata } from "next";
import Link from "next/link";

import { noIndexMetadata } from "@/lib/seo";
import { getPublishedSiteSettings } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    ...noIndexMetadata(),
    description: "Đường dẫn này không còn tồn tại hoặc nội dung chưa được phát hành.",
    title: `Không tìm thấy trang | ${settings.brand_name}`,
  };
}

export default async function NotFound() {
  const settings = await getPublishedSiteSettings();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-commerce-brand-dark">{settings.brand_name}</p>
      <h1 className="mb-4 text-3xl font-semibold text-commerce-primary">Không tìm thấy trang</h1>
      <p className="mb-8 max-w-xl text-base leading-7 text-commerce-secondary">
        Đường dẫn này không còn tồn tại hoặc nội dung chưa được phát hành. Bạn có thể tiếp tục từ các khu vực chính dưới đây.
      </p>
      <nav aria-label="Điều hướng trang không tìm thấy" className="flex flex-wrap justify-center gap-3">
        <Link className="rounded-md bg-commerce-brand px-5 py-3 font-semibold text-white" href="/">Về trang chủ</Link>
        <Link className="rounded-md border border-commerce-border px-5 py-3 font-semibold text-commerce-primary" href="/san-pham/">Xem sản phẩm</Link>
        <Link className="rounded-md border border-commerce-border px-5 py-3 font-semibold text-commerce-primary" href="/thue-gia-cong/">Xem dịch vụ</Link>
        <Link className="rounded-md border border-commerce-border px-5 py-3 font-semibold text-commerce-primary" href="/lien-he/">Liên hệ</Link>
      </nav>
    </main>
  );
}
