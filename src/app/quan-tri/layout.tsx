import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdmin, safeReturnTo, can } from "@/lib/admin-server";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) { const admin = await getAdmin(); if (!admin) { const path = (await headers()).get("x-pathname") ?? "/quan-tri"; redirect(`/quan-tri/dang-nhap?returnTo=${encodeURIComponent(safeReturnTo(path))}`); } return <AdminShell name={admin.name} dashboard={can(admin, "b2b.dashboard")} catalog={can(admin, "b2b.catalog.read")}>{children}</AdminShell>; }
