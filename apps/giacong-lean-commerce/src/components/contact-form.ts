interface ContactApiResponse {
  message?: string;
  ok?: boolean;
  reference?: string;
}

const formStatuses = [
  "failed",
  "init",
  "invalid",
  "sent",
  "submitting",
] as const;

const APPROVED_SERVICE_SLUG = "say-thuc-pham-say";

export function getContactServiceContext(search: string): string {
  return new URLSearchParams(search).get("service") === APPROVED_SERVICE_SLUG
    ? APPROVED_SERVICE_SLUG
    : "";
}

function readControlValue(
  form: HTMLFormElement,
  selector: string,
  maxLength: number,
) {
  const control = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    selector,
  );
  return control?.value.trim().slice(0, maxLength) ?? "";
}

function createContactPayload(form: HTMLFormElement) {
  const payload = new FormData();
  payload.set(
    "name",
    readControlValue(
      form,
      'input[type="text"]:not([name^="_"])',
      120,
    ),
  );
  payload.set("phone", readControlValue(form, 'input[type="tel"]', 24));
  payload.set("email", readControlValue(form, 'input[type="email"]', 254));
  payload.set("message", readControlValue(form, "textarea", 2000));
  payload.set("source", window.location.pathname);
  const service = getContactServiceContext(window.location.search);
  if (service) payload.set("service", service);
  return payload;
}

function setContactFormStatus(
  form: HTMLFormElement,
  status: (typeof formStatuses)[number],
  message: string,
) {
  formStatuses.forEach((formStatus) => form.classList.remove(formStatus));
  form.classList.add(status);
  form.dataset.status = status;
  const response = form.querySelector<HTMLElement>(".wpcf7-response-output");
  if (!response) return;
  response.setAttribute("aria-hidden", status === "submitting" ? "true" : "false");
  response.setAttribute("aria-live", "polite");
  response.setAttribute("role", "status");
  response.textContent = message;
}

async function submitContactForm(event: Event) {
  const form = event.currentTarget as HTMLFormElement;
  event.preventDefault();
  if (form.dataset.status === "submitting") return;

  const submit = form.querySelector<HTMLInputElement | HTMLButtonElement>(
    '[type="submit"]',
  );
  const originalLabel = submit instanceof HTMLInputElement
    ? submit.value
    : submit?.textContent ?? "";
  if (submit) submit.disabled = true;
  if (submit instanceof HTMLInputElement) {
    submit.value = "Đang gửi...";
  } else if (submit) {
    submit.textContent = "Đang gửi...";
  }
  form.setAttribute("aria-busy", "true");
  setContactFormStatus(form, "submitting", "");

  try {
    const response = await fetch("/api/contact", {
      body: createContactPayload(form),
      method: "POST",
    });
    const result = await response.json() as ContactApiResponse;
    if (!response.ok || !result.ok) {
      setContactFormStatus(
        form,
        response.status === 400 || response.status === 422 ? "invalid" : "failed",
        result.message ?? "Không thể gửi yêu cầu. Vui lòng thử lại.",
      );
      return;
    }

    const reference = result.reference ? ` Mã: ${result.reference}.` : "";
    setContactFormStatus(
      form,
      "sent",
      `${result.message ?? "Yêu cầu của bạn đã được tiếp nhận."}${reference}`,
    );
    form.reset();
  } catch {
    setContactFormStatus(
      form,
      "failed",
      "Không thể kết nối máy chủ. Vui lòng thử lại sau.",
    );
  } finally {
    form.removeAttribute("aria-busy");
    if (submit) submit.disabled = false;
    if (submit instanceof HTMLInputElement) {
      submit.value = originalLabel;
    } else if (submit) {
      submit.textContent = originalLabel;
    }
  }
}

export function connectContactForms() {
  const forms = Array.from(
    document.querySelectorAll<HTMLFormElement>(".wpcf7-form"),
  );
  const originalAttributes = forms.map((form) => ({
    action: form.getAttribute("action"),
    method: form.getAttribute("method"),
  }));

  forms.forEach((form) => {
    form.action = "/api/contact";
    form.method = "post";
    form.addEventListener("submit", submitContactForm);
  });

  return () => {
    forms.forEach((form, index) => {
      form.removeEventListener("submit", submitContactForm);
      const original = originalAttributes[index];
      if (original.action === null) form.removeAttribute("action");
      else form.setAttribute("action", original.action);
      if (original.method === null) form.removeAttribute("method");
      else form.setAttribute("method", original.method);
    });
  };
}
