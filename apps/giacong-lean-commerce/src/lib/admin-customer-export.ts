import { escapeCsvCell } from "./admin-product-export.ts";
import type { AdminCustomerSummary } from "./admin-customers.ts";

export const ADMIN_CUSTOMER_EXPORT_HEADERS = [
  "ho_ten",
  "email",
  "ten_dang_nhap",
  "so_dien_thoai",
  "so_yeu_cau",
  "yeu_cau_gan_nhat",
  "so_don_da_chot",
  "tong_tien_da_chot",
  "ngay_dang_ky",
] as const;

/** UTF-8 BOM + CRLF so Excel opens Vietnamese text correctly. */
export function buildCustomerExportCsv(customers: readonly AdminCustomerSummary[]): string {
  const lines: string[] = [ADMIN_CUSTOMER_EXPORT_HEADERS.join(",")];
  for (const customer of customers) {
    lines.push([
      escapeCsvCell(customer.name),
      escapeCsvCell(customer.email),
      escapeCsvCell(customer.username),
      escapeCsvCell(customer.phone),
      escapeCsvCell(customer.requestCount, { text: false }),
      escapeCsvCell(customer.lastRequestAt),
      escapeCsvCell(customer.saleCount, { text: false }),
      escapeCsvCell(customer.saleTotal, { text: false }),
      escapeCsvCell(customer.createdAt),
    ].join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
