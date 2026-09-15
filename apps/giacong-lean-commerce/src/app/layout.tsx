import type { Metadata } from "next";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import { canonicalMetadata, PUBLIC_SITE_ORIGIN } from "@/lib/seo";
import "./globals.css";

const defaultMetadata: Metadata = {
  title: "Giacong.vn - Giải pháp gia công toàn diện",
  description: "Giao diện giới thiệu dịch vụ gia công toàn diện.",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    ...canonicalMetadata("/"),
    metadataBase: new URL(PUBLIC_SITE_ORIGIN),
    title: settings.site_title || defaultMetadata.title,
    description: settings.site_description || defaultMetadata.description,
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
