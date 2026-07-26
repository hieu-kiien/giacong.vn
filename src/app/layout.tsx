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
