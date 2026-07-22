import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { can, getAdmin, safeReturnTo } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdmin();
  if (session.kind === "unauthenticated") {
    const path = (await headers()).get("x-pathname") ?? "/quan-tri";
    redirect(`/quan-tri/dang-nhap?returnTo=${encodeURIComponent(safeReturnTo(path))}`);
  }
  if (session.kind === "unavailable") return <main className="grid min-h-dvh place-items-center bg-[#f5f5ed] p-6"><section role="alert" className="max-w-md rounded-md border border-[#d5c3a2] bg-[#fff9ed] p-5"><h1 className="font-semibold">Dịch vụ quản trị tạm thời không khả dụng</h1><p className="mt-2 text-sm">Vui lòng thử lại sau.</p></section></main>;
  const admin = session.admin;
  const landing = can(admin, "b2b.dashboard") ? "/quan-tri" : "/quan-tri/san-pham";
  return <AdminShell name={admin.name} dashboard={can(admin, "b2b.dashboard")} catalog={can(admin, "b2b.catalog.read")} landing={landing}>{children}</AdminShell>;
}
