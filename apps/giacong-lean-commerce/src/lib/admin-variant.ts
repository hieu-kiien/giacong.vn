import { decodeAdminVersion, encodeAdminVersion } from "./admin-category.ts";

export interface AdminVariantInput {
  name: string;
  sku: string;
  optionLabel: string;
  unit: string;
  moq: number;
  quantityStep: number;
  contactFromQuantity: number;
  isAvailable: boolean;
  sortOrder: number;
  attributeId: number;
  attributeCode: string;
  attributeLabel: string;
  optionId: number;
  imageUrl: string | null;
}

export interface AdminTierPriceInput {
  minQuantity: number;
  price: number;
}

export interface AdminVariant extends AdminVariantInput {
  id: number;
  productId: number;
  version: string;
  updatedAt: string;
  tierPrices: AdminTierPriceInput[];
}

export function normalizeVariantInput(raw: unknown): AdminVariantInput {
  if (!isRecord(raw)) throw new Error("Invalid variant request.");
  const text = (key: keyof AdminVariantInput, max: number) => {
    const value = raw[key];
    if (typeof value !== "string") throw new Error(`${String(key)} must be a string.`);
    const result = value.trim();
    if (!result || result.length > max) throw new Error(`${String(key)} is invalid.`);
    return result;
  };
  const integer = (key: keyof AdminVariantInput, min = 0, max = 1_000_000_000) => {
    const value = raw[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${String(key)} must be an integer.`);
    return value;
  };
  const bool = raw.isAvailable;
  if (typeof bool !== "boolean") throw new Error("isAvailable must be boolean.");
  const image = raw.imageUrl;
  if (image !== null && image !== undefined && (typeof image !== "string" || image.trim().length > 500)) throw new Error("imageUrl is invalid.");
  const input: AdminVariantInput = {
    name: text("name", 180), sku: text("sku", 120), optionLabel: text("optionLabel", 120), unit: text("unit", 50),
    moq: integer("moq", 1), quantityStep: integer("quantityStep", 1), contactFromQuantity: integer("contactFromQuantity", 1),
    isAvailable: bool, sortOrder: integer("sortOrder", 0, 1_000_000), attributeId: integer("attributeId", 1),
    attributeCode: text("attributeCode", 120), attributeLabel: text("attributeLabel", 120), optionId: integer("optionId", 0),
    imageUrl: image === null || image === undefined ? null : image.trim(),
  };
  assertQuantityInvariants(input);
  return input;
}

export function normalizeTierPrices(raw: unknown, variant: Pick<AdminVariantInput, "moq" | "quantityStep" | "contactFromQuantity">): AdminTierPriceInput[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("tierPrices must contain at least one tier.");
  const result = raw.map((value) => {
    if (!isRecord(value)) throw new Error("Invalid tier price.");
    const minQuantity = value.minQuantity;
    const price = value.price;
    if (typeof minQuantity !== "number" || !Number.isSafeInteger(minQuantity) || minQuantity <= 0) throw new Error("minQuantity must be a positive integer.");
    if (typeof price !== "number" || !Number.isSafeInteger(price) || price <= 0) throw new Error("price must be a positive integer.");
    return { minQuantity, price };
  }).sort((a, b) => a.minQuantity - b.minQuantity);
  if (result[0]?.minQuantity !== variant.moq) throw new Error("A priced variant must contain a tier at MOQ.");
  for (let i = 0; i < result.length; i += 1) {
    const tier = result[i];
    if (tier.minQuantity >= variant.contactFromQuantity) throw new Error("Tier is at or above contactFromQuantity.");
    if ((tier.minQuantity - variant.moq) % variant.quantityStep !== 0) throw new Error("Tier minQuantity is not aligned to quantityStep.");
    if (i > 0 && result[i - 1].minQuantity === tier.minQuantity) throw new Error("Duplicate tier boundary.");
  }
  return result;
}

export function assertQuantityInvariants(input: Pick<AdminVariantInput, "moq" | "quantityStep" | "contactFromQuantity">): void {
  if (input.moq <= 0 || input.quantityStep <= 0 || input.contactFromQuantity <= input.moq) throw new Error("Invalid MOQ/quantity threshold.");
  if ((input.contactFromQuantity - input.moq) % input.quantityStep !== 0) throw new Error("contactFromQuantity must align to quantityStep.");
}

export function encodeVariantVersion(revision: number): string { return encodeAdminVersion(revision); }
export function decodeVariantVersion(version: unknown): number { return decodeAdminVersion(version); }

export function canonicalVariantMutationPayload(input: AdminVariantInput): string {
  return JSON.stringify({ ...input, imageUrl: input.imageUrl ?? null });
}

export function canonicalTierMutationPayload(input: { variantId: number; version: string; tierPrices: AdminTierPriceInput[] }): string {
  return JSON.stringify({ variantId: input.variantId, version: input.version, tierPrices: input.tierPrices });
}

function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
