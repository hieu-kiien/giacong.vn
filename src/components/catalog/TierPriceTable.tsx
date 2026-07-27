import styles from "@/components/catalog/product-detail.module.css";
import type { ProductDetailTierRow } from "@/lib/product-detail-view";

interface TierPriceTableProps {
  activeMinQuantity: number | null;
  rows: readonly ProductDetailTierRow[];
  variantLabel: string;
}

/**
 * Quantity bands, unit price and the saving against the first band.
 *
 * Stays a real `<table>` with a caption and scoped headers. At mobile width the
 * stylesheet reflows the rows into stacked blocks instead of giving the table a
 * horizontal scroller, which is why every cell also carries `data-label`: that
 * attribute is what supplies the column name once the header row is hidden.
 */
export function TierPriceTable({ activeMinQuantity, rows, variantLabel }: TierPriceTableProps) {
  return (
    <table className={styles.tierTable}>
      <caption>Giá theo số lượng — {variantLabel}</caption>
      <thead>
        <tr>
          <th scope="col">Số lượng</th>
          <th scope="col">Đơn giá</th>
          <th scope="col">Tiết kiệm</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            data-active={row.minQuantity === activeMinQuantity ? "true" : undefined}
            data-contact={row.price === null ? "true" : undefined}
            key={row.minQuantity}
          >
            <th data-label="Số lượng" scope="row">{row.quantityLabel}</th>
            <td data-label="Đơn giá">{row.priceLabel}</td>
            <td data-label="Tiết kiệm">
              {row.savingPercent === null ? <span aria-hidden="true">—</span> : `−${row.savingPercent}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
