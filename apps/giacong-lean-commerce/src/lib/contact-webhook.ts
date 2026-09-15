// This module intentionally has no framework dependency for Node behavior tests.
// Relative .ts specifiers keep it loadable under `node --experimental-strip-types`.
import {
  CONTACT_MAX_BODY_BYTES,
  exactKeys,
  isJsonRequest,
  isRecord,
  parseRequestCartLines,
  readJsonBody,
  resolveRequestCart,
} from "./request-cart.ts";
import type { RequestCartLineKey, RequestCartResolver, ResolvedRequestCart } from "../types/request-cart.ts";
import { getServiceFamily } from "../data/service-families.ts";

export interface ContactWebhookDependencies {
  cartBatchResolver?: (lines: RequestCartLineKey[]) => Promise<ResolvedRequestCart>;
  cartResolver?: RequestCartResolver;
  /** Cloudflare Ratelimit binding shape; keyed by client IP. Abuse protection only. */
  contactRateLimiter?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  environment: Readonly<Record<string, string | undefined>>;
  fetch?: typeof globalThis.fetch;
  leadQueue?: ContactLeadQueue;
  leadPersistence?: ContactLeadPersistence;
  productResolver?: ContactProductResolver;
  serviceResolver?: ContactServiceResolver;
  timeoutMs?: number;
}

export type ContactLeadDeliveryStatus = "pending" | "queued" | "delivered" | "failed";

export interface ContactLeadQueue {
  send(message: {
    leadId: string;
    payload: ContactQueuedPayload;
  }): Promise<void>;
}

export interface ContactLeadPersistence {
  create(payload: unknown): Promise<{
    deliveryStatus: ContactLeadDeliveryStatus;
    isDuplicate: boolean;
    leadId: string;
    publicReference: string;
    webhookReference: string | null;
  }>;
  markDelivery(
    leadId: string,
    result: {
      error?: string | null;
      status: ContactLeadDeliveryStatus;
      webhookReference?: string | null;
    },
  ): Promise<void>;
}

export interface ContactProductResolution {
  name: string;
  variants: ContactProductVariantResolution[];
}

export interface ContactProductVariantResolution {
  contactFromQuantity: number;
  isAvailable: boolean;
  label: string;
  minimumOrderQuantity: number;
  quantityStep: number;
  sku: string;
}

export interface ContactServiceResolution {
  name: string;
  slug: string;
}

export type ContactServiceResolver = (slug: string) => Promise<ContactServiceResolution | null>;

export type ContactProductResolver = (slug: string) => Promise<ContactProductResolution | null>;

type ContactRequestType = "Đặt sản phẩm" | "Tư vấn số lượng lớn" | "Tư vấn dịch vụ";

interface ContactSubmission {
  email: string;
  message: string;
  name: string;
  phone: string;
  product: string;
  qty: string;
  service: string;
  serviceUrl: string;
  source: string;
  variant: string;
}

export interface ContactWebhookPayload extends Omit<ContactSubmission, "qty" | "serviceUrl"> {
  qty: number | "";
  /** Stable per-submit key used by D1 and the Apps Script sink for safe retries. */
  request_id: string;
  request_type: ContactRequestType;
  /** Canonical service metadata retained in D1 payload_json; the Sheet keeps the display name in its existing column. */
  service_code?: string;
  service_name?: string;
  service_url?: string;
}

interface ContactCartWebhookLine {
  index: number;
  line_total: number | "";
  note: string;
  product: string;
  qty: number;
  unit: string;
  unit_price: number | "";
  variant: string;
}

export interface ContactCartWebhookPayload extends ContactWebhookPayload {
  cart: ContactCartWebhookLine[];
  cart_price_incomplete: boolean;
  cart_subtotal: number | "";
}

export type ContactQueuedPayload = ContactWebhookPayload | ContactCartWebhookPayload;

interface WebhookResponse {
  ok: true;
  reference: string;
}

// The Apps Script round trip is POST → 302 → GET plus sheet writes; observed
// executions run up to ~5s, so the budget must cover the full chain.
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const ALLOWED_WEBHOOK_HOSTS = new Set([
  "script.google.com",
  "script.googleusercontent.com",
]);
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SNAPSHOT_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function readField(formData: FormData, name: string, maxLength: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseSubmission(formData: FormData): ContactSubmission {
  return {
    email: readField(formData, "email", 254),
    message: readField(formData, "message", 2_000),
    name: readField(formData, "name", 120),
    phone: readField(formData, "phone", 24),
    product: readField(formData, "product", 160),
    qty: readField(formData, "qty", 24),
    service: readField(formData, "service", 80),
    serviceUrl: readField(formData, "service_url", 300),
    source: readField(formData, "source", 200),
    variant: readField(formData, "variant", 160),
  };
}

function validateSubmission(
  submission: ContactSubmission,
  requireEmail = false,
): Partial<Record<keyof ContactSubmission, string>> {
  const errors: Partial<Record<keyof ContactSubmission, string>> = {};
  const normalizedPhone = submission.phone.replace(/[\s().-]/g, "");

  if (submission.name.length < 2) {
    errors.name = "Vui lòng nhập họ và tên.";
  }
  if (!/^\+?\d{8,15}$/.test(normalizedPhone)) {
    errors.phone = "Số điện thoại không hợp lệ.";
  }
  if (requireEmail && !submission.email) {
    errors.email = "Vui lòng nhập địa chỉ email.";
  } else if (submission.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) {
    errors.email = "Địa chỉ email không hợp lệ.";
  }

  return errors;
}

function hasProductContext(submission: ContactSubmission): boolean {
  return Boolean(submission.product || submission.variant || submission.qty);
}

function validateContext(
  submission: ContactSubmission,
  serviceContext: ContactServiceResolution | null,
): Partial<Record<keyof ContactSubmission, string>> {
  const errors: Partial<Record<keyof ContactSubmission, string>> = {};
  const productContext = hasProductContext(submission);

  if (productContext && submission.service) {
    errors.product = "Chỉ được gửi một ngữ cảnh sản phẩm hoặc dịch vụ.";
    errors.service = "Chỉ được gửi một ngữ cảnh sản phẩm hoặc dịch vụ.";
    return errors;
  }

  if (productContext) {
    if (!submission.product) errors.product = "Vui lòng chọn sản phẩm.";
    if (!submission.variant) errors.variant = "Vui lòng chọn biến thể.";
    if (!submission.qty) {
      errors.qty = "Vui lòng nhập số lượng.";
    } else if (!/^[1-9]\d*$/.test(submission.qty) || !Number.isSafeInteger(Number(submission.qty))) {
      errors.qty = "Số lượng phải là số nguyên dương.";
    }
    return errors;
  }

  if (submission.service && !serviceContext) {
    errors.service = "Dịch vụ không hợp lệ.";
  }
  return errors;
}

function validationFailure(errors: Partial<Record<keyof ContactSubmission, string>>): Response {
  return Response.json(
    { ok: false, message: "Vui lòng kiểm tra lại thông tin liên hệ.", errors },
    { status: 400 },
  );
}

function webhookUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:"
      || !ALLOWED_WEBHOOK_HOSTS.has(url.hostname)
      || url.username
      || url.password
      || url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function redirectUrl(location: string | null, currentUrl: URL): URL | null {
  if (!location) return null;
  try {
    return webhookUrl(new URL(location, currentUrl).toString());
  } catch {
    return null;
  }
}

function validWebhookResponse(value: unknown): value is WebhookResponse {
  if (!isRecord(value) || Object.keys(value).length !== 2) return false;
  return value.ok === true
    && typeof value.reference === "string"
    && value.reference.trim().length > 0;
}

function hasJsonContentType(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.trim() ?? "";
  return /^application\/json(?:\s*;\s*charset=(?:utf-8|utf8))?$/i.test(contentType);
}

function failure(message: string, status: number): Response {
  return Response.json({ ok: false, message }, { status });
}

async function resolvePayload(
  submission: ContactSubmission,
  productResolver: ContactProductResolver | undefined,
  serviceContext: ContactServiceResolution | null,
  requestId: string,
): Promise<ContactWebhookPayload | Response> {
  const { serviceUrl, ...fields } = submission;
  if (!hasProductContext(submission)) {
    return {
      ...fields,
      product: "",
      qty: "",
      request_id: requestId,
      request_type: "Tư vấn dịch vụ",
      // The Apps Script contract rejects "Tư vấn dịch vụ" with an empty
      // service, so a generic contact carries an explicit catch-all label.
      service: serviceContext?.name ?? "Liên hệ chung",
      ...(serviceContext ? {
        service_code: serviceContext.slug,
        service_name: serviceContext.name,
        service_url: serviceUrl || submission.source,
      } : {}),
      variant: "",
    };
  }

  if (!productResolver) {
    return failure("Không thể xác thực sản phẩm. Vui lòng thử lại.", 502);
  }

  let product: ContactProductResolution | null;
  try {
    product = await productResolver(submission.product);
  } catch {
    return failure("Không thể xác thực sản phẩm. Vui lòng thử lại.", 502);
  }
  if (!product) return validationFailure({ product: "Sản phẩm không tồn tại." });

  const variant = product.variants.find((item) => item.sku === submission.variant);
  if (!variant) return validationFailure({ variant: "Biến thể không hợp lệ." });
  if (!variant.isAvailable) return validationFailure({ variant: "Biến thể hiện không khả dụng." });

  const qty = Number(submission.qty);
  if (qty < variant.minimumOrderQuantity) {
    return validationFailure({ qty: "Số lượng chưa đạt mức tối thiểu." });
  }
  if ((qty - variant.minimumOrderQuantity) % variant.quantityStep !== 0) {
    return validationFailure({ qty: "Số lượng không đúng bước đặt hàng." });
  }

  return {
    ...fields,
    product: product.name,
    qty,
    request_id: requestId,
    request_type: qty >= variant.contactFromQuantity ? "Tư vấn số lượng lớn" : "Đặt sản phẩm",
    service: "",
    variant: variant.label,
  };
}

async function readJsonBeforeTimeout(response: Response, signal: AbortSignal): Promise<unknown> {
  let removeAbortListener = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    const abort = () => reject(new Error("webhook_timeout"));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", abort);
  });
  try {
    return await Promise.race([response.json(), aborted]);
  } finally {
    removeAbortListener();
  }
}

/**
 * Cost/abuse protection for the public intake. Fails open: an unavailable limiter
 * must never block a legitimate request, and the limiter is never a business invariant.
 */
async function checkContactRateLimit(
  request: Request,
  limiter?: ContactWebhookDependencies["contactRateLimiter"],
): Promise<Response | null> {
  if (!limiter) return null;
  const key = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  let success: boolean;
  try {
    ({ success } = await limiter.limit({ key }));
  } catch (error) {
    console.error("[contact] rate limiter unavailable; failing open", error);
    return null;
  }
  if (success) return null;
  return Response.json(
    { message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.", ok: false },
    { headers: { "Cache-Control": "no-store", "Retry-After": "60" }, status: 429 },
  );
}

export async function handleContactSubmission(
  request: Request,
  dependencies: ContactWebhookDependencies,
): Promise<Response> {
  const rateLimited = await checkContactRateLimit(request, dependencies.contactRateLimiter);
  if (rateLimited) return rateLimited;

  const resolved = isJsonRequest(request)
    ? await resolveCartPayload(request, dependencies)
    : await resolveFormPayload(request, dependencies);
  if (resolved instanceof Response) return resolved;

  const leadPersistence = dependencies.leadPersistence;
  let persistedLead: Awaited<ReturnType<NonNullable<ContactWebhookDependencies["leadPersistence"]>["create"]>> | null = null;
  if (leadPersistence) {
    try {
      persistedLead = await leadPersistence.create(resolved);
    } catch {
      return failure("Không thể lưu yêu cầu. Vui lòng thử lại.", 503);
    }
  }

  if (
    persistedLead?.isDuplicate
    && persistedLead.deliveryStatus === "delivered"
  ) {
    return acceptedLeadResponse(
      persistedLead.webhookReference || persistedLead.publicReference,
      persistedLead.deliveryStatus,
    );
  }

  if (persistedLead && dependencies.leadQueue) {
    try {
      await dependencies.leadQueue.send({
        leadId: persistedLead.leadId,
        payload: resolved,
      });
      await leadPersistence?.markDelivery(persistedLead.leadId, {
        status: "queued",
      });
      return acceptedLeadResponse(persistedLead.publicReference, "queued");
    } catch (error) {
      try {
        await leadPersistence?.markDelivery(persistedLead.leadId, {
          error: error instanceof Error ? error.message.slice(0, 500) : "queue_enqueue_failed",
          status: "failed",
        });
      } catch {
        // The durable lead still exists and remains visible for admin repair.
      }
      return acceptedLeadResponse(persistedLead.publicReference, "failed");
    }
  }

  const response = await deliverToWebhook(resolved, dependencies);
  if (!persistedLead || !leadPersistence) return response;

  if (response.ok) {
    const webhookReference = await responseReference(response);
    try {
      await leadPersistence.markDelivery(persistedLead.leadId, {
        status: "delivered",
        webhookReference,
      });
    } catch {
      // The durable lead already exists; a later admin retry can repair delivery metadata.
    }
    return response;
  }

  try {
    await leadPersistence.markDelivery(persistedLead.leadId, {
      error: `secondary_sink_http_${response.status}`,
      status: "failed",
    });
  } catch {
    // Keep the D1-first acceptance response even if the delivery bookkeeping is unavailable.
  }
  return acceptedLeadResponse(persistedLead.publicReference, "failed");
}

async function responseReference(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().json() as { reference?: unknown };
    return typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null;
  } catch {
    return null;
  }
}

function acceptedLeadResponse(reference: string, deliveryStatus: ContactLeadDeliveryStatus): Response {
  return Response.json(
    {
      deliveryStatus,
      message: "Yêu cầu của bạn đã được tiếp nhận.",
      ok: true,
      reference,
    },
    { headers: { "Cache-Control": "no-store" }, status: 202 },
  );
}

async function resolveFormPayload(
  request: Request,
  dependencies: ContactWebhookDependencies,
): Promise<ContactWebhookPayload | Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const submission = parseSubmission(formData);
  const requestId = readField(formData, "request_id", 80);
  if (requestId && !REQUEST_ID_PATTERN.test(requestId)) {
    return failure("Dữ liệu gửi lên không hợp lệ.", 400);
  }
  const serviceContext = submission.service
    ? await resolveServiceContext(submission.service, dependencies.serviceResolver)
    : null;
  const errors = { ...validateSubmission(submission), ...validateContext(submission, serviceContext) };
  if (Object.keys(errors).length > 0) {
    return validationFailure(errors);
  }

  return resolvePayload(submission, dependencies.productResolver, serviceContext, requestId || crypto.randomUUID());
}

async function resolveServiceContext(
  slug: string,
  resolver?: ContactServiceResolver,
): Promise<ContactServiceResolution | null> {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return null;
  if (resolver) {
    try {
      const resolved = await resolver(cleanSlug);
      if (!resolved) return null;
      const normalizedSlug = resolved.slug.trim();
      const normalizedName = resolved.name.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug) || !normalizedName) return null;
      return { name: normalizedName.slice(0, 160), slug: normalizedSlug.slice(0, 160) };
    } catch {
      return null;
    }
  }
  const family = getServiceFamily(cleanSlug);
  return family ? { name: family.name, slug: family.slug } : null;
}

/**
 * Multi-line request cart. The server re-reads the catalog, recomputes unit price and totals,
 * and refuses the submit when the priced state drifted from what the customer approved.
 */
async function resolveCartPayload(
  request: Request,
  dependencies: ContactWebhookDependencies,
): Promise<ContactCartWebhookPayload | Response> {
  const body = await readJsonBody(request, CONTACT_MAX_BODY_BYTES);
  if (!body.ok) return failure(body.message, body.status);

  const payload = body.value;
  if (!isRecord(payload) || !exactKeys(payload, [
    "email", "lines", "message", "name", "phone", "requestId", "snapshotToken", "source",
  ])) {
    return failure("Dữ liệu gửi lên không hợp lệ.", 400);
  }
  if (typeof payload.requestId !== "string" || !REQUEST_ID_PATTERN.test(payload.requestId)) {
    return failure("Dữ liệu gửi lên không hợp lệ.", 400);
  }
  if (typeof payload.snapshotToken !== "string" || !SNAPSHOT_TOKEN_PATTERN.test(payload.snapshotToken)) {
    return failure("Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const parsedLines = parseRequestCartLines(payload.lines);
  if (!parsedLines.ok) return failure(parsedLines.message, 400);

  const submission = parseJsonSubmission(payload);
  const errors = validateSubmission(submission, true);
  if (Object.keys(errors).length > 0) return validationFailure(errors);

  let cart: ResolvedRequestCart;
  try {
    if (dependencies.cartBatchResolver) {
      cart = await dependencies.cartBatchResolver(parsedLines.lines);
    } else if (dependencies.cartResolver) {
      cart = await resolveRequestCart(parsedLines.lines, dependencies.cartResolver);
    } else {
      return failure("Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.", 502);
    }
  } catch {
    return failure("Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.", 502);
  }

  if (!cart.isSubmittable) {
    return cartConflict(
      "Một số dòng trong giỏ chưa hợp lệ. Vui lòng xem lại giỏ yêu cầu.",
      "CART_NOT_SUBMITTABLE",
      cart,
    );
  }
  if (cart.snapshotToken !== payload.snapshotToken) {
    return cartConflict(
      "Giá hoặc tình trạng hàng đã thay đổi. Vui lòng xem lại giỏ yêu cầu.",
      "CART_DRIFTED",
      cart,
    );
  }

  return {
    cart: cart.lines.map((line, index) => ({
      index: index + 1,
      line_total: line.lineTotal ?? "",
      note: line.priceOnRequest ? `SKU ${line.variantSku} · Liên hệ báo giá` : `SKU ${line.variantSku}`,
      product: line.productName,
      qty: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice ?? "",
      variant: line.variantLabel,
    })),
    cart_price_incomplete: cart.hasPriceOnRequest,
    cart_subtotal: cart.pricedSubtotal,
    email: submission.email,
    message: submission.message,
    name: submission.name,
    phone: submission.phone,
    product: `Giỏ hàng (${cart.lineCount} dòng)`,
    qty: "",
    request_id: payload.requestId,
    request_type: cart.requestType,
    service: "",
    source: submission.source,
    variant: "",
  };
}

function parseJsonSubmission(payload: Record<string, unknown>): ContactSubmission {
  return {
    email: readJsonField(payload.email, 254),
    message: readJsonField(payload.message, 2_000),
    name: readJsonField(payload.name, 120),
    phone: readJsonField(payload.phone, 24),
    product: "",
    qty: "",
    service: "",
    serviceUrl: "",
    source: readJsonField(payload.source, 200),
    variant: "",
  };
}

function readJsonField(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cartConflict(message: string, code: string, cart: ResolvedRequestCart): Response {
  return Response.json(
    { cart, code, message, ok: false },
    { headers: { "Cache-Control": "no-store" }, status: 409 },
  );
}

export async function deliverToWebhook(
  resolved: ContactQueuedPayload,
  dependencies: ContactWebhookDependencies,
): Promise<Response> {
  const environment = dependencies.environment;
  const url = webhookUrl(environment.GOOGLE_SHEETS_WEBHOOK_URL);
  if (!url) {
    return failure("Dịch vụ tiếp nhận yêu cầu chưa được cấu hình.", 503);
  }

  const payload: ContactWebhookPayload & { secret?: string } = { ...resolved };
  const secret = environment.GOOGLE_SHEETS_WEBHOOK_SECRET?.trim();
  if (secret) payload.secret = secret;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    let requestUrl = url;
    let requestInit: RequestInit = {
      body: JSON.stringify(payload),
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "POST",
    };

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await (dependencies.fetch ?? globalThis.fetch)(requestUrl, {
        ...requestInit,
        redirect: "manual",
        signal: controller.signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects === MAX_REDIRECTS) {
          return failure("Không thể tiếp nhận yêu cầu. Vui lòng thử lại.", 502);
        }
        const destination = redirectUrl(response.headers.get("location"), requestUrl);
        if (!destination) {
          return failure("Không thể tiếp nhận yêu cầu. Vui lòng thử lại.", 502);
        }
        requestUrl = destination;
        if ([301, 302, 303].includes(response.status)) {
          requestInit = {
            cache: "no-store",
            headers: { Accept: "application/json" },
            method: "GET",
          };
        }
        continue;
      }
      if (!response.ok || !hasJsonContentType(response)) {
        return failure("Không thể tiếp nhận yêu cầu. Vui lòng thử lại.", 502);
      }

      let result: unknown;
      try {
        result = await readJsonBeforeTimeout(response, controller.signal);
      } catch {
        if (controller.signal.aborted) throw new Error("webhook_timeout");
        return failure("Dịch vụ tiếp nhận yêu cầu trả về dữ liệu không hợp lệ.", 502);
      }
      if (!validWebhookResponse(result)) {
        return failure("Dịch vụ tiếp nhận yêu cầu trả về dữ liệu không hợp lệ.", 502);
      }

      return Response.json(
        {
          ok: true,
          message: "Yêu cầu của bạn đã được tiếp nhận.",
          reference: result.reference.trim(),
        },
        { headers: { "Cache-Control": "no-store" }, status: 202 },
      );
    }
    return failure("Không thể tiếp nhận yêu cầu. Vui lòng thử lại.", 502);
  } catch {
    return failure(
      controller.signal.aborted
        ? "Dịch vụ tiếp nhận yêu cầu phản hồi quá chậm."
        : "Không thể kết nối dịch vụ tiếp nhận yêu cầu.",
      controller.signal.aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
