import { redirect } from "next/navigation";
import { can, getAdmin, getDashboard } from "@/lib/admin-server";

export default async function Dashboard() {
  const admin = await getAdmin();
  if (!admin) redirect("/quan-tri/dang-nhap");
  if (!can(admin, "b2b.dashboard")) redirect("/quan-tri/san-pham");
  const data = await getDashboard();
  if (!data) return <section><h1 className="text-2xl font-semibold">Tổng quan</h1><p role="alert" className="mt-4 rounded border border-[#d5c3a2] bg-[#fff9ed] p-4">Không thể tải số liệu được cấp quyền. Vui lòng thử lại.</p></section>;
  const cards = [["Sản phẩm cha", data.product_parent_count], ["Biến thể", data.variant_count], ["Biến thể khả dụng", data.available_variant_count], ["Danh mục", data.category_count]];
  return <section><div className="flex items-baseline justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.14em] text-[#667151]">TỔNG QUAN</p><h1 className="mt-1 text-2xl font-semibold">Dữ liệu danh mục</h1></div><span className="rounded-full bg-[#dfe8bd] px-3 py-1 text-xs font-semibold text-[#405b11]">Chỉ đọc</span></div><dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div className="rounded-md border border-[#d7d8c9] bg-[#fbfbf5] p-4" key={label}><dt className="text-sm text-[#667151]">{label}</dt><dd className="mt-2 text-3xl font-semibold">{value}</dd></div>)}</dl></section>;
}
