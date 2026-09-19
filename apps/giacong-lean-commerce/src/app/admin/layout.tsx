import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import "../../styles/admin.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    title: `Khu vực vận hành | ${settings.brand_name}`,
    description: `Khu vực vận hành nội bộ của ${settings.brand_name}.`,
    robots: { follow: false, index: false, noarchive: true },
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hostname = (await headers()).get("host")?.split(":")[0].toLowerCase();
  if (hostname === "kienhieu.id.vn" || hostname === "www.kienhieu.id.vn") {
    notFound();
  }
  const settings = await getPublishedSiteSettings();
  return <AdminShell brandName={settings.brand_name}>{children}</AdminShell>;
}
