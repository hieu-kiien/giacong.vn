import { getServiceFamily } from "../data/service-families.ts";

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
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getContactServiceContext(search: string): string {
  const slug = new URLSearchParams(search).get("service")?.trim() ?? "";
  return getServiceFamily(slug)?.slug ?? "";
}

function safeServiceSlug(value: string): string {
  const slug = value.trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug.slice(0, 80) : "";
}

function getFormServiceContext(form: HTMLFormElement): string {
  const embeddedSlug = form.getAttribute("data-service-context")?.trim() ?? "";
  const formSlug = form.querySelector<HTMLInputElement>('input[name="service"]')?.value.trim() ?? "";
  const querySlug = new URLSearchParams(window.location.search).get("service")?.trim() ?? "";
  return safeServiceSlug(embeddedSlug)
    || safeServiceSlug(formSlug)
    || getContactServiceContext(window.location.search)
    || safeServiceSlug(querySlug);
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

function getFormRequestId(form: HTMLFormElement): string {
  const existing = form.dataset.requestId?.trim() ?? "";
  if (REQUEST_ID_PATTERN.test(existing)) return existing;
  const requestId = crypto.randomUUID();
  form.dataset.requestId = requestId;
  return requestId;
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
  payload.set("request_id", getFormRequestId(form));
  payload.set("message", readControlValue(form, "textarea", 2000));
  payload.set("source", window.location.pathname);
  const service = getFormServiceContext(form);
  if (service) payload.set("service", service);
  const serviceUrl = readControlValue(form, 'input[name="service_url"]', 300)
    || form.getAttribute("data-service-url")?.trim().slice(0, 300)
    || (service ? `/thue-gia-cong/${service}/` : "");
  if (serviceUrl) payload.set("service_url", serviceUrl);
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
  if (!form.checkValidity()) {
    setContactFormStatus(form, "invalid", "Vui lòng kiểm tra thông tin đã nhập.");
    return;
  }

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
    delete form.dataset.requestId;
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
    const service = getFormServiceContext(form);
    if (service) {
      const syncServiceContext = () => {
        const serviceField = form.querySelector<HTMLInputElement>('input[name="service"]');
        if (serviceField) {
          serviceField.value = service;
          serviceField.defaultValue = service;
          serviceField.setAttribute("value", service);
        }
        const serviceUrlField = form.querySelector<HTMLInputElement>('input[name="service_url"]');
        if (serviceUrlField && !serviceUrlField.value.trim()) {
          const serviceUrl = `/thue-gia-cong/${service}/`;
          serviceUrlField.value = serviceUrl;
          serviceUrlField.defaultValue = serviceUrl;
          serviceUrlField.setAttribute("value", serviceUrl);
        }
      };
      syncServiceContext();
      queueMicrotask(syncServiceContext);
    }
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
