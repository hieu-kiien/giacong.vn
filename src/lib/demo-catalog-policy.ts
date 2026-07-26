export interface DemoCatalogFallbackEnvironment {
  CATALOG_DEMO_FALLBACK?: string | undefined;
  NODE_ENV?: string | undefined;
}

/**
 * Demo catalog data is a development aid, never a production recovery path.
 * Outside production it is enabled by default and may be explicitly disabled.
 */
export function demoCatalogFallbackAllowed(
  environment: DemoCatalogFallbackEnvironment,
): boolean {
  if (environment.NODE_ENV === "production") return false;

  const optIn = environment.CATALOG_DEMO_FALLBACK?.trim().toLowerCase();
  return optIn !== "0" && optIn !== "false";
}
