export interface AdminCategoryInput {
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  slug: string;
  sortOrder: number;
}

const VERSION_PREFIX = "r1_";

export function normalizeCategoryInput(input: unknown): AdminCategoryInput {
  if (!isRecord(input)) throw new Error("Invalid category request.");
  const name = requiredText(input.name, "name", 120);
  const slug = normalizeSlug(requiredText(input.slug, "slug", 140));
  const description = text(input.description, "description", 5000);
  const imageUrl = nullableText(input.imageUrl, "imageUrl", 500);
  const sortOrder = boundedInteger(input.sortOrder, "sortOrder", 0, 1_000_000);
  if (typeof input.isActive !== "boolean") throw new Error("isActive must be boolean.");
  return { description, imageUrl, isActive: input.isActive, name, slug, sortOrder };
}

export function encodeAdminVersion(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Invalid revision.");
  return `${VERSION_PREFIX}${revision.toString(36)}`;
}

export function decodeAdminVersion(version: unknown): number {
  if (typeof version !== "string" || !version.startsWith(VERSION_PREFIX)) throw new Error("Invalid version.");
  const value = Number.parseInt(version.slice(VERSION_PREFIX.length), 36);
  if (!Number.isSafeInteger(value) || value < 1 || encodeAdminVersion(value) !== version) throw new Error("Invalid version.");
  return value;
}

export function canonicalMutationPayload(input: AdminCategoryInput): string {
  return JSON.stringify({
    description: input.description,
    imageUrl: input.imageUrl,
    isActive: input.isActive,
    name: input.name,
    slug: input.slug,
    sortOrder: input.sortOrder,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, max: number): string {
  const result = text(value, field, max);
  if (!result) throw new Error(`${field} is required.`);
  return result;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const result = value.trim();
  if ([...result].length > max) throw new Error(`${field} exceeds maximum length.`);
  return result;
}

function nullableText(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined) return null;
  return text(value, field, max) || null;
}

function boundedInteger(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function normalizeSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || slug.length > 140) throw new Error("slug is invalid.");
  return slug;
}
