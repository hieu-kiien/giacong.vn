import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdmin, safeReturnTo } from "@/lib/admin-server";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: PageProps<"/quan-tri/dang-nhap">) { const session = await getAdmin(); if (session.kind === "authenticated") redirect("/quan-tri"); const { returnTo } = await searchParams; const value = typeof returnTo === "string" ? returnTo : null; return <main className="grid min-h-dvh place-items-center bg-[#edf0df] p-5"><section className="w-full max-w-md rounded-lg border border-[#d2d7bd] bg-[#fbfbf5] p-6 shadow-sm"><p className="text-xs font-semibold tracking-[0.16em] text-[#667151]">GIA CÔNG · B2B</p><h1 className="mt-2 text-2xl font-semibold text-[#26351b]">Đăng nhập quản trị</h1><p className="mt-2 text-sm text-[#59634d]">Khu vực chỉ đọc dành cho nhân sự được phân quyền.</p><LoginForm returnTo={safeReturnTo(value)} /></section></main>; }
