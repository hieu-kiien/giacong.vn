import { legacyErrorLabel } from "@/components/admin/commercial-rules";
import type { AdminProductDetail } from "@/lib/admin-contract";

const money = (value: number | null) => value === null
  ? "Chưa hợp lệ"
  : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export function ProductCommercialReadOnly({ product }: { product: AdminProductDetail }) {
  return (
    <>
      {product.validation_errors.length > 0 && (
        <div className="mt-5 rounded-md border border-[#e0c69b] bg-[#fff9ed] p-4 text-sm text-[#714d18]">
          <p className="font-medium">Dữ liệu sản phẩm cần được người có quyền chỉnh sửa hoàn thiện</p>
          <ul className="mt-1 list-disc pl-5">{product.validation_errors.map((error) => <li key={error}>{legacyErrorLabel(error)}</li>)}</ul>
        </div>
      )}
      <section className="mt-6" aria-labelledby="readonly-variants-title">
        <h2 id="readonly-variants-title" className="text-lg font-semibold">Biến thể và quy tắc bán</h2>
        <div className="mt-3 space-y-3">
          {product.variants.map((variant) => (
            <article className="rounded-lg border border-[#d7d8c9] bg-[#fbfbf5] p-4" key={variant.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{variant.name}</h3>
                  <p className="font-mono text-xs text-[#667151]">{variant.sku}</p>
                  {variant.option_values.length > 0 && <p className="mt-1 text-sm text-[#59634d]">{variant.option_values.map((option) => option.option_label).join(" · ")}</p>}
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${variant.published ? "bg-[#dfe8bd] text-[#405b11]" : "bg-[#eee8df] text-[#725b3f]"}`}>{variant.published ? "Đã xuất bản" : "Chưa xuất bản"}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Metric label="Đơn vị" value={variant.unit ?? "Chưa có"} />
                <Metric label="MOQ" value={variant.moq ?? "Chưa có"} />
                <Metric label="Bước đặt" value={variant.quantity_step ?? "Chưa có"} />
                <Metric label="Liên hệ từ" value={variant.contact_from_quantity ?? "Chưa có"} />
              </dl>
              <div className="mt-4 border-t border-[#d7d8c9] pt-3">
                <p className="text-sm font-medium">Giá theo số lượng</p>
                {variant.tier_prices.length === 0
                  ? <p className="mt-1 text-sm text-[#8b2c16]">Chưa có mức giá.</p>
                  : <ul className="mt-2 flex flex-wrap gap-2">{variant.tier_prices.map((tier, index) => <li className="rounded bg-[#eff0e5] px-2 py-1 text-xs" key={`${tier.min_quantity}-${index}`}>Từ {tier.min_quantity ?? "chưa hợp lệ"}: {money(tier.unit_price)}</li>)}</ul>}
              </div>
              {variant.validation_errors.length > 0 && <p className="mt-3 text-xs text-[#8b2c16]">Cần kiểm tra: {variant.validation_errors.map(legacyErrorLabel).join("; ")}.</p>}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-[#667151]">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>;
}
