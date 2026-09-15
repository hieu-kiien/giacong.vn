export interface AdminSession {
  authenticated: boolean;
  memberId?: string;
  subject: string;
  role: string;
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
  effectiveValue: string;
  isDefaultValue: boolean;
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
  minimumOrderQuantity: number | null;
  revision: number;
  startingPrice: number | null;
  variantCount: number | null;
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
  imageUrl: string | null;
  isActive: boolean;
  status: string;
  leadTimeDays: number | null;
  moqSummary: string | null;
  offerings?: Array<{ href: string; label: string }>;
  ctaLabel?: string;
  ctaHref?: string;
  sortOrder?: number;
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
  revision: number;
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
  publicReference?: string | null;
  webhookReference?: string | null;
  deliveryError?: string | null;
  deliveryAttempts?: number;
  deliveredAt?: string | null;
}

export class AdminClientError extends Error {
  readonly code?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly status: number;

  constructor(message: string, status: number, code?: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AdminClientError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

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

  let body: { fieldErrors?: Record<string, string>; ok?: boolean; data?: T; code?: string; message?: string };
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
  return body.data;
}

export async function mutateAdmin<T>(
  path: string,
  options: { body?: unknown; method: "DELETE" | "PATCH" | "POST" },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      method: options.method,
    });
  } catch {
    throw new AdminClientError("Không thể kết nối tới máy chủ admin.", 0, "NETWORK_ERROR");
  }

  let body: { fieldErrors?: Record<string, string>; ok?: boolean; data?: T; code?: string; message?: string };
  try {
    body = await response.json();
  } catch {
    throw new AdminClientError("Máy chủ trả về dữ liệu không hợp lệ.", response.status);
  }
  if (!response.ok || body.ok === false || !body.data) {
    throw new AdminClientError(
      body.message ?? "Không thể lưu thay đổi admin.",
      response.status,
      body.code,
      body.fieldErrors,
    );
  }
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
