let exceptionalFormatter: Intl.NumberFormat | undefined;

export function formatVnd(value: number): string {
  // Business amounts need integer VND only. Avoid initializing ICU on a cold
  // Worker just to group digits; preserve the Vietnamese non-breaking space.
  if (Number.isFinite(value) && Math.abs(value) < 1e21) {
    const negative = value < 0 || Object.is(value, -0);
    const digits = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${negative ? "-" : ""}${digits}\u00a0₫`;
  }
  exceptionalFormatter ??= new Intl.NumberFormat("vi-VN", {
    currency: "VND", maximumFractionDigits: 0, style: "currency",
  });
  return exceptionalFormatter.format(value);
}
