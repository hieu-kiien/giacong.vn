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

export interface AdminTierPrice {
  min_quantity: number;
  unit_price: number | null;
  currency: "VND";
}

export interface AdminProductVariant {
  id: number;
  sku: string;
  name: string;
  published: boolean;
  unit: string | null;
  moq: number | null;
  quantity_step: number | null;
  contact_from_quantity: number | null;
  availability: { is_available: boolean };
  tier_prices: AdminTierPrice[];
  option_values: Array<{
    attribute_id: number;
    attribute_code: string;
    option_id: number;
    option_label: string;
  }>;
  validation_errors: string[];
}

export interface AdminProduct {
  id: number;
  type: "configurable";
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  categories: Array<{ id: number; name: string; slug: string }>;
  variant_count: number;
  available_variant_count: number;
  starting_price: { unit_price: number; currency: "VND" } | null;
  published: boolean;
  resource_version: string;
  validation_errors: string[];
}

export interface AdminProductList {
  data: AdminProduct[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface AdminProductDetail extends AdminProduct {
  option_groups: Array<{
    attribute_id: number;
    code: string;
    label: string;
    options: Array<{ option_id: number; label: string; variant_ids: number[] }>;
  }>;
  variants: AdminProductVariant[];
}

export interface CommercialRulesSnapshot {
  version: string;
  published: boolean;
  variants: Array<{
    id: number;
    published: boolean;
    unit: string;
    moq: number;
    quantity_step: number;
    contact_from_quantity: number;
    tier_prices: Array<{ min_quantity: number; unit_price: number }>;
  }>;
}

export function parseAdminIdentity(payload: unknown): AdminIdentity {
  const root = exact(payload, ["data"]);
  const data = exact(root.data, ["id", "name", "email", "role", "permissions"]);
  const role = exact(data.role, ["id", "name"]);
  const permissions = list(data.permissions).map(text);
  const allowed = new Set(["*", "b2b.dashboard", "b2b.catalog.read", "b2b.catalog.write"]);
  if (!permissions.every((permission) => allowed.has(permission))) bad();
  return {
    id: positive(data.id),
    name: nonEmpty(data.name),
    email: nonEmpty(data.email),
    role: { id: positive(role.id), name: nonEmpty(role.name) },
    permissions,
  };
}

export function parseDashboard(payload: unknown): AdminDashboard {
  const root = exact(payload, ["data", "meta"]);
  version(root.meta);
  const data = exact(root.data, ["product_parent_count", "variant_count", "available_variant_count", "category_count"]);
  return {
    product_parent_count: nonNegative(data.product_parent_count),
    variant_count: nonNegative(data.variant_count),
    available_variant_count: nonNegative(data.available_variant_count),
    category_count: nonNegative(data.category_count),
  };
}

export function parseProductList(payload: unknown): AdminProductList {
  const root = exact(payload, ["data", "links", "meta"]);
  const meta = exact(root.meta, ["channel", "contract_version", "currency", "current_page", "from", "last_page", "locale", "path", "per_page", "to", "total"]);
  const links = exact(root.links, ["first", "last", "prev", "next"]);
  nullableText(links.first);
  nullableText(links.last);
  nullableText(links.prev);
  nullableText(links.next);
  listVersion(meta);
  const currentPage = positive(meta.current_page);
  const lastPage = positive(meta.last_page);
  const perPage = positive(meta.per_page);
  const total = nonNegative(meta.total);
  nullablePositive(meta.from);
  nullablePositive(meta.to);
  nonEmpty(meta.path);
  if (currentPage > lastPage || perPage > 48) bad();
  return {
    data: list(root.data).map(parseProduct),
    meta: { current_page: currentPage, last_page: lastPage, per_page: perPage, total },
  };
}

export function parseProductDetail(payload: unknown, responseEtag?: string): AdminProductDetail {
  const root = exact(payload, ["data", "meta"]);
  const meta = detailVersion(root.meta);
  const detail = exact(root.data, [
    "id", "type", "sku", "slug", "name", "description", "image", "categories",
    "variant_count", "available_variant_count", "starting_price", "published",
    "resource_version", "validation_errors", "option_groups", "variant_index", "variants",
  ]);
  const product = parseProductBase(detail);
  if (product.resource_version !== meta || (responseEtag !== undefined && strongEtag(responseEtag) !== meta)) bad();
  const groups = list(detail.option_groups).map((item) => {
    const group = exact(item, ["attribute_id", "code", "label", "options"]);
    return {
      attribute_id: positive(group.attribute_id),
      code: nonEmpty(group.code),
      label: nonEmpty(group.label),
      options: list(group.options).map((option) => {
        const value = exact(option, ["option_id", "label", "variant_ids"]);
        return { option_id: positive(value.option_id), label: nonEmpty(value.label), variant_ids: list(value.variant_ids).map(positive) };
      }),
    };
  });
  const variants = list(detail.variants).map(parseVariant);
  validateVariantIndex(detail.variant_index, groups, variants);
  if (variants.length !== product.variant_count) bad();
  return { ...product, option_groups: groups, variants };
}

export function parseCommercialRulesSnapshot(payload: unknown): CommercialRulesSnapshot {
  const root = exact(payload, ["version", "published", "variants"]);
  const variants = list(root.variants).map((item) => {
    const variant = exact(item, ["id", "published", "unit", "moq", "quantity_step", "contact_from_quantity", "tier_prices"]);
    const unit = nonEmpty(variant.unit);
    if (unit.length > 32) bad();
    const tiers = list(variant.tier_prices);
    if (tiers.length < 1 || tiers.length > 20) bad();
    return {
      id: positive(variant.id),
      published: bool(variant.published),
      unit,
      moq: positiveBounded(variant.moq, 4_294_967_295),
      quantity_step: positiveBounded(variant.quantity_step, 4_294_967_295),
      contact_from_quantity: positiveBounded(variant.contact_from_quantity, 4_294_967_295),
      tier_prices: tiers.map((item) => {
        const tier = exact(item, ["min_quantity", "unit_price"]);
        return {
          min_quantity: positiveBounded(tier.min_quantity, 4_294_967_295),
          unit_price: positiveBounded(tier.unit_price, 99_999_999),
        };
      }),
    };
  });
  if (variants.length < 1 || new Set(variants.map((variant) => variant.id)).size !== variants.length) bad();
  return { version: strongEtag(root.version), published: bool(root.published), variants };
}

export function parseLogin(payload: unknown, status: number): { two_factor_required: boolean } {
  if (status === 202) {
    const error = exact(payload, ["code", "message", "trace_id"]);
    if (text(error.code) !== "two_factor_required") bad();
    return { two_factor_required: true };
  }
  const root = exact(payload, ["data"]);
  const data = exact(root.data, ["admin", "two_factor_required"]);
  parseAdminIdentity({ data: data.admin });
  if (bool(data.two_factor_required)) bad();
  return { two_factor_required: false };
}

export function isStrongResourceVersion(value: unknown): value is string {
  return typeof value === "string" && /^"[a-f0-9]{64}"$/.test(value);
}

function parseProduct(payload: unknown): AdminProduct {
  return parseProductBase(exact(payload, [
    "id", "type", "sku", "slug", "name", "description", "image", "categories",
    "variant_count", "available_variant_count", "starting_price", "published",
    "resource_version", "validation_errors",
  ]));
}

function parseProductBase(value: Record<string, unknown>): AdminProduct {
  if (text(value.type) !== "configurable") bad();
  const price = value.starting_price === null ? null : exact(value.starting_price, ["unit_price", "currency"]);
  if (price && text(price.currency) !== "VND") bad();
  image(value.image);
  const categories = list(value.categories).map((category) => {
    const item = exact(category, ["id", "name", "slug", "description", "image", "parent_id"]);
    nullableText(item.description);
    nullableInteger(item.parent_id);
    image(item.image);
    return { id: positive(item.id), name: nonEmpty(item.name), slug: nonEmpty(item.slug) };
  });
  const variantCount = positive(value.variant_count);
  const available = nonNegative(value.available_variant_count);
  if (available > variantCount) bad();
  return {
    id: positive(value.id),
    type: "configurable",
    sku: nonEmpty(value.sku),
    slug: nonEmpty(value.slug),
    name: nonEmpty(value.name),
    description: nullableText(value.description),
    categories,
    variant_count: variantCount,
    available_variant_count: available,
    starting_price: price ? { unit_price: positive(price.unit_price), currency: "VND" } : null,
    published: bool(value.published),
    resource_version: strongEtag(value.resource_version),
    validation_errors: validationErrors(value.validation_errors),
  };
}

function parseVariant(payload: unknown): AdminProductVariant {
  const value = exact(payload, [
    "id", "sku", "name", "published", "option_values", "image", "unit", "moq",
    "quantity_step", "contact_from_quantity", "availability", "tier_prices", "validation_errors",
  ]);
  const availability = exact(value.availability, ["is_available"]);
  image(value.image);
  return {
    id: positive(value.id),
    sku: nonEmpty(value.sku),
    name: nonEmpty(value.name),
    published: bool(value.published),
    unit: nullableNonEmpty(value.unit),
    moq: nullablePositiveInteger(value.moq),
    quantity_step: nullablePositiveInteger(value.quantity_step),
    contact_from_quantity: nullablePositiveInteger(value.contact_from_quantity),
    availability: { is_available: bool(availability.is_available) },
    tier_prices: list(value.tier_prices).map((item) => {
      const tier = exact(item, ["min_quantity", "unit_price", "currency"]);
      if (text(tier.currency) !== "VND") bad();
      return {
        min_quantity: positive(tier.min_quantity),
        unit_price: nullablePositiveInteger(tier.unit_price),
        currency: "VND" as const,
      };
    }),
    option_values: list(value.option_values).map((option) => {
      const selected = exact(option, ["attribute_id", "attribute_code", "option_id", "option_label"]);
      return {
        attribute_id: positive(selected.attribute_id),
        attribute_code: nonEmpty(selected.attribute_code),
        option_id: positive(selected.option_id),
        option_label: nonEmpty(selected.option_label),
      };
    }),
    validation_errors: validationErrors(value.validation_errors),
  };
}

function validateVariantIndex(
  value: unknown,
  groups: AdminProductDetail["option_groups"],
  variants: AdminProductDetail["variants"],
) {
  const index = record(value);
  const ids = variants.map((variant) => String(variant.id));
  if (Object.keys(index).length !== ids.length || ids.some((id) => !(id in index))) bad();
  for (const variant of variants) {
    const selected = record(index[String(variant.id)]);
    if (Object.keys(selected).length !== groups.length) bad();
    for (const group of groups) {
      if (positive(selected[group.code]) !== variant.option_values.find((item) => item.attribute_id === group.attribute_id)?.option_id) bad();
    }
  }
}

function image(value: unknown) {
  if (value === null) return;
  const item = exact(value, ["url", "alt"]);
  nonEmpty(item.url);
  nullableText(item.alt);
}

function version(value: unknown) {
  const meta = exact(value, ["channel", "locale", "currency", "contract_version"]);
  listVersion(meta);
}

function detailVersion(value: unknown): string {
  const meta = exact(value, ["channel", "locale", "currency", "contract_version", "resource_version"]);
  listVersion(meta);
  return strongEtag(meta.resource_version);
}

function listVersion(meta: Record<string, unknown>) {
  if (positive(meta.contract_version) !== 1 || text(meta.currency) !== "VND" || !nonEmpty(meta.channel) || !nonEmpty(meta.locale)) bad();
}

function validationErrors(value: unknown): string[] {
  const errors = list(value).map(text);
  if (errors.some((error) => !/^[a-z][a-z0-9_]{0,63}$/.test(error)) || new Set(errors).size !== errors.length) bad();
  return errors;
}

function strongEtag(value: unknown): string {
  if (!isStrongResourceVersion(value)) bad();
  return value;
}

function exact(value: unknown, keys: string[]) {
  const result = record(value);
  if (Object.keys(result).length !== keys.length || keys.some((key) => !(key in result))) bad();
  return result;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) bad();
  return value as Record<string, unknown>;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) bad();
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") bad();
  return value;
}

function nonEmpty(value: unknown): string {
  const result = text(value).trim();
  if (!result) bad();
  return result;
}

function nullableNonEmpty(value: unknown): string | null {
  return value === null ? null : nonEmpty(value);
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function nullablePositive(value: unknown) {
  if (value !== null) positive(value);
}

function nullableInteger(value: unknown) {
  if (value !== null && (typeof value !== "number" || !Number.isInteger(value))) bad();
}

function nullablePositiveInteger(value: unknown): number | null {
  return value === null ? null : positive(value);
}

function positive(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) bad();
  return value;
}

function positiveBounded(value: unknown, maximum: number): number {
  const result = positive(value);
  if (result > maximum) bad();
  return result;
}

function nonNegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) bad();
  return value;
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") bad();
  return value;
}

function bad(): never {
  throw new AdminContractError();
}
