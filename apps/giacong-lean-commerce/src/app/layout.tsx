import type { Metadata } from "next";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import { PUBLIC_SITE_ORIGIN } from "@/lib/seo";
import "./globals.css";

const defaultMetadata: Metadata = {
  title: "Kienhieu",
  description: "Danh mục sản phẩm, dịch vụ gia công và kênh gửi yêu cầu mua hàng.",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  const title = settings.site_title || defaultMetadata.title;
  const description = settings.site_description || defaultMetadata.description;
  const shareImage = settings.hero_image_url || settings.favicon_url || undefined;
  return {
    metadataBase: new URL(PUBLIC_SITE_ORIGIN),
    title,
    description,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: typeof title === "string" ? title : "Kienhieu",
      title: typeof title === "string" ? title : "Kienhieu",
      description: description ?? undefined,
      images: shareImage ? [{ url: shareImage }] : undefined,
    },
    twitter: { card: shareImage ? "summary_large_image" : "summary" },
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
