import type { AdminServiceInput } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";
import { parseAdminServicePayload } from "./admin-service-input.ts";

const serviceKeys = [
  "description",
  "imageUrl",
  "isActive",
  "leadTimeDays",
  "moqSummary",
  "name",
  "slug",
  "status",
  "summary",
] as const;

type ServiceCommandInput = AdminServiceInput;

export interface AdminServiceCreateCommand {
  input: ServiceCommandInput;
  requestId: string;
}

export interface AdminServiceUpdateCommand {
  input: ServiceCommandInput;
  requestId: string;
  revision: number;
}

export interface AdminServiceArchiveCommand {
  requestId: string;
  revision: number;
}

export function parseAdminServiceCreateCommand(
  payload: unknown,
): { command: AdminServiceCreateCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", ...serviceKeys]);
  validateServiceTypes(source, fieldErrors);
  const requestId = requestIdField(source.requestId, fieldErrors);
  const parsed = parseAdminServicePayload(serviceFields(source));
  Object.assign(fieldErrors, parsed.fieldErrors);
  return {
    command: requestId && parsed.input && Object.keys(fieldErrors).length === 0
      ? { input: parsed.input, requestId }
      : null,
    fieldErrors,
  };
}

export function parseAdminServiceUpdateCommand(
  payload: unknown,
): { command: AdminServiceUpdateCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", "revision", ...serviceKeys]);
  validateServiceTypes(source, fieldErrors);
  const requestId = requestIdField(source.requestId, fieldErrors);
  const revision = positiveRevision(source.revision, fieldErrors);
  const parsed = parseAdminServicePayload(serviceFields(source));
  Object.assign(fieldErrors, parsed.fieldErrors);
  return {
    command: requestId && revision !== null && parsed.input && Object.keys(fieldErrors).length === 0
      ? { input: parsed.input, requestId, revision }
      : null,
    fieldErrors,
  };
}

export function parseAdminServiceArchiveCommand(
  payload: unknown,
): { command: AdminServiceArchiveCommand | null; fieldErrors: Record<string, string> } {
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

function serviceFields(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(serviceKeys.map((key) => [key, source[key]]));
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

function validateServiceTypes(source: Record<string, unknown>, fieldErrors: Record<string, string>): void {
  for (const key of ["name", "slug", "summary", "description", "status"] as const) {
    if (typeof source[key] !== "string") fieldErrors[key] = "Field phải có kiểu chuỗi hợp lệ.";
  }
  if (source.imageUrl !== null && typeof source.imageUrl !== "string") {
    fieldErrors.imageUrl = "imageUrl phải là chuỗi hoặc null.";
  }
  if (source.moqSummary !== null && typeof source.moqSummary !== "string") {
    fieldErrors.moqSummary = "moqSummary phải là chuỗi hoặc null.";
  }
  if (typeof source.isActive !== "boolean") fieldErrors.isActive = "isActive phải là boolean.";
  if (!nullableInteger(source.leadTimeDays)) {
    fieldErrors.leadTimeDays = "leadTimeDays phải là số nguyên không âm hoặc null.";
  }
}

function nullableInteger(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
