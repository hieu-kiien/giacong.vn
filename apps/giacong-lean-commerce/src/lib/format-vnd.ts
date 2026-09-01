const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

export function formatVnd(value: number): string {
  return VND_FORMATTER.format(value);
}
