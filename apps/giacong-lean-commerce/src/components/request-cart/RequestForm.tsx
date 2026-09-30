"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  REQUEST_CART_SUBMIT_ENDPOINT,
  buildSubmitBody,
  createRequestId,
  parseSubmitResponse,
} from "@/lib/request-cart-client";
import type { RequestCartContact, RequestCartField } from "@/lib/request-cart-client";
import { customerAuthClient } from "@/lib/customer-auth-client";
import type { ResolvedRequestCart } from "@/types/request-cart";

const SUBMIT_FAILURE_MESSAGE = "Không thể gửi yêu cầu lúc này. Vui lòng thử lại.";

const EMPTY_CONTACT: RequestCartContact = {
  address: "",
  companyName: "",
  deliveryLocation: "",
  email: "",
  message: "",
  name: "",
  neededBy: "",
  phone: "",
  vatInvoice: "",
};
interface RequestFormProps {
  cart: ResolvedRequestCart;
  onAccepted: (result: { contact: RequestCartContact; receivedAt: string; reference: string }) => void;
  onConflict: (cart: ResolvedRequestCart | null) => void;
}

export function RequestForm({ cart, onAccepted, onConflict }: RequestFormProps) {
  const { data: customerSession, isPending: checkingCustomerSession } = customerAuthClient.useSession();
  const [contact, setContact] = useState<RequestCartContact>(() => ({ ...EMPTY_CONTACT, message: cartMessage(cart) }));
  const [errors, setErrors] = useState<Partial<Record<RequestCartField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const automaticMessage = useRef(cartMessage(cart));
  // Reuse a key only when the entire submitted snapshot is unchanged. This keeps a network retry
  // idempotent without allowing edited customer details to silently reuse an older lead.
  const attempt = useRef({ requestId: createRequestId(), submissionSnapshot: "" });

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
    if (!customerSession?.user.id) {
      setFormError("Vui lòng đăng nhập bằng tài khoản đã xác minh email trước khi gửi yêu cầu sản phẩm.");
      return;
    }

    const clientErrors: Partial<Record<RequestCartField, string>> = {};
    if (contact.name.trim() === "") clientErrors.name = "Vui lòng nhập họ và tên.";
    if (contact.phone.trim() === "") clientErrors.phone = "Vui lòng nhập số điện thoại.";
    if (contact.email.trim() === "") clientErrors.email = "Vui lòng nhập địa chỉ email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) clientErrors.email = "Địa chỉ email không hợp lệ.";
    if (contact.deliveryLocation.trim() === "") clientErrors.deliveryLocation = "Vui lòng nhập tỉnh/thành giao hàng.";
    if (!["", "yes", "no"].includes(contact.vatInvoice)) clientErrors.vatInvoice = "Vui lòng chọn nhu cầu hóa đơn VAT.";
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError("Vui lòng kiểm tra lại thông tin liên hệ.");
      return;
    }

    const submissionSnapshot = JSON.stringify({
      contact: normalizedContact(contact),
      customerId: customerSession.user.id,
      lines: cart.lines.map((line) => ({
        parentSlug: line.parentSlug,
        quantity: line.quantity,
        variantSku: line.variantSku,
      })),
      snapshotToken: cart.snapshotToken,
    });
    if (attempt.current.submissionSnapshot !== submissionSnapshot) {
      attempt.current = { requestId: createRequestId(), submissionSnapshot };
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
        onAccepted({
          contact: normalizedContact(contact),
          receivedAt: result.receivedAt ?? new Date().toISOString(),
          reference: result.reference,
        });
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

  if (checkingCustomerSession) {
    return (
      <section aria-labelledby="xac-nhan-yeu-cau" className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
        <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl" id="xac-nhan-yeu-cau">Thông tin liên hệ</h2>
        <p className="mt-2 text-sm text-neutral-700" role="status">Đang kiểm tra đăng nhập…</p>
      </section>
    );
  }

  if (!customerSession?.user.id) {
    return (
      <section aria-labelledby="xac-nhan-yeu-cau" className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
        <h2 className="text-xl font-bold text-neutral-900 sm:text-2xl" id="xac-nhan-yeu-cau">Đăng nhập để gửi yêu cầu</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Đăng nhập bằng tài khoản đã xác minh email để lưu yêu cầu và xem lại lịch sử.
        </p>
        {formError ? (
          <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
        <Link
          className="mt-4 inline-flex min-h-12! items-center justify-center rounded-md bg-commerce-brand-dark! px-5 text-sm font-semibold text-white! hover:brightness-90 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
          href="/tai-khoan/dang-nhap/?next=gui-yeu-cau"
        >
          Đăng nhập hoặc tạo tài khoản
        </Link>
      </section>
    );
  }

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
        <Field
          error={errors.companyName}
          id="ten-cong-ty"
          label="Công ty"
          onChange={(value) => update("companyName", value)}
          optionalHint="không bắt buộc"
          value={contact.companyName}
        />
        <Field
          error={errors.deliveryLocation}
          id="tinh-thanh-giao-hang"
          label="Tỉnh/thành giao hàng"
          onChange={(value) => update("deliveryLocation", value)}
          required
          value={contact.deliveryLocation}
        />
        <Field
          error={errors.address}
          id="dia-chi-nhan-hang"
          label="Địa chỉ nhận hàng"
          onChange={(value) => update("address", value)}
          optionalHint="không bắt buộc"
          value={contact.address}
        />
        <Field
          error={errors.neededBy}
          id="thoi-gian-can-hang"
          label="Thời gian cần hàng"
          onChange={(value) => update("neededBy", value)}
          optionalHint="không bắt buộc"
          value={contact.neededBy}
        />
        <div>
          <label className="block text-sm font-medium text-neutral-800" htmlFor="hoa-don-vat">
            Có cần hóa đơn VAT không? <span className="font-normal text-neutral-600">(không bắt buộc)</span>
          </label>
          <select
            aria-describedby={errors.vatInvoice ? "hoa-don-vat-loi" : undefined}
            aria-invalid={errors.vatInvoice ? true : undefined}
            className="mt-1 h-11! w-full rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#2e90fa]!"
            id="hoa-don-vat"
            onChange={(event) => update("vatInvoice", event.target.value)}
            value={contact.vatInvoice}
          >
            <option value="">Chưa chọn</option>
            <option value="yes">Có</option>
            <option value="no">Không</option>
          </select>
          {errors.vatInvoice ? <p className="mt-1 text-sm text-red-700" id="hoa-don-vat-loi">{errors.vatInvoice}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-neutral-800" htmlFor="noi-dung-yeu-cau">
            Ghi chú yêu cầu <span className="font-normal text-neutral-600">(đã điền sẵn, bạn có thể chỉnh sửa)</span>
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
              disabled={submitting || !cart.isSubmittable || !customerSession.user.id}
              type="submit"
            >
              {submitting ? "Đang gửi..." : "Gửi yêu cầu báo giá"}
            </button>
          </div>
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

function normalizedContact(contact: RequestCartContact): RequestCartContact {
  return {
    address: contact.address.trim(),
    companyName: contact.companyName.trim(),
    deliveryLocation: contact.deliveryLocation.trim(),
    email: contact.email.trim(),
    message: contact.message.trim(),
    name: contact.name.trim(),
    neededBy: contact.neededBy.trim(),
    phone: contact.phone.trim(),
    vatInvoice: contact.vatInvoice.trim(),
  };
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
