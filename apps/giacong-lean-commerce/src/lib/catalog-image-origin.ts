const AI_ILLUSTRATION_SKU_PREFIXES = ["B2B-DEMO-", "AI-STG-"] as const;

/** Current staging demo SKUs identify assets created as AI illustrations. */
export function isAiIllustrationProductImage(sku: string, imageUrl: string | null): boolean {
  const normalizedSku = sku.trim().toUpperCase();
  return Boolean(imageUrl?.trim()) && AI_ILLUSTRATION_SKU_PREFIXES.some((prefix) => normalizedSku.startsWith(prefix));
}
