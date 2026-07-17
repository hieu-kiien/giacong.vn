interface ContactSubmission {
  email: string;
  message: string;
  name: string;
  phone: string;
  source: string;
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

  const reference = [
    "MOCK",
    Date.now().toString(36).toUpperCase(),
    crypto.randomUUID().slice(0, 8).toUpperCase(),
  ].join("-");

  return Response.json(
    {
      ok: true,
      message: "Yêu cầu của bạn đã được tiếp nhận.",
      reference,
    },
    {
      headers: { "Cache-Control": "no-store" },
      status: 202,
    },
  );
}
