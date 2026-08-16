import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import "../../styles/admin.css";

export const metadata: Metadata = {
  title: "Operations console | Giacong.vn",
  description: "Khu vực vận hành nội bộ của Giacong.vn.",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}