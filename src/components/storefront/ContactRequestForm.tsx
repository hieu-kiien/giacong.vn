"use client";

import { FormEvent, useState } from "react";

import { contactContextFromSearch } from "@/lib/contact-context";

export function ContactRequestForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    const data = new FormData(event.currentTarget);
    Object.entries(contactContextFromSearch(window.location.search)).forEach(([key, value]) => data.set(key, value));
    const response = await fetch("/api/contact", { body: data, method: "POST" }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { message?: string; ok?: boolean; reference?: string } : {};
    if (!response?.ok || !result.ok) {
      setStatus(result.message ?? "Chưa thể gửi yêu cầu. Vui lòng thử lại.");
    } else {
      setStatus(`${result.message ?? "Yêu cầu đã được tiếp nhận."}${result.reference ? ` Mã: ${result.reference}.` : ""}`);
      event.currentTarget.reset();
    }
    setPending(false);
  }

  return <form className="grid gap-4" onSubmit={submit}>
    <label className="grid gap-1 text-sm font-medium">Họ và tên<input className="rounded border border-stone-300 bg-white px-3 py-2" name="name" required /></label>
    <label className="grid gap-1 text-sm font-medium">Số điện thoại<input className="rounded border border-stone-300 bg-white px-3 py-2" name="phone" required type="tel" /></label>
    <label className="grid gap-1 text-sm font-medium">Email <span className="font-normal text-stone-500">(không bắt buộc)</span><input className="rounded border border-stone-300 bg-white px-3 py-2" name="email" type="email" /></label>
    <label className="grid gap-1 text-sm font-medium">Nhu cầu của bạn<textarea className="min-h-32 rounded border border-stone-300 bg-white px-3 py-2" name="message" required /></label>
    <input name="source" type="hidden" value="/lien-he" />
    <button className="rounded bg-emerald-800 px-4 py-3 font-semibold text-white hover:bg-emerald-900 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Đang gửi…" : "Gửi yêu cầu tư vấn"}</button>
    {status ? <p aria-live="polite" className="text-sm text-stone-700" role="status">{status}</p> : null}
  </form>;
}
