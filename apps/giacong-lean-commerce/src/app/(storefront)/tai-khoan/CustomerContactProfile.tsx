"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseCustomerContact, type CustomerContactProfile as ContactProfile } from "@/lib/customer-contact-input";
import styles from "./customer-contact.module.css";

export function CustomerContactProfile({ initial, complete, next }: { initial: ContactProfile; complete: boolean; next: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [consent, setConsent] = useState(complete);
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "companyName" | "consent", string>>>({});
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const parsed = parseCustomerContact({ name, phone, companyName, consent });
    setErrors(parsed.ok ? {} : parsed.errors);
    setMessage("");
    if (!parsed.ok) { setFailed(true); setMessage("Vui lòng kiểm tra thông tin bên dưới."); return; }
    inFlight.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/customer/contact", { method: "PUT", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...parsed.value, consent }) });
      const body = await response.json();
      if (!response.ok || body.ok !== true) {
        setFailed(true);
        setMessage(typeof body.message === "string" ? body.message : "Chưa lưu được thông tin. Vui lòng thử lại.");
        return;
      }
      setFailed(false);
      setMessage("Đã lưu thông tin liên hệ.");
      if (next) router.replace(next);
      router.refresh();
    } catch { setFailed(true); setMessage("Chưa lưu được thông tin. Vui lòng kiểm tra kết nối và thử lại."); }
    finally { inFlight.current = false; setPending(false); }
  }

  const form = <form className={styles.form} noValidate onSubmit={save}>
    <p className={styles.copy}>Thông tin được dùng để liên hệ tư vấn và điền sẵn khi bạn gửi yêu cầu. Số điện thoại này chưa được xác minh và không dùng để đăng nhập.</p>
    <div className={styles.grid}>
      <div><label htmlFor="contact-profile-name">Họ và tên <span aria-hidden="true">*</span></label>
        <input id="contact-profile-name" autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "profile-name-error" : undefined} />
        {errors.name ? <p className={styles.error} id="profile-name-error">{errors.name}</p> : null}</div>
      <div><label htmlFor="contact-profile-phone">Số điện thoại <span aria-hidden="true">*</span></label>
        <input id="contact-profile-phone" autoComplete="tel" type="tel" inputMode="tel" required maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "profile-phone-error" : undefined} />
        {errors.phone ? <p className={styles.error} id="profile-phone-error">{errors.phone}</p> : null}</div>
      <div><label htmlFor="contact-profile-email">Email Google</label><input id="contact-profile-email" value={initial.email} type="email" readOnly /></div>
      <div><label htmlFor="contact-profile-company">Công ty <span className={styles.optional}>(tùy chọn)</span></label>
        <input id="contact-profile-company" autoComplete="organization" maxLength={160} value={companyName} onChange={(event) => setCompanyName(event.target.value)} aria-invalid={Boolean(errors.companyName)} />
        {errors.companyName ? <p className={styles.error}>{errors.companyName}</p> : null}</div>
    </div>
    <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} aria-describedby={errors.consent ? "profile-consent-error" : undefined} />
      <span>Tôi đồng ý lưu thông tin để được liên hệ tư vấn theo <Link href="/chinh-sach-bao-mat/">chính sách bảo mật</Link>.</span></label>
    {errors.consent ? <p className={styles.error} id="profile-consent-error">{errors.consent}</p> : null}
    <div aria-live="polite">{message ? <p className={failed ? styles.error : styles.success} role={failed ? "alert" : "status"}>{message}</p> : null}</div>
    <button className={styles.submit} disabled={pending} type="submit">{pending ? "Đang lưu…" : next ? "Lưu và tiếp tục" : "Lưu thông tin liên hệ"}</button>
  </form>;

  return <section className={styles.card} aria-labelledby="contact-profile-heading">
    <h2 id="contact-profile-heading">{complete ? "Thông tin liên hệ" : "Hoàn thiện thông tin liên hệ"}</h2>
    {form}
  </section>;
}
