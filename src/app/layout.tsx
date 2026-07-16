import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giacong.vn - Giải pháp gia công toàn diện",
  description: "Giao diện giới thiệu dịch vụ gia công toàn diện.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className="h-full antialiased"
    >
      <body className="home page-template-page-transparent-header-light wp-theme-flatsome theme-flatsome lightbox nav-dropdown-has-shadow nav-dropdown-has-border">
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/styles/flatsome.css" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/styles/flatsome-shop.css" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/styles/giacong.css" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/styles/giacong-sections.css" />
        {children}
      </body>
    </html>
  );
}
