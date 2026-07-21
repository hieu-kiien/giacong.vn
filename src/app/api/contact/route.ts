import {
  getBagistoApiTimeoutMs,
  getBagistoApiUrl,
  BagistoApiConfigurationError,
} from "@/lib/bagisto-api";

interface ContactSubmission {
  email: string;
  message: string;
  name: string;
  phone: string;
  source: string;
}

interface BriefApiResponse {
  data?: {
    reference?: string;
  };
  ok?: boolean;
}

function hasReference(result: BriefApiResponse | null): result is BriefApiResponse & {
  data: { reference: string };
  ok: true;
} {
  return result?.ok === true
    && typeof result.data?.reference === "string"
    && result.data.reference.trim().length > 0;
}

function readField(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseSubmission(formData: FormData): ContactSubmission {
  return {
    email: readField(formData, "email", 254),
    message: readField(formData, "message", 2000),
    name: readField(formData, "name", 120),
    phone: readField(formData, "phone", 24),
    source: readField(formData, "source", 200),
  };
}

function validateSubmission(submission: ContactSubmission) {
  const errors: Partial<Record<keyof ContactSubmission, string>> = {};
  const normalizedPhone = submission.phone.replace(/[\s().-]/g, "");

  if (submission.name.length < 2) {
    errors.name = "Vui lòng nhập họ và tên.";
  }
  if (!/^\+?\d{8,15}$/.test(normalizedPhone)) {
    errors.phone = "Số điện thoại không hợp lệ.";
  }
  if (
    submission.email
    && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)
  ) {
    errors.email = "Địa chỉ email không hợp lệ.";
  }

  return errors;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { ok: false, message: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const submission = parseSubmission(formData);
  const errors = validateSubmission(submission);
  if (Object.keys(errors).length > 0) {
    return Response.json(
      {
        ok: false,
        message: "Vui lòng kiểm tra lại thông tin liên hệ.",
        errors,
      },
      { status: 400 },
    );
  }

  let bagistoApiUrl: URL;
  try {
    bagistoApiUrl = getBagistoApiUrl("/api/b2b/briefs");
  } catch (error) {
    if (!(error instanceof BagistoApiConfigurationError)) throw error;
    return Response.json(
      { ok: false, message: "Dịch vụ tiếp nhận yêu cầu chưa được cấu hình." },
      { status: 503 },
    );
  }

  const payload = new FormData();
  Object.entries(submission).forEach(([key, value]) => payload.set(key, value));

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), getBagistoApiTimeoutMs());
  let response: Response;
  let result: BriefApiResponse | null;
  try {
    response = await fetch(bagistoApiUrl, {
      body: payload,
      cache: "no-store",
      headers: { Accept: "application/json" },
      method: "POST",
      redirect: "error",
      signal: timeoutController.signal,
    });
    try {
      result = await response.json() as BriefApiResponse;
    } catch (error) {
      if (timeoutController.signal.aborted) throw error;
      result = null;
    }
  } catch {
    return Response.json(
      {
        ok: false,
        message: timeoutController.signal.aborted
          ? "Dịch vụ tiếp nhận yêu cầu phản hồi quá chậm."
          : "Không thể kết nối dịch vụ tiếp nhận yêu cầu.",
      },
      { status: timeoutController.signal.aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return Response.json(
      {
        ok: false,
        message: "Không thể tiếp nhận yêu cầu. Vui lòng thử lại.",
      },
      { status: response.status >= 400 && response.status < 500 ? response.status : 502 },
    );
  }

  if (!hasReference(result)) {
    return Response.json(
      { ok: false, message: "Dịch vụ tiếp nhận yêu cầu trả về dữ liệu không hợp lệ." },
      { status: 502 },
    );
  }

  return Response.json(
    {
      ok: true,
      message: "Yêu cầu của bạn đã được tiếp nhận.",
      reference: result.data.reference,
    },
    {
      headers: { "Cache-Control": "no-store" },
      status: 202,
    },
  );
}
