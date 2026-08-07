import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const siteTitle = "Giacong.vn - Giải pháp gia công toàn diện";
const siteDescription =
  "Gia công OEM nông sản, thực phẩm và dược liệu từ nghiên cứu công thức đến sản xuất, thiết kế thương hiệu và đóng gói.";

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: { default: siteTitle, template: "%s | Giacong.vn" },
  description: siteDescription,
  applicationName: "Giacong.vn",
  keywords: [
    "gia công thực phẩm",
    "gia công OEM",
    "gia công dược liệu",
    "gia công nông sản",
    "đóng gói sản phẩm",
  ],
  authors: [{ name: "Giacong.vn" }],
  creator: "Giacong.vn",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Giacong.vn",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="vi" className="js">
      <body>{children}</body>
    </html>
  );
}
