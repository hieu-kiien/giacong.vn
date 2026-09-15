import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import "../../styles/admin.css";

export const metadata: Metadata = {
  title: "Khu vực vận hành | Giacong.vn",
  description: "Khu vực vận hành nội bộ của Giacong.vn.",
  robots: { follow: false, index: false, noarchive: true },
};

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hostname = (await headers()).get("host")?.split(":")[0].toLowerCase();
  if (hostname === "kienhieu.id.vn" || hostname === "www.kienhieu.id.vn") {
    notFound();
  }
  return <AdminShell>{children}</AdminShell>;
}
