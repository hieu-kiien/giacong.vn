import type { LeadStatus } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

const leadStatuses = new Set<LeadStatus>([
  "new",
  "qualified",
  "contacted",
  "quotation_sent",
  "sampling",
  "negotiation",
  "won",
  "lost",
  "spam",
]);

export interface AdminLeadStatusCommand {
  requestId: string;
  revision: number;
  status: LeadStatus;
}

export function parseAdminLeadStatusCommand(
  payload: unknown,
): { command: AdminLeadStatusCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", "revision", "status"]);
  const requestId = readRequestId(source.requestId, fieldErrors);
  const revision = readRevision(source.revision, fieldErrors);
  const status = typeof source.status === "string" && leadStatuses.has(source.status as LeadStatus)
    ? source.status as LeadStatus
    : (fieldErrors.status = "Chọn một trạng thái lead hợp lệ.", null);
  return {
    command: requestId && revision !== null && status && Object.keys(fieldErrors).length === 0
      ? { requestId, revision, status }
      : null,
    fieldErrors,
  };
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
    fieldErrors.revision = "Revision phải là số nguyên dương.";
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
