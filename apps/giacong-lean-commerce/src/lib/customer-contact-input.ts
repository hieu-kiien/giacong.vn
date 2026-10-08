import { customerLoginDestination } from "./customer-login-destination.ts";

export interface CustomerContactInput { name: string; phone: string; companyName: string }
export interface CustomerContactProfile extends CustomerContactInput { email: string }

export function parseCustomerContact(raw: unknown):
  | { ok: true; value: CustomerContactInput }
  | { ok: false; errors: Partial<Record<"name" | "phone" | "consent" | "companyName", string>> } {
  const data = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim().replace(/[\s().-]/g, "") : "";
  const companyName = typeof data.companyName === "string" ? data.companyName.trim() : "";
  const errors: Partial<Record<"name" | "phone" | "consent" | "companyName", string>> = {};
  if (!name || name.length > 120 || /[\u0000-\u001f]/.test(name)) errors.name = "Vui lòng nhập họ tên (tối đa 120 ký tự).";
  if (!/^\+?\d{8,15}$/.test(phone)) errors.phone = "Vui lòng nhập số điện thoại hợp lệ (8–15 chữ số).";
  if (companyName.length > 160 || /[\u0000-\u001f]/.test(companyName)) errors.companyName = "Tên công ty tối đa 160 ký tự.";
  if (data.consent !== true) errors.consent = "Vui lòng đồng ý lưu thông tin để chúng tôi liên hệ tư vấn.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, phone, companyName } };
}

export function customerContactDestination(next: unknown): string {
  const destination = customerLoginDestination(next);
  return destination.startsWith("/tai-khoan/") ? "/tai-khoan/" : `/tai-khoan/?next=${encodeURIComponent(destination)}`;
}

export function mergeCustomerContact<T extends CustomerContactProfile>(current: T, profile: CustomerContactProfile): T {
  return { ...current, name: current.name || profile.name, phone: current.phone || profile.phone,
    email: current.email || profile.email, companyName: current.companyName || profile.companyName };
}
