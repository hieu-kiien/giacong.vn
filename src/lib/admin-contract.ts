export class AdminContractError extends Error {
  constructor() {
    super("Phản hồi quản trị không đúng hợp đồng.");
  }
}

export interface AdminIdentity {
  id: number;
  name: string;
  email: string;
  role: { id: number; name: string };
  permissions: string[];
}

export interface AdminDashboard {
  product_parent_count: number;
  variant_count: number;
  available_variant_count: number;
  category_count: number;
}

export interface AdminProduct {
  id: number; type: "configurable"; sku: string; slug: string; name: string;
  description: string | null; categories: Array<{ id: number; name: string; slug: string }>;
  variant_count: number; available_variant_count: number;
  starting_price: { unit_price: number; currency: "VND" } | null;
}

export interface AdminProductList { data: AdminProduct[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export interface AdminProductDetail extends AdminProduct {
  option_groups: Array<{ attribute_id: number; code: string; label: string; options: Array<{ option_id: number; label: string; variant_ids: number[] }> }>;
  variants: Array<{ id: number; sku: string; name: string; unit: string; moq: number; quantity_step: number; contact_from_quantity: number; availability: { is_available: boolean }; tier_prices: Array<{ min_quantity: number; unit_price: number; currency: "VND" }>; option_values: Array<{ attribute_id: number; attribute_code: string; option_id: number; option_label: string }> }>;
}

export function parseAdminIdentity(payload: unknown): AdminIdentity {
  const root = exact(payload, ["data"]);
  const data = exact(root.data, ["id", "name", "email", "role", "permissions"]);
  const role = exact(data.role, ["id", "name"]);
  const permissions = list(data.permissions).map(text);
  if (!permissions.every((permission) => permission === "*" || permission === "b2b.dashboard" || permission === "b2b.catalog.read")) bad();
  return { id: positive(data.id), name: nonEmpty(data.name), email: nonEmpty(data.email), role: { id: positive(role.id), name: nonEmpty(role.name) }, permissions };
}

export function parseDashboard(payload: unknown): AdminDashboard {
  const root = exact(payload, ["data", "meta"]);
  version(root.meta);
  const data = exact(root.data, ["product_parent_count", "variant_count", "available_variant_count", "category_count"]);
  return {
    product_parent_count: nonNegative(data.product_parent_count), variant_count: nonNegative(data.variant_count),
    available_variant_count: nonNegative(data.available_variant_count), category_count: nonNegative(data.category_count),
  };
}

export function parseProductList(payload: unknown): AdminProductList {
  const root = exact(payload, ["data", "links", "meta"]);
  const meta = exact(root.meta, ["channel", "contract_version", "currency", "current_page", "from", "last_page", "locale", "path", "per_page", "to", "total"]);
  const links = exact(root.links, ["first", "last", "prev", "next"]);
  nullableText(links.first); nullableText(links.last); nullableText(links.prev); nullableText(links.next);
  listVersion(meta);
  const currentPage = positive(meta.current_page); const lastPage = positive(meta.last_page); const perPage = positive(meta.per_page); const total = nonNegative(meta.total);
  nullablePositive(meta.from); nullablePositive(meta.to); nonEmpty(meta.path);
  if (currentPage > lastPage || perPage > 48) bad();
  return { data: list(root.data).map(parseProduct), meta: { current_page: currentPage, last_page: lastPage, per_page: perPage, total } };
}

export function parseProductDetail(payload: unknown): AdminProductDetail {
  const root = exact(payload, ["data", "meta"]);
  version(root.meta);
  const detail = exact(root.data, ["id", "type", "sku", "slug", "name", "description", "image", "categories", "variant_count", "available_variant_count", "starting_price", "option_groups", "variant_index", "variants"]);
  const product = parseProductBase(detail);
  const groups = list(detail.option_groups).map((item) => {
    const group = exact(item, ["attribute_id", "code", "label", "options"]);
    return { attribute_id: positive(group.attribute_id), code: nonEmpty(group.code), label: nonEmpty(group.label), options: list(group.options).map((option) => {
      const value = exact(option, ["option_id", "label", "variant_ids"]);
      return { option_id: positive(value.option_id), label: nonEmpty(value.label), variant_ids: list(value.variant_ids).map(positive) };
    }) };
  });
  const variants = list(detail.variants).map((item) => {
    const value = exact(item, ["id", "sku", "name", "option_values", "image", "unit", "moq", "quantity_step", "contact_from_quantity", "availability", "tier_prices"]);
    const availability = exact(value.availability, ["is_available"]);
    return {
      id: positive(value.id), sku: nonEmpty(value.sku), name: nonEmpty(value.name), unit: nonEmpty(value.unit), moq: positive(value.moq), quantity_step: positive(value.quantity_step), contact_from_quantity: positive(value.contact_from_quantity), availability: { is_available: bool(availability.is_available) },
      tier_prices: list(value.tier_prices).map((tier) => { const price = exact(tier, ["min_quantity", "unit_price", "currency"]); if (text(price.currency) !== "VND") bad(); return { min_quantity: positive(price.min_quantity), unit_price: positive(price.unit_price), currency: "VND" as const }; }),
      option_values: list(value.option_values).map((option) => { const selected = exact(option, ["attribute_id", "attribute_code", "option_id", "option_label"]); return { attribute_id: positive(selected.attribute_id), attribute_code: nonEmpty(selected.attribute_code), option_id: positive(selected.option_id), option_label: nonEmpty(selected.option_label) }; }),
    };
  });
  validateVariantIndex(detail.variant_index, groups, variants);
  return {
    ...product,
    option_groups: groups,
    variants,
  };
}

export function parseLogin(payload: unknown, status: number): { two_factor_required: boolean } {
  if (status === 202) { const error = exact(payload, ["code", "message", "trace_id"]); if (text(error.code) !== "two_factor_required") bad(); return { two_factor_required: true }; }
  const root = exact(payload, ["data"]); const data = exact(root.data, ["admin", "two_factor_required"]);
  parseAdminIdentity({ data: data.admin }); if (bool(data.two_factor_required)) bad(); return { two_factor_required: false };
}

function parseProduct(payload: unknown): AdminProduct {
  const value = exact(payload, ["id", "type", "sku", "slug", "name", "description", "image", "categories", "variant_count", "available_variant_count", "starting_price"]);
  return parseProductBase(value);
}

function parseProductBase(value: Record<string, unknown>): AdminProduct {
  if (text(value.type) !== "configurable") bad();
  const price = value.starting_price === null ? null : exact(value.starting_price, ["unit_price", "currency"]);
  if (price && text(price.currency) !== "VND") bad();
  image(value.image);
  const categories = list(value.categories).map((category) => { const item = exact(category, ["id", "name", "slug", "description", "image", "parent_id"]); nullableText(item.description); nullableInteger(item.parent_id); image(item.image); return { id: positive(item.id), name: nonEmpty(item.name), slug: nonEmpty(item.slug) }; });
  const variantCount = positive(value.variant_count); const available = nonNegative(value.available_variant_count); if (available > variantCount) bad();
  return { id: positive(value.id), type: "configurable", sku: nonEmpty(value.sku), slug: nonEmpty(value.slug), name: nonEmpty(value.name), description: nullableText(value.description), categories, variant_count: variantCount, available_variant_count: available, starting_price: price ? { unit_price: positive(price.unit_price), currency: "VND" } : null };
}

function validateVariantIndex(value: unknown, groups: AdminProductDetail["option_groups"], variants: AdminProductDetail["variants"]) { const index = record(value); const ids = variants.map((variant) => String(variant.id)); if (Object.keys(index).length !== ids.length || ids.some((id) => !(id in index))) bad(); for (const variant of variants) { const selected = record(index[String(variant.id)]); if (Object.keys(selected).length !== groups.length) bad(); for (const group of groups) { if (positive(selected[group.code]) !== variant.option_values.find((item) => item.attribute_id === group.attribute_id)?.option_id) bad(); } } }
function image(value: unknown) { if (value === null) return; const item = exact(value, ["url", "alt"]); nonEmpty(item.url); nullableText(item.alt); }

function version(value: unknown) { const meta = exact(value, ["channel", "locale", "currency", "contract_version"]); if (positive(meta.contract_version) !== 1 || text(meta.currency) !== "VND" || !nonEmpty(meta.channel) || !nonEmpty(meta.locale)) bad(); }
function listVersion(meta: Record<string, unknown>) { if (positive(meta.contract_version) !== 1 || text(meta.currency) !== "VND" || !nonEmpty(meta.channel) || !nonEmpty(meta.locale)) bad(); }
function exact(value: unknown, keys: string[]) { const result = record(value); if (Object.keys(result).length !== keys.length || keys.some((key) => !(key in result))) bad(); return result; }
function record(value: unknown): Record<string, unknown> { if (typeof value !== "object" || value === null || Array.isArray(value)) bad(); return value as Record<string, unknown>; }
function list(value: unknown): unknown[] { if (!Array.isArray(value)) bad(); return value; }
function text(value: unknown): string { if (typeof value !== "string") bad(); return value; }
function nonEmpty(value: unknown): string { const result = text(value).trim(); if (!result) bad(); return result; }
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function nullablePositive(value: unknown) { if (value !== null) positive(value); }
function nullableInteger(value: unknown) { if (value !== null && (typeof value !== "number" || !Number.isInteger(value))) bad(); }
function positive(value: unknown): number { if (typeof value !== "number" || !Number.isInteger(value) || value < 1) bad(); return value; }
function nonNegative(value: unknown): number { if (typeof value !== "number" || !Number.isInteger(value) || value < 0) bad(); return value; }
function bool(value: unknown): boolean { if (typeof value !== "boolean") bad(); return value; }
function bad(): never { throw new AdminContractError(); }
