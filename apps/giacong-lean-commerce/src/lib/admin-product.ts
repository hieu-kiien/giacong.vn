export interface AdminProductInput {
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  imageUrl: string | null;
  categoryId: number | null;
  isActive: boolean;
}

const VERSION_PREFIX = "r1_";

export function normalizeProductInput(input: unknown): AdminProductInput {
  if (!isRecord(input)) throw new Error("Invalid product request.");
  const name = requiredText(input.name, "name", 180);
  const slug = normalizeSlug(requiredText(input.slug, "slug", 200));
  const sku = requiredText(input.sku, "sku", 120);
  const shortDescription = text(input.shortDescription, "shortDescription", 1000);
  const description = text(input.description, "description", 30000);
  const imageUrl = nullableText(input.imageUrl, "imageUrl", 500);
  const categoryId = nullablePositiveInteger(input.categoryId, "categoryId");
  if (typeof input.isActive !== "boolean") throw new Error("isActive must be boolean.");
  return { name, slug, sku, shortDescription, description, imageUrl, categoryId, isActive: input.isActive };
}

export function encodeProductVersion(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Invalid revision.");
  return `${VERSION_PREFIX}${revision.toString(36)}`;
}

export function decodeProductVersion(version: unknown): number {
  if (typeof version !== "string" || !version.startsWith(VERSION_PREFIX)) throw new Error("Invalid version.");
  const value = Number.parseInt(version.slice(VERSION_PREFIX.length), 36);
  if (!Number.isSafeInteger(value) || value < 1 || encodeProductVersion(value) !== version) throw new Error("Invalid version.");
  return value;
}

export function canonicalProductMutationPayload(input: AdminProductInput): string {
  return JSON.stringify(input);
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function requiredText(value: unknown, field: string, max: number): string { const result = text(value, field, max); if (!result) throw new Error(`${field} is required.`); return result; }
function text(value: unknown, field: string, max: number): string { if (typeof value !== "string") throw new Error(`${field} must be a string.`); const result = value.trim(); if ([...result].length > max) throw new Error(`${field} exceeds maximum length.`); return result; }
function nullableText(value: unknown, field: string, max: number): string | null { if (value === null || value === undefined) return null; return text(value, field, max) || null; }
function nullablePositiveInteger(value: unknown, field: string): number | null { if (value === null || value === undefined) return null; if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error(`${field} must be a positive integer or null.`); return value; }
function normalizeSlug(value: string): string { const slug = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); if (!slug || slug.length > 200) throw new Error("slug is invalid."); return slug; }
