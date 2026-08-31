import type { AdminProductVariantInput } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";
import { parseAdminVariantPayload } from "./admin-variant-input.ts";

const variantKeys = [
  "attributeCode",
  "attributeId",
  "attributeLabel",
  "contactFromQuantity",
  "imageUrl",
  "isAvailable",
  "moq",
  "name",
  "optionId",
  "optionLabel",
  "quantityStep",
  "sku",
  "sortOrder",
  "tierPrices",
  "unit",
] as const;

type VariantCommandInput = Omit<AdminProductVariantInput, "revision">;

export interface AdminProductVariantCreateCommand {
  input: VariantCommandInput;
  requestId: string;
}

export interface AdminProductVariantUpdateCommand {
  input: VariantCommandInput;
  requestId: string;
  revision: number;
}

export interface AdminProductVariantArchiveCommand {
  requestId: string;
  revision: number;
}

export function parseAdminProductVariantCreateCommand(
  payload: unknown,
): { command: AdminProductVariantCreateCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", ...variantKeys]);
  validateVariantTypes(source, fieldErrors);
  const requestId = requestIdField(source.requestId, fieldErrors);
  const parsed = parseAdminVariantPayload(variantFields(source));
  Object.assign(fieldErrors, parsed.fieldErrors);
  return {
    command: requestId && parsed.input && Object.keys(fieldErrors).length === 0
      ? { input: parsed.input as VariantCommandInput, requestId }
      : null,
    fieldErrors,
  };
}

export function parseAdminProductVariantUpdateCommand(
  payload: unknown,
): { command: AdminProductVariantUpdateCommand | null; fieldErrors: Record<string, string> } {
  const source = asRecord(payload);
  const fieldErrors = exactKeys(source, ["requestId", "revision", ...variantKeys]);
  validateVariantTypes(source, fieldErrors);
  const requestId = requestIdField(source.requestId, fieldErrors);
  const revision = positiveRevision(source.revision, fieldErrors);
  const parsed = parseAdminVariantPayload(variantFields(source));
  Object.assign(fieldErrors, parsed.fieldErrors);
  return {
    command: requestId && revision !== null && parsed.input && Object.keys(fieldErrors).length === 0
      ? { input: parsed.input as VariantCommandInput, requestId, revision }
      : null,
    fieldErrors,
  };
}

export function parseAdminProductVariantArchiveCommand(
  payload: unknown,
): { command: AdminProductVariantArchiveCommand | null; fieldErrors: Record<string, string> } {
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

function variantFields(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(variantKeys.map((key) => [key, source[key]]));
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

function validateVariantTypes(source: Record<string, unknown>, fieldErrors: Record<string, string>): void {
  for (const key of ["name", "sku", "optionLabel", "unit", "attributeCode", "attributeLabel"] as const) {
    if (typeof source[key] !== "string") fieldErrors[key] = "Field phải có kiểu chuỗi hợp lệ.";
  }
  if (source.imageUrl !== null && typeof source.imageUrl !== "string") fieldErrors.imageUrl = "imageUrl phải là chuỗi hoặc null.";
  if (typeof source.isAvailable !== "boolean") fieldErrors.isAvailable = "isAvailable phải là boolean.";
  for (const key of ["attributeId", "contactFromQuantity", "moq", "optionId", "quantityStep", "sortOrder"] as const) {
    const minimum = key === "sortOrder" || key === "optionId" ? 0 : 1;
    if (!Number.isSafeInteger(source[key]) || (source[key] as number) < minimum) {
      fieldErrors[key] = "Field phải là số nguyên hợp lệ.";
    }
  }
  if (!Array.isArray(source.tierPrices)) {
    fieldErrors.tierPrices = "tierPrices phải là một mảng.";
    return;
  }
  source.tierPrices.forEach((value, index) => {
    const tier = asRecord(value);
    const expected = ["currency", "minQuantity", "price"] as const;
    if (Object.keys(tier).length !== expected.length || expected.some((key) => !Object.hasOwn(tier, key))) {
      fieldErrors[`tierPrices.${index}`] = "Mỗi tier chỉ được chứa currency, minQuantity và price.";
      return;
    }
    if (tier.currency !== "VND") fieldErrors[`tierPrices.${index}.currency`] = "Currency phải là VND.";
    if (!Number.isSafeInteger(tier.minQuantity) || (tier.minQuantity as number) < 1) fieldErrors[`tierPrices.${index}.minQuantity`] = "minQuantity phải là số nguyên dương.";
    if (!Number.isSafeInteger(tier.price) || (tier.price as number) < 1) fieldErrors[`tierPrices.${index}.price`] = "price phải là số nguyên dương.";
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
