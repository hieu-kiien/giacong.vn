import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCommercialEditor } from "@/components/admin/ProductCommercialEditor";
import { ProductCommercialReadOnly } from "@/components/admin/ProductCommercialReadOnly";
import { can, getAdmin, getAdminProduct } from "@/lib/admin-server";

const money = (value: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
}).format(value);

export default async function ProductDetail({ params }: PageProps<"/quan-tri/san-pham/[slug]">) {
  const session = await getAdmin();
  if (session.kind !== "authenticated" || !can(session.admin, "b2b.catalog.read")) notFound();
  const { slug } = await params;
  const result = await getAdminProduct(slug);
  if (result.kind === "not_found") notFound();
  if (result.kind === "unavailable") {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Chi tiết sản phẩm</h1>
        <p role="alert" className="mt-4 rounded border border-[#d5c3a2] bg-[#fff9ed] p-4">Dịch vụ quản trị tạm thời không khả dụng. Vui lòng thử lại sau.</p>
      </section>
    );
  }
  const product = result.product;
  const canWrite = can(session.admin, "b2b.catalog.write");
  return (
    <section>
      <Link href="/quan-tri/san-pham" className="text-sm font-medium text-[#3f5712] hover:underline">← Danh mục</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[#667151]">CHI TIẾT SẢN PHẨM</p>
          <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
          <p className="mt-1 font-mono text-xs text-[#667151]">{product.sku}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${canWrite ? "bg-[#dfe8bd] text-[#405b11]" : "bg-[#eee8df] text-[#725b3f]"}`}>{canWrite ? "Có thể chỉnh sửa" : "Chỉ đọc"}</span>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Summary label="Trạng thái" value={product.published ? "Đã xuất bản" : "Chưa xuất bản"} />
        <Summary label="Khả dụng" value={`${product.available_variant_count}/${product.variant_count} biến thể`} />
        <Summary label="Giá khởi điểm" value={product.starting_price ? money(product.starting_price.unit_price) : "Chưa có"} />
      </dl>

      {product.option_groups.length > 0 && (
        <section className="mt-6" aria-labelledby="configuration-options-title">
          <h2 id="configuration-options-title" className="text-lg font-semibold">Tuỳ chọn sản phẩm</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {product.option_groups.map((group) => (
              <div className="rounded-md border border-[#d7d8c9] bg-[#fbfbf5] p-4" key={group.attribute_id}>
                <h3 className="font-medium">{group.label}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">{group.options.map((option) => <li className="rounded border border-[#d7d8c9] bg-white px-2 py-1 text-sm" key={option.option_id}>{option.label}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {canWrite
        ? <ProductCommercialEditor initialProduct={product} />
        : <ProductCommercialReadOnly product={product} />}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-[#d7d8c9] bg-[#fbfbf5] p-4"><dt className="text-sm text-[#667151]">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}
