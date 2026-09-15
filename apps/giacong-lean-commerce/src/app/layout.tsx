import type { Metadata } from "next";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import { PUBLIC_SITE_ORIGIN } from "@/lib/seo";
import "./globals.css";

const defaultMetadata: Metadata = {
  title: "Giacong.vn",
  description: "Danh mục sản phẩm, dịch vụ gia công và kênh gửi yêu cầu báo giá B2B.",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    metadataBase: new URL(PUBLIC_SITE_ORIGIN),
    title: defaultMetadata.title,
    description: defaultMetadata.description,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      data-scroll-behavior="smooth"
      lang="vi"
      className="js"
    >
      <body>
        {children}
      </body>
    </html>
  );
}
