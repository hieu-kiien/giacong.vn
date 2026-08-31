import type { AdminProductInput } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";
import { parseAdminProductPayload } from "./admin-product-input.ts";

const productKeys = [
  "categoryId",
  "description",
  "imageUrl",
  "isActive",
  "leadTimeDays",
  "name",
  "shortDescription",
  "sku",
  "slug",
  "status",
] as const;

export interface AdminProductCreateCommand {
  input: AdminProductInput;
  requestId: string;
}

export interface AdminProductUpdateCommand {
  input: AdminProductInput;
  requestId: string;
  revision: number;
}

export interface AdminProductArchiveCommand {
  requestId: string;
  revision: number;
}

export function parseAdminProductCreateCommand(
  payload: unknown,
): { command: AdminProductCreateCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", ...productKeys]);
  validateProductTypes(source, fieldErrors);
  const requestId = requestIdField(source.requestId, fieldErrors);
  const parsed = parseAdminProductPayload(productFields(source));
  Object.assign(fieldErrors, parsed.fieldErrors);
  return {
    command: requestId && parsed.input && Object.keys(fieldErrors).length === 0
      ? { input: parsed.input, requestId }
      : null,
    fieldErrors,
  };
}

export function parseAdminProductUpdateCommand(
  payload: unknown,
): { command: AdminProductUpdateCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", "revision", ...productKeys]);
  validateProductTypes(source, fieldErrors);
  const requestId = requestIdField(source.requestId, fieldErrors);
  const revision = positiveRevision(source.revision, fieldErrors);
  const parsed = parseAdminProductPayload(productFields(source));
  Object.assign(fieldErrors, parsed.fieldErrors);
  return {
    command: requestId && revision !== null && parsed.input && Object.keys(fieldErrors).length === 0
      ? { input: parsed.input, requestId, revision }
      : null,
    fieldErrors,
  };
}

export function parseAdminProductArchiveCommand(
  payload: unknown,
): { command: AdminProductArchiveCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", "revision"]);
  const requestId = requestIdField(source.requestId, fieldErrors);
  const revision = positiveRevision(source.revision, fieldErrors);
  return {
    command: requestId && revision !== null && Object.keys(fieldErrors).length === 0
      ? { requestId, revision }
      : null,
    fieldErrors,
  };
}

function productFields(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(productKeys.map((key) => [key, source[key]]));
}

function requestIdField(value: unknown, fieldErrors: Record<string, string>): string | null {
  if (!isAdminRequestId(value)) {
    fieldErrors.requestId = "requestId phải là UUID hợp lệ.";
    return null;
  }
  return value.trim().toLowerCase();
}

function positiveRevision(value: unknown, fieldErrors: Record<string, string>): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    fieldErrors.revision = "Revision phải là số nguyên dương.";
    return null;
  }
  return value;
}

function exactKeys(source: Record<string, unknown>, keys: readonly string[]): Record<string, string> {
  const expected = new Set(keys);
  const errors: Record<string, string> = {};
  if (Object.keys(source).length !== expected.size || Object.keys(source).some((key) => !expected.has(key))) {
    errors.payload = "Request chứa field không được hỗ trợ hoặc còn thiếu field bắt buộc.";
  }
  return errors;
}

function validateProductTypes(source: Record<string, unknown>, fieldErrors: Record<string, string>): void {
  for (const key of ["name", "slug", "sku", "shortDescription", "description", "status"] as const) {
    if (typeof source[key] !== "string") fieldErrors[key] = "Field phải có kiểu chuỗi hợp lệ.";
  }
  if (typeof source.isActive !== "boolean") fieldErrors.isActive = "isActive phải là boolean.";
  if (!nullableInteger(source.categoryId, true)) fieldErrors.categoryId = "categoryId phải là số nguyên dương hoặc null.";
  if (!nullableInteger(source.leadTimeDays, false)) fieldErrors.leadTimeDays = "leadTimeDays phải là số nguyên không âm hoặc null.";
  if (source.imageUrl !== null && typeof source.imageUrl !== "string") fieldErrors.imageUrl = "imageUrl phải là chuỗi hoặc null.";
}

function nullableInteger(value: unknown, positive: boolean): boolean {
  if (value === null) return true;
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && (positive ? value > 0 : value >= 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
