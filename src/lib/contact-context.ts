export function contactContextFromSearch(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const product = params.get("product")?.trim();
  const variant = params.get("variant_sku")?.trim();
  const qty = params.get("quantity")?.trim();
  return product && variant && qty ? { product, qty, variant } : {};
}
