export interface AdminSession {
  authenticated: boolean;
  subject: string;
  role?: string;
}

export type AdminSiteSettingType = "text" | "multiline" | "url" | "image" | "color";
export type AdminSiteSettingGroup = "brand" | "seo" | "home" | "contact" | "footer";

export interface AdminSiteSetting {
  key: string;
  group: AdminSiteSettingGroup;
  label: string;
  description: string;
  type: AdminSiteSettingType;
  draftValue: string;
  publishedValue: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
  dirty: boolean;
}

export interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  categoryId: number | null;
  categoryName: string | null;
  shortDescription: string;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  status: string;
  leadTimeDays: number | null;
  revision: number;
  updatedAt: string | null;
}

export interface AdminTierPrice {
  currency: "VND";
  id: number;
  minQuantity: number;
  price: number;
}

export interface AdminProductVariant {
  attributeCode: string;
  attributeId: number;
  attributeLabel: string;
  contactFromQuantity: number;
  id: number;
  imageUrl: string | null;
  isAvailable: boolean;
  moq: number;
  name: string;
  optionId: number;
  optionLabel: string;
  productId: number;
  quantityStep: number;
  revision: number;
  sku: string;
  sortOrder: number;
  tierPrices: AdminTierPrice[];
  unit: string;
}

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
}

export interface AdminService {
  id: number;
  name: string;
  slug: string;
  summary: string;
  description: string;
  isActive: boolean;
  status: string;
  leadTimeDays: number | null;
  moqSummary: string | null;
  revision: number;
  updatedAt: string | null;
}

export type LeadStatus =
  | "new"
  | "qualified"
  | "contacted"
  | "quotation_sent"
  | "sampling"
  | "negotiation"
  | "won"
  | "lost"
  | "spam";

export interface AdminLead {
  id: string;
  status: LeadStatus;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  message: string | null;
  source: string;
  deliveryStatus: "pending" | "queued" | "delivered" | "failed";
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AdminClientError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AdminClientError";
    this.status = status;
    this.code = code;
  }
}

const productRevisionCache = new Map<number, number>();
const serviceRevisionCache = new Map<number, number>();

export async function fetchAdmin<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminClientError("Không thể kết nối tới máy chủ admin.", 0, "NETWORK_ERROR");
  }

  let body: { ok?: boolean; data?: T; code?: string; message?: string };
  try {
    body = await response.json();
  } catch {
    throw new AdminClientError("Máy chủ trả về dữ liệu không hợp lệ.", response.status);
  }

  if (!response.ok || body.ok === false || !body.data) {
    throw new AdminClientError(
      body.message ?? "Không thể tải dữ liệu admin.",
      response.status,
      body.code,
    );
  }
  rememberRevisionTokens(body.data);
  return body.data;
}

export async function mutateAdmin<T>(
  path: string,
  options: { body?: unknown; method: "DELETE" | "PATCH" | "POST" },
): Promise<T> {
  const productId = productMutationId(path);
  const serviceId = serviceMutationId(path);
  let requestBody = withCachedProductRevision(productId, options.method, options.body);
  requestBody = withCachedServiceRevision(serviceId, options.method, requestBody);

  let response: Response;
  try {
    response = await fetch(path, {
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(requestBody === undefined ? {} : { "Content-Type": "application/json" }),
      },
      method: options.method,
    });
  } catch {
    throw new AdminClientError("Không thể kết nối tới máy chủ admin.", 0, "NETWORK_ERROR");
  }

  let body: { ok?: boolean; data?: T; code?: string; message?: string };
  try {
    body = await response.json();
  } catch {
    throw new AdminClientError("Máy chủ trả về dữ liệu không hợp lệ.", response.status);
  }
  if (!response.ok || body.ok === false || !body.data) {
    if (body.code === "STALE_WRITE") {
      if (productId !== null) productRevisionCache.delete(productId);
      if (serviceId !== null) serviceRevisionCache.delete(serviceId);
    }
    throw new AdminClientError(
      body.message ?? "Không thể lưu thay đổi admin.",
      response.status,
      body.code,
    );
  }
  rememberRevisionTokens(body.data);
  return body.data;
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";
}

function productMutationId(path: string): number | null {
  const match = /^\/api\/admin\/products\/(\d+)$/.exec(path);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function withCachedProductRevision(
  productId: number | null,
  method: "DELETE" | "PATCH" | "POST",
  body: unknown,
): unknown {
  return withCachedRevision(productRevisionCache, productId, method, body);
}

function serviceMutationId(path: string): number | null {
  const match = /^\/api\/admin\/services\/(\d+)$/.exec(path);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function withCachedServiceRevision(
  serviceId: number | null,
  method: "DELETE" | "PATCH" | "POST",
  body: unknown,
): unknown {
  return withCachedRevision(serviceRevisionCache, serviceId, method, body);
}

function withCachedRevision(
  cache: Map<number, number>,
  entityId: number | null,
  method: "DELETE" | "PATCH" | "POST",
  body: unknown,
): unknown {
  if (entityId === null || (method !== "PATCH" && method !== "DELETE")) return body;
  const revision = cache.get(entityId);
  if (!revision) return body;
  if (isRecord(body)) {
    return Object.prototype.hasOwnProperty.call(body, "revision") ? body : { ...body, revision };
  }
  return body === undefined ? { revision } : body;
}

function rememberRevisionTokens(value: unknown): void {
  if (!isRecord(value)) return;
  rememberRevision(productRevisionCache, value.product);
  rememberRevision(serviceRevisionCache, value.service);
  if (Array.isArray(value.products)) {
    for (const product of value.products) rememberRevision(productRevisionCache, product);
  }
  if (Array.isArray(value.services)) {
    for (const service of value.services) rememberRevision(serviceRevisionCache, service);
  }
}

function rememberRevision(cache: Map<number, number>, value: unknown): void {
  if (!isRecord(value)) return;
  const id = value.id;
  const revision = value.revision;
  if (
    typeof id === "number"
    && Number.isInteger(id)
    && id > 0
    && typeof revision === "number"
    && Number.isInteger(revision)
    && revision > 0
  ) {
    cache.set(id, revision);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
