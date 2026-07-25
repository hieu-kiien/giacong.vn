// This module intentionally has no framework dependency for Node behavior tests.
export interface ContactWebhookDependencies {
  environment: Readonly<Record<string, string | undefined>>;
  fetch?: typeof globalThis.fetch;
  productResolver?: ContactProductResolver;
  timeoutMs?: number;
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
  source: string;
  variant: string;
}

interface ContactWebhookPayload extends Omit<ContactSubmission, "qty"> {
  qty: number | "";
  request_type: ContactRequestType;
}

interface WebhookResponse {
  ok: true;
  reference: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const ALLOWED_WEBHOOK_HOSTS = new Set([
  "script.google.com",
  "script.googleusercontent.com",
]);

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
    source: readField(formData, "source", 200),
    variant: readField(formData, "variant", 160),
  };
}

function validateSubmission(submission: ContactSubmission): Partial<Record<keyof ContactSubmission, string>> {
  const errors: Partial<Record<keyof ContactSubmission, string>> = {};
  const normalizedPhone = submission.phone.replace(/[\s().-]/g, "");

  if (submission.name.length < 2) {
    errors.name = "Vui lòng nhập họ và tên.";
  }
  if (!/^\+?\d{8,15}$/.test(normalizedPhone)) {
    errors.phone = "Số điện thoại không hợp lệ.";
  }
  if (submission.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) {
    errors.email = "Địa chỉ email không hợp lệ.";
  }

  return errors;
}

function hasProductContext(submission: ContactSubmission): boolean {
  return Boolean(submission.product || submission.variant || submission.qty);
}

function validateContext(submission: ContactSubmission): Partial<Record<keyof ContactSubmission, string>> {
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

  if (submission.service && submission.service !== "say-thuc-pham-say") {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
): Promise<ContactWebhookPayload | Response> {
  if (!hasProductContext(submission)) {
    return {
      ...submission,
      product: "",
      qty: "",
      request_type: "Tư vấn dịch vụ",
      service: submission.service ? "Sấy & thực phẩm sấy" : "",
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
    ...submission,
    product: product.name,
    qty,
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

export async function handleContactSubmission(
  request: Request,
  dependencies: ContactWebhookDependencies,
): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const submission = parseSubmission(formData);
  const errors = { ...validateSubmission(submission), ...validateContext(submission) };
  if (Object.keys(errors).length > 0) {
    return validationFailure(errors);
  }

  const resolved = await resolvePayload(submission, dependencies.productResolver);
  if (resolved instanceof Response) return resolved;

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
