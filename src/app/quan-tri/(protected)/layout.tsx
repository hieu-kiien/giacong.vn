import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { can, getAdmin, safeReturnTo } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) {
    const path = (await headers()).get("x-pathname") ?? "/quan-tri";
    redirect(`/quan-tri/dang-nhap?returnTo=${encodeURIComponent(safeReturnTo(path))}`);
  }
  const landing = can(admin, "b2b.dashboard") ? "/quan-tri" : "/quan-tri/san-pham";
  return <AdminShell name={admin.name} dashboard={can(admin, "b2b.dashboard")} catalog={can(admin, "b2b.catalog.read")} landing={landing}>{children}</AdminShell>;
}
