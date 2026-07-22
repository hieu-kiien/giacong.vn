import "server-only";

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const DEVELOPMENT_DEFAULT_ORIGIN = "http://127.0.0.1:8000";

export class BagistoApiConfigurationError extends Error {
  constructor(message = "BAGISTO_API_URL không hợp lệ.") {
    super(message);
    this.name = "BagistoApiConfigurationError";
  }
}

export class BagistoApiTimeoutError extends Error {
  constructor() {
    super("Dịch vụ Bagisto phản hồi quá chậm.");
    this.name = "BagistoApiTimeoutError";
  }
}

export function getBagistoApiUrl(pathname: string, allowDevelopmentDefault = false): URL {
  const configuredOrigin = process.env.BAGISTO_API_URL?.trim();
  const origin = configuredOrigin || (allowDevelopmentDefault && process.env.NODE_ENV !== "production"
    ? DEVELOPMENT_DEFAULT_ORIGIN
    : "");
  if (!origin) throw new BagistoApiConfigurationError("BAGISTO_API_URL chưa được cấu hình.");

  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    throw new BagistoApiConfigurationError();
  }
  if ((base.protocol !== "http:" && base.protocol !== "https:") || base.username || base.password) {
    throw new BagistoApiConfigurationError();
  }

  return new URL(pathname, base);
}

export function getBagistoApiTimeoutMs(): number {
  const configuredTimeout = Number(process.env.BAGISTO_API_TIMEOUT_MS);
  return Number.isInteger(configuredTimeout) && configuredTimeout >= 100 && configuredTimeout <= MAX_TIMEOUT_MS
    ? configuredTimeout
    : DEFAULT_TIMEOUT_MS;
}

export interface BagistoJsonResponse {
  payload: unknown;
  response: Response;
}

export async function fetchBagistoJson(url: URL, init: RequestInit = {}): Promise<BagistoJsonResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getBagistoApiTimeoutMs());
  try {
    const response = await fetch(url, {
      ...init,
      cache: init.cache ?? "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return { payload: null, response };
    try {
      return { payload: await response.json() as unknown, response };
    } catch {
      throw new SyntaxError("Bagisto trả về JSON không hợp lệ.");
    }
  } catch (error) {
    if (controller.signal.aborted) throw new BagistoApiTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
