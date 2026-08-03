"use client";

import { useEffect, useRef, useState } from "react";

import {
  REQUEST_CART_SUBMIT_ENDPOINT,
  buildSubmitBody,
  createRequestId,
  parseSubmitResponse,
} from "@/lib/request-cart-client";
import type { RequestCartContact, RequestCartField } from "@/lib/request-cart-client";
import { REQUEST_CART_CHANNELS } from "@/lib/request-cart-channels";
import {
  REQUEST_CART_ATTEMPT_SCHEMA_VERSION,
  clearBrowserRequestCartAttempt,
  isRequestCartAttemptFresh,
  readBrowserRequestCartAttempt,
  writeBrowserRequestCartAttempt,
} from "@/lib/request-cart-attempt";
import type { RequestCartAttemptContext } from "@/lib/request-cart-attempt";
import type { ResolvedRequestCart } from "@/types/request-cart";

const SUBMIT_FAILURE_MESSAGE = "Không thể gửi yêu cầu lúc này. Vui lòng thử lại.";

const EMPTY_CONTACT: RequestCartContact = { email: "", message: "", name: "", phone: "" };
const ZALO_CHANNEL = REQUEST_CART_CHANNELS.find((channel) => channel.id === "zalo");
const SMS_CHANNEL = REQUEST_CART_CHANNELS.find((channel) => channel.id === "hotline");

function createRequestCartAttempt(snapshotToken: string): RequestCartAttemptContext {
  return {
    requestId: createRequestId(),
    schemaVersion: REQUEST_CART_ATTEMPT_SCHEMA_VERSION,
    snapshotToken,
    updatedAt: new Date().toISOString(),
  };
}

function loadRequestCartAttempt(snapshotToken: string): RequestCartAttemptContext {
  const existing = readBrowserRequestCartAttempt(snapshotToken);
  if (existing) return existing;

  const created = createRequestCartAttempt(snapshotToken);
  writeBrowserRequestCartAttempt(created);
  return created;
}

interface RequestFormProps {
  cart: ResolvedRequestCart;
  onAccepted: (reference: string) => void;
  onConflict: (cart: ResolvedRequestCart | null) => void;
}

export function RequestForm({ cart, onAccepted, onConflict }: RequestFormProps) {
  const [contact, setContact] = useState<RequestCartContact>(() => ({ ...EMPTY_CONTACT, message: cartMessage(cart) }));
  const [errors, setErrors] = useState<Partial<Record<RequestCartField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [zaloNotice, setZaloNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  const automaticMessage = useRef(cartMessage(cart));
  // One idempotency key per priced state. Retrying the same state reuses it, so a timeout that
  // already reached the Sheet returns the original `Mã` instead of creating a second request.
  // The small context is kept in sessionStorage so a refresh can continue the same safe retry;
  // it contains no contact fields, prices, product details, or private model reasoning.
  const attempt = useRef<RequestCartAttemptContext | null>(null);
  if (attempt.current === null) {
    attempt.current = loadRequestCartAttempt(cart.snapshotToken);
  }

  useEffect(() => {
    if (attempt.current?.snapshotToken !== cart.snapshotToken) {
      attempt.current = loadRequestCartAttempt(cart.snapshotToken);
    }
  }, [cart.snapshotToken]);

  useEffect(() => {
    const nextMessage = cartMessage(cart);
    setContact((current) => current.message === automaticMessage.current
      ? { ...current, message: nextMessage }
      : current);
    automaticMessage.current = nextMessage;
  }, [cart]);

  const update = (field: RequestCartField, value: string) => {
    setContact((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !cart.isSubmittable) return;
    if (
      attempt.current === null
      || !isRequestCartAttemptFresh(attempt.current, cart.snapshotToken)
    ) {
      attempt.current = loadRequestCartAttempt(cart.snapshotToken);
    }
    const currentAttempt = attempt.current;
    if (currentAttempt === null) return;

    const clientErrors: Partial<Record<RequestCartField, string>> = {};
    if (contact.name.trim() === "") clientErrors.name = "Vui lòng nhập họ và tên.";
    if (contact.phone.trim() === "") clientErrors.phone = "Vui lòng nhập số điện thoại.";
    if (contact.email.trim() === "") clientErrors.email = "Vui lòng nhập địa chỉ email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) clientErrors.email = "Địa chỉ email không hợp lệ.";
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError("Vui lòng kiểm tra lại thông tin liên hệ.");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const response = await fetch(REQUEST_CART_SUBMIT_ENDPOINT, {
        body: JSON.stringify(buildSubmitBody({
          contact,
          lines: cart.lines.map((line) => ({
            parentSlug: line.parentSlug,
            quantity: line.quantity,
            variantSku: line.variantSku,
          })),
          requestId: currentAttempt.requestId,
          snapshotToken: cart.snapshotToken,
        })),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = await response.json().catch(() => null);
      const result = parseSubmitResponse(response.status, body);

      if (result.status === "accepted") {
        clearBrowserRequestCartAttempt();
        onAccepted(result.reference);
        return;
      }
      if (result.status === "invalid") {
        setErrors(result.errors);
        setFormError(result.message);
        return;
      }
      if (result.status === "conflict") {
        onConflict(result.cart);
        setFormError(result.message);
        return;
      }
      setFormError(result.message);
    } catch {
      setFormError(SUBMIT_FAILURE_MESSAGE);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const openZalo = async () => {
    const message = contact.message.trim() || cartMessage(cart);
    try {
      await navigator.clipboard.writeText(message);
      setZaloNotice("Đã sao chép danh sách sản phẩm. Hãy dán vào cuộc trò chuyện Zalo.");
    } catch {
      setZaloNotice("Zalo đã mở. Bạn có thể sao chép nội dung yêu cầu ở ô phía trên.");
    }
    if (ZALO_CHANNEL) window.open(ZALO_CHANNEL.href, "_blank", "noopener,noreferrer");
  };

  return (
    <section aria-labelledby="xac-nhan-yeu-cau" className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
      <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl" id="xac-nhan-yeu-cau">Thông tin liên hệ</h2>
      <p className="mt-2 text-sm text-neutral-700">
        Gửi yêu cầu để chúng tôi liên hệ xác nhận số lượng và báo giá. Chưa phát sinh đơn hàng ở bước này.
      </p>

      {formError ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="mt-4 grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
        <Field
          error={errors.name}
          id="ho-va-ten"
          label="Họ và tên"
          onChange={(value) => update("name", value)}
          required
          value={contact.name}
        />
        <Field
          error={errors.phone}
          id="so-dien-thoai"
          inputMode="tel"
          label="Số điện thoại"
          onChange={(value) => update("phone", value)}
          required
          type="tel"
          value={contact.phone}
        />
        <Field
          error={errors.email}
          id="email"
          inputMode="email"
          label="Email"
          onChange={(value) => update("email", value)}
          required
          type="email"
          value={contact.email}
        />
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-neutral-800" htmlFor="noi-dung-yeu-cau">
            Nội dung yêu cầu <span className="font-normal text-neutral-600">(đã điền sẵn, bạn có thể chỉnh sửa)</span>
          </label>
          <textarea
            aria-describedby={errors.message ? "noi-dung-yeu-cau-loi" : undefined}
            aria-invalid={errors.message ? true : undefined}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base text-neutral-900 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
            id="noi-dung-yeu-cau"
            maxLength={2000}
            onChange={(event) => update("message", event.target.value)}
            rows={4}
            value={contact.message}
          />
          {errors.message ? (
            <p className="mt-1 text-sm text-red-700" id="noi-dung-yeu-cau-loi">{errors.message}</p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          {/*
            The one place on this page that carries the brand green as a fill. White on
            that green is 3.11:1, which clears WCAG AA only for large text, so the label
            is 19px bold rather than the 16px semibold it was — above the 18.66px bold
            threshold. Every other green fill here takes `brand-dark` (4.90:1) instead,
            because their labels are small.
          */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="min-h-12! w-full rounded-md bg-commerce-brand! px-6 text-[19px] font-bold text-white! hover:bg-commerce-brand-dark! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]! disabled:cursor-not-allowed disabled:bg-neutral-200! disabled:text-neutral-700! disabled:opacity-100! sm:w-auto"
              disabled={submitting || !cart.isSubmittable}
              type="submit"
            >
              {submitting ? "Đang gửi..." : "Gửi yêu cầu báo giá"}
            </button>
            {ZALO_CHANNEL ? (
              <button className="min-h-12! w-full rounded-md border border-commerce-brand px-5 text-base font-semibold text-commerce-brand-dark! hover:bg-[#eff8e8] focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]! sm:w-auto" onClick={() => void openZalo()} type="button">
                Trao đổi qua Zalo
              </button>
            ) : null}
            {SMS_CHANNEL ? (
              <a className="inline-flex min-h-12! w-full items-center justify-center rounded-md border border-neutral-300 px-5 text-base font-semibold text-neutral-800! hover:border-commerce-brand hover:text-commerce-brand-dark! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]! sm:w-auto" data-cta href={smsHref(SMS_CHANNEL.contact, contact.message.trim() || cartMessage(cart))}>
                Gửi yêu cầu qua SMS
              </a>
            ) : null}
          </div>
          {zaloNotice ? <p className="mt-3 text-sm text-neutral-700" role="status">{zaloNotice}</p> : null}
          <p className="mt-3 text-sm text-neutral-600">
            Sau khi gửi, bạn nhận được một Mã để đối chiếu khi chúng tôi liên hệ lại.
          </p>
        </div>
      </form>
    </section>
  );
}

function cartMessage(cart: ResolvedRequestCart): string {
  const lines = cart.lines.map((line) => {
    const product = line.productName || line.variantSku;
    const variantLabel = conciseVariantLabel(line.productName, line.variantLabel);
    const variant = variantLabel ? ` – ${variantLabel}` : "";
    const unit = line.unit ? ` ${line.unit}` : "";
    return `- ${product}${variant}: ${line.quantity}${unit}`;
  });
  return ["Tôi muốn được tư vấn và báo giá các sản phẩm sau:", ...lines].join("\n");
}

function smsHref(phone: string, message: string): string {
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}

function conciseVariantLabel(productName: string, variantLabel: string): string {
  const prefix = `${productName} — `;
  return productName && variantLabel.startsWith(prefix) ? variantLabel.slice(prefix.length) : variantLabel;
}

interface FieldProps {
  error: string | undefined;
  id: string;
  inputMode?: "email" | "tel";
  label: string;
  onChange: (value: string) => void;
  optionalHint?: string;
  required?: boolean;
  type?: "email" | "tel" | "text";
  value: string;
}

function Field({ error, id, inputMode, label, onChange, optionalHint, required, type = "text", value }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-800" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="text-red-700"> *</span> : null}
        {optionalHint ? <span className="font-normal text-neutral-600">{` (${optionalHint})`}</span> : null}
      </label>
      <input
        aria-describedby={error ? `${id}-loi` : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
        className="mt-1 h-11! w-full rounded-md border border-neutral-300 px-3 text-base text-neutral-900 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
        id={id}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error ? <p className="mt-1 text-sm text-red-700" id={`${id}-loi`}>{error}</p> : null}
    </div>
  );
}
