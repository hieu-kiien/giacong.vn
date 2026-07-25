import "server-only";

const DEFAULT_BASE = "http://127.0.0.1:18001/api/b2b/admin/v1";
const MAX_JSON_BYTES = 1_000_000;
export const MAX_COMMERCIAL_RULES_BYTES = 262_144;
const TIMEOUT_MS = 5_000;

export class AdminBffError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfter?: string,
  ) {
    super(code);
  }
}

type AdminOperation =
  | "session"
  | "logout"
  | "two-factor"
  | "me"
  | "dashboard"
  | "products"
  | "product"
  | "commercial-rules";

type AdminMethod = "GET" | "POST" | "PUT" | "DELETE";

const operations: Record<AdminOperation, { method: AdminMethod; path: string; csrf: boolean }> = {
  session: { method: "POST", path: "/session", csrf: true },
  logout: { method: "DELETE", path: "/session", csrf: true },
  "two-factor": { method: "POST", path: "/two-factor", csrf: true },
  me: { method: "GET", path: "/me", csrf: false },
  dashboard: { method: "GET", path: "/dashboard", csrf: false },
  products: { method: "GET", path: "/product-aggregates", csrf: false },
  product: { method: "GET", path: "/product-aggregates", csrf: false },
  "commercial-rules": { method: "PUT", path: "/product-aggregates", csrf: true },
};

export interface AdminUpstreamResult {
  status: number;
  payload: unknown;
  setCookies: string[];
  retryAfter?: string;
  etag?: string;
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new AdminBffError(403, "invalid_origin");
  try {
    const source = new URL(request.url);
    const claimed = new URL(origin);
    if (claimed.host !== host || claimed.protocol !== source.protocol || source.host !== host) {
      throw new AdminBffError(403, "invalid_origin");
    }
  } catch (error) {
    if (error instanceof AdminBffError) throw error;
    throw new AdminBffError(403, "invalid_origin");
  }
}

export function parseExactJson(
  request: Request,
  keys: readonly string[],
  maximumBytes = MAX_JSON_BYTES,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const length = Number(request.headers.get("content-length"));
  if (!isJsonMediaType(contentType) || (Number.isFinite(length) && length > maximumBytes)) {
    return Promise.reject(new AdminBffError(422, "validation_failed"));
  }
  return readBody(request.body, 422, maximumBytes).then((body) => {
    let value: unknown;
    try {
      value = JSON.parse(body) as unknown;
    } catch {
      throw new AdminBffError(422, "validation_failed");
    }
    if (!isRecord(value) || Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) {
      throw new AdminBffError(422, "validation_failed");
    }
    return value;
  }).catch((error: unknown) => {
    if (error instanceof AdminBffError) throw error;
    throw new AdminBffError(422, "validation_failed");
  });
}

export function safeText(value: unknown, max = 255): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new AdminBffError(422, "validation_failed");
  }
  return value.trim();
}

export function safePassword(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 255) {
    throw new AdminBffError(422, "validation_failed");
  }
  return value;
}

export async function callAdminApi(
  request: Request,
  operation: AdminOperation,
  options: {
    body?: unknown;
    query?: URLSearchParams;
    slug?: string;
    bootstrap?: boolean;
    ifMatch?: string;
  } = {},
): Promise<AdminUpstreamResult> {
  const spec = operations[operation];
  const incomingCookie = allowedCookieHeader(request.headers.get("cookie") ?? "");
  if (incomingCookie.length > 16_384 || /[\r\n]/.test(incomingCookie)) {
    throw new AdminBffError(400, "invalid_request");
  }
  let cookie = incomingCookie;
  const cookies: string[] = [];
  if (options.bootstrap && !xsrf(cookie)) {
    const bootstrap = await fetchAdmin("/me", "GET", cookie);
    cookies.push(...bootstrap.setCookies);
    cookie = cookieJar(cookie, bootstrap.setCookies);
  }
  let path = spec.path;
  if (operation === "product" || operation === "commercial-rules") {
    if (!options.slug || !/^[a-z0-9][a-z0-9-]{0,190}$/i.test(options.slug)) {
      throw new AdminBffError(404, "not_found");
    }
    path = `${path}/${encodeURIComponent(options.slug)}`;
    if (operation === "commercial-rules") path += "/commercial-rules";
  }
  const result = await fetchAdmin(
    path,
    spec.method,
    cookie,
    options.body,
    options.query,
    spec.csrf,
    options.ifMatch,
  );
  return { ...result, setCookies: [...cookies, ...result.setCookies] };
}

async function fetchAdmin(
  path: string,
  method: AdminMethod,
  cookie: string,
  body?: unknown,
  query?: URLSearchParams,
  csrf = false,
  ifMatch?: string,
): Promise<AdminUpstreamResult> {
  const url = baseUrl();
  url.pathname += path;
  if (query) url.search = query.toString();
  const headers = new Headers({ Accept: "application/json" });
  if (cookie) headers.set("Cookie", cookie);
  if (csrf) {
    const token = xsrf(cookie);
    if (!token) throw new AdminBffError(419, "session_expired");
    headers.set("X-XSRF-TOKEN", token);
  }
  if (ifMatch) {
    if (!isStrongEtag(ifMatch)) throw new AdminBffError(422, "validation_failed");
    headers.set("If-Match", ifMatch);
  }
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    const setCookies = responseCookies(response);
    const retryAfter = response.headers.get("retry-after") ?? undefined;
    const rawEtag = response.headers.get("etag");
    const etag = rawEtag && isStrongEtag(rawEtag) ? rawEtag : undefined;
    if (response.status === 204) return { status: 204, payload: null, setCookies, retryAfter, etag };
    const payload = await responseJson(response);
    return { status: response.status, payload, setCookies, retryAfter, etag };
  } catch (error) {
    if (controller.signal.aborted) throw new AdminBffError(504, "upstream_timeout");
    if (error instanceof AdminBffError) throw error;
    throw new AdminBffError(502, "upstream_unavailable");
  } finally {
    clearTimeout(timer);
  }
}

function baseUrl(): URL {
  const configured = process.env.BAGISTO_ADMIN_API_URL?.trim() || DEFAULT_BASE;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new AdminBffError(502, "upstream_unavailable");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (
    (!loopback && url.protocol !== "https:")
    || (loopback && !/^https?:$/.test(url.protocol))
    || url.username
    || url.password
    || url.search
    || url.hash
    || url.pathname !== "/api/b2b/admin/v1"
  ) {
    throw new AdminBffError(502, "upstream_unavailable");
  }
  return url;
}

async function responseJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length"));
  if (
    !isJsonMediaType(response.headers.get("content-type")?.toLowerCase() ?? "")
    || (Number.isFinite(length) && length > MAX_JSON_BYTES)
  ) {
    throw new AdminBffError(502, "upstream_unavailable");
  }
  const body = await readBody(response.body);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AdminBffError(502, "upstream_unavailable");
  }
}

function responseCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.()
    ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie") as string] : []);
  return values.filter((value) => {
    const name = value.split("=", 1)[0];
    return value.length <= 4096 && !/[\r\n]/.test(value) && allowedCookieNames().has(name);
  });
}

function cookieJar(incoming: string, setCookies: string[]): string {
  const jar = new Map<string, string>();
  for (const part of incoming.split(";")) {
    const index = part.indexOf("=");
    if (index > 0) jar.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  for (const cookie of setCookies) {
    const first = cookie.split(";", 1)[0];
    const index = first.indexOf("=");
    if (index > 0) jar.set(first.slice(0, index).trim(), first.slice(index + 1).trim());
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function allowedCookieHeader(header: string): string {
  if (header.length > 16_384 || /[\r\n]/.test(header)) {
    throw new AdminBffError(400, "invalid_request");
  }
  const allowed = allowedCookieNames();
  return header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => allowed.has(part.split("=", 1)[0]))
    .join("; ");
}

function allowedCookieNames(): Set<string> {
  return new Set(["XSRF-TOKEN", sessionCookieName()]);
}

function sessionCookieName(): string {
  const configured = process.env.BAGISTO_ADMIN_SESSION_COOKIE?.trim() || "laravel_session";
  return /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/.test(configured) ? configured : "laravel_session";
}

function xsrf(cookie: string): string | null {
  const encoded = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("XSRF-TOKEN="))
    ?.slice("XSRF-TOKEN=".length);
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(encoded);
    return decoded && !/[\r\n]/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

async function readBody(
  body: ReadableStream<Uint8Array> | null,
  failureStatus = 502,
  maximumBytes = MAX_JSON_BYTES,
): Promise<string> {
  const code = failureStatus === 422 ? "validation_failed" : "upstream_unavailable";
  if (!body) throw new AdminBffError(failureStatus, code);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new AdminBffError(failureStatus, code);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function isJsonMediaType(value: string): boolean {
  return /^application\/json(?:\s*;\s*charset=(?:utf-8|utf8))?$/i.test(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStrongEtag(value: string): boolean {
  return /^"[a-f0-9]{64}"$/.test(value);
}
