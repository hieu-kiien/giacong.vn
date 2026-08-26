import type { AdminRole } from "./admin-data";
import { isAdminRole } from "./admin-permissions.ts";

export interface AdminMemberInput {
  accessSubject: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
  role: AdminRole;
}

export function parseAdminMemberPayload(value: unknown): {
  fieldErrors: Record<string, string>;
  input: AdminMemberInput | null;
} {
  const fieldErrors: Record<string, string> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { fieldErrors: { form: "Dữ liệu thành viên không hợp lệ." }, input: null };
  }
  const record = value as Record<string, unknown>;
  const accessSubject = readText(record.accessSubject, "accessSubject", 255, fieldErrors);
  const displayName = readText(record.displayName, "displayName", 120, fieldErrors);
  const email = readEmail(record.email, fieldErrors);
  const role = typeof record.role === "string" && isAdminRole(record.role)
    ? record.role
    : (fieldErrors.role = "Chọn một vai trò hợp lệ.", null);
  const isActive = typeof record.isActive === "boolean"
    ? record.isActive
    : (fieldErrors.isActive = "isActive phải là boolean.", null);

  if (Object.keys(fieldErrors).length > 0 || !role || isActive === null) {
    return { fieldErrors, input: null };
  }
  return {
    fieldErrors,
    input: { accessSubject, displayName, email, isActive, role },
  };
}

function readText(
  value: unknown,
  field: string,
  maxLength: number,
  fieldErrors: Record<string, string>,
): string {
  if (typeof value !== "string") {
    fieldErrors[field] = "Trường này là bắt buộc.";
    return "";
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[<>\u0000-\u001f\u007f]/.test(normalized)) {
    fieldErrors[field] = "Giá trị không hợp lệ hoặc vượt giới hạn.";
    return "";
  }
  return normalized;
}

function readEmail(value: unknown, fieldErrors: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    fieldErrors.email = "Email không hợp lệ.";
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fieldErrors.email = "Email không hợp lệ.";
    return null;
  }
  return normalized;
}
