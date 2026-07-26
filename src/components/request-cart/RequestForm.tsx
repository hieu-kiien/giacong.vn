"use client";

import { useEffect, useRef, useState } from "react";

import {
  REQUEST_CART_SUBMIT_ENDPOINT,
  buildSubmitBody,
  createRequestId,
  parseSubmitResponse,
} from "@/lib/request-cart-client";
import type { RequestCartContact, RequestCartField } from "@/lib/request-cart-client";
import type { ResolvedRequestCart } from "@/types/request-cart";

const SUBMIT_FAILURE_MESSAGE = "Không thể gửi yêu cầu lúc này. Vui lòng thử lại.";

const EMPTY_CONTACT: RequestCartContact = { email: "", message: "", name: "", phone: "" };

interface RequestFormProps {
  cart: ResolvedRequestCart;
  onAccepted: (reference: string) => void;
  onConflict: (cart: ResolvedRequestCart | null) => void;
}

export function RequestForm({ cart, onAccepted, onConflict }: RequestFormProps) {
  const [contact, setContact] = useState<RequestCartContact>(EMPTY_CONTACT);
  const [errors, setErrors] = useState<Partial<Record<RequestCartField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  // One idempotency key per priced state. Retrying the same state reuses it, so a timeout that
  // already reached the Sheet returns the original `Mã` instead of creating a second request.
  const attempt = useRef({ requestId: createRequestId(), snapshotToken: cart.snapshotToken });

  useEffect(() => {
    if (attempt.current.snapshotToken !== cart.snapshotToken) {
      attempt.current = { requestId: createRequestId(), snapshotToken: cart.snapshotToken };
    }
  }, [cart.snapshotToken]);

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

    const clientErrors: Partial<Record<RequestCartField, string>> = {};
    if (contact.name.trim() === "") clientErrors.name = "Vui lòng nhập họ và tên.";
    if (contact.phone.trim() === "") clientErrors.phone = "Vui lòng nhập số điện thoại.";
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
          requestId: attempt.current.requestId,
          snapshotToken: cart.snapshotToken,
        })),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = await response.json().catch(() => null);
      const result = parseSubmitResponse(response.status, body);

      if (result.status === "accepted") {
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

  return (
    <section aria-labelledby="xac-nhan-yeu-cau" className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
      <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl" id="xac-nhan-yeu-cau">Xác nhận yêu cầu đặt hàng</h2>
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
          optionalHint="không bắt buộc"
          type="email"
          value={contact.email}
        />
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-neutral-800" htmlFor="noi-dung-yeu-cau">
            Nội dung yêu cầu <span className="font-normal text-neutral-600">(không bắt buộc)</span>
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
          <button
            className="min-h-12! w-full rounded-md bg-[#327600]! px-6 text-base font-semibold text-white! hover:bg-[#285f00]! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]! disabled:cursor-not-allowed disabled:bg-neutral-200! disabled:text-neutral-700! disabled:opacity-100! sm:w-auto"
            disabled={submitting || !cart.isSubmittable}
            type="submit"
          >
            {submitting ? "Đang gửi..." : "Gửi yêu cầu đặt hàng"}
          </button>
          <p className="mt-3 text-sm text-neutral-600">
            Sau khi gửi, bạn nhận được một Mã để đối chiếu khi chúng tôi liên hệ lại.
          </p>
        </div>
      </form>
    </section>
  );
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
