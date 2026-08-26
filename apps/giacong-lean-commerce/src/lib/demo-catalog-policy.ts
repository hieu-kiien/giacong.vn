export interface DemoCatalogFallbackEnvironment {
  CATALOG_DEMO_FALLBACK?: string | undefined;
  NODE_ENV?: string | undefined;
}

/** The demo should show its labelled fixture promptly when the local feed is absent. */
const DEMO_CATALOG_UPSTREAM_TIMEOUT_MS = 650;

export class DemoCatalogFallbackTimeoutError extends Error {
  constructor() {
    super("Dữ liệu danh mục chưa phản hồi trong thời gian xem demo.");
    this.name = "DemoCatalogFallbackTimeoutError";
  }
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

/**
 * Keeps an explicit, complete catalogue available for local presentation while the
 * Cloudflare D1 catalogue is unavailable locally. Production can never enable it.
 */
export function demoCatalogForced(environment: DemoCatalogFallbackEnvironment): boolean {
  if (!demoCatalogFallbackAllowed(environment)) return false;
  return environment.CATALOG_DEMO_FALLBACK?.trim().toLowerCase() === "force";
}

/**
 * Starts the live request immediately but stops awaiting it in non-production
 * once the labelled demo fallback is allowed. Production always awaits the
 * source of truth using its normal transport timeout.
 */
export function waitForDemoCatalogFallback<T>(
  operation: Promise<T>,
  environment: DemoCatalogFallbackEnvironment,
  timeoutMs = DEMO_CATALOG_UPSTREAM_TIMEOUT_MS,
): Promise<T> {
  if (!demoCatalogFallbackAllowed(environment)) return operation;

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new DemoCatalogFallbackTimeoutError()), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
