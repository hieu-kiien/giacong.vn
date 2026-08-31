import type { AdminMemberInput } from "./admin-members-input.ts";
import { isAdminRequestId } from "./admin-request.ts";
import { parseAdminMemberPayload } from "./admin-members-input.ts";

const memberKeys = ["accessSubject", "displayName", "email", "isActive", "role"] as const;

export interface AdminMemberCreateCommand {
  input: AdminMemberInput;
  requestId: string;
}

export interface AdminMemberUpdateCommand {
  expectedRevision: number;
  input: AdminMemberInput;
  requestId: string;
}

export function parseAdminMemberCreateCommand(
  payload: unknown,
): { command: AdminMemberCreateCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", ...memberKeys]);
  const requestId = readRequestId(source.requestId, fieldErrors);
  const parsed = parseAdminMemberPayload(memberFields(source));
  Object.assign(fieldErrors, parsed.fieldErrors);
  return {
    command: requestId && parsed.input && Object.keys(fieldErrors).length === 0
      ? { input: parsed.input, requestId }
      : null,
    fieldErrors,
  };
}

export function parseAdminMemberUpdateCommand(
  payload: unknown,
): { command: AdminMemberUpdateCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", "expectedRevision", ...memberKeys]);
  const requestId = readRequestId(source.requestId, fieldErrors);
  const expectedRevision = readRevision(source.expectedRevision, fieldErrors);
  const parsed = parseAdminMemberPayload(memberFields(source));
  Object.assign(fieldErrors, parsed.fieldErrors);
  return {
    command: requestId && expectedRevision !== null && parsed.input && Object.keys(fieldErrors).length === 0
      ? { expectedRevision, input: parsed.input, requestId }
      : null,
    fieldErrors,
  };
}

function memberFields(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(memberKeys.map((key) => [key, source[key]]));
}

function readRequestId(value: unknown, fieldErrors: Record<string, string>): string | null {
  if (!isAdminRequestId(value)) {
    fieldErrors.requestId = "requestId phải là UUID hợp lệ.";
    return null;
  }
  return value.trim().toLowerCase();
}

function readRevision(value: unknown, fieldErrors: Record<string, string>): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    fieldErrors.expectedRevision = "expectedRevision phải là số nguyên dương.";
    return null;
  }
  return value;
}

function exactKeys(source: Record<string, unknown>, keys: readonly string[]): Record<string, string> {
  const expected = new Set(keys);
  return Object.keys(source).length === expected.size && Object.keys(source).every((key) => expected.has(key))
    ? {}
    : { payload: "Request chứa field không được hỗ trợ hoặc còn thiếu field bắt buộc." };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
