// This module intentionally has no framework dependency for Node behavior tests.
export interface ContactWebhookDependencies {
  environment: Readonly<Record<string, string | undefined>>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

interface ContactSubmission {
  email: string;
  message: string;
  name: string;
  phone: string;
  source: string;
}

interface WebhookResponse {
  ok: true;
  reference: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;
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
    source: readField(formData, "source", 200),
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
  const errors = validateSubmission(submission);
  if (Object.keys(errors).length > 0) {
    return Response.json(
      { ok: false, message: "Vui lòng kiểm tra lại thông tin liên hệ.", errors },
      { status: 400 },
    );
  }

  const environment = dependencies.environment;
  const url = webhookUrl(environment.GOOGLE_SHEETS_WEBHOOK_URL);
  if (!url) {
    return failure("Dịch vụ tiếp nhận yêu cầu chưa được cấu hình.", 503);
  }

  const payload: ContactSubmission & { secret?: string } = { ...submission };
  const secret = environment.GOOGLE_SHEETS_WEBHOOK_SECRET?.trim();
  if (secret) payload.secret = secret;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const response = await (dependencies.fetch ?? globalThis.fetch)(url, {
      body: JSON.stringify(payload),
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok || !hasJsonContentType(response)) {
      return failure("Không thể tiếp nhận yêu cầu. Vui lòng thử lại.", 502);
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
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
