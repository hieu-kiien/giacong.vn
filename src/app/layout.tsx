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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
