import "server-only";

import { cache } from "react";

import { fetchBagistoJson, getBagistoApiUrl } from "@/lib/bagisto-api";
import type {
  CatalogCategory,
  CatalogFilters,
  CatalogOption,
  CatalogOptionGroup,
  CatalogOptionValue,
  CatalogProductDetail,
  CatalogProductList,
  CatalogProductParent,
  CatalogTierPrice,
  CatalogVariant,
} from "@/types/catalog";

export class CatalogApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CatalogApiError";
  }
}

export async function getCatalogProducts(filters: CatalogFilters): Promise<CatalogProductList> {
  const url = getBagistoApiUrl("/api/b2b/catalog/products", true);
  if (filters.query) url.searchParams.set("q", filters.query);
  if (filters.category) url.searchParams.set("category", filters.category);
  url.searchParams.set("page", String(filters.page));
  url.searchParams.set("per_page", "12");
  return parseProductList(await fetchJson(url));
}

export const getCatalogProduct = cache(async (slug: string): Promise<CatalogProductDetail | null> => {
  const url = getBagistoApiUrl(`/api/b2b/catalog/products/${encodeURIComponent(slug)}`, true);
  const { payload, response } = await catalogJson(url);
  if (response.status === 404) return null;
  return parseProductResponse(responsePayload(response, payload));
});

export const getCatalogCategories = cache(async (): Promise<CatalogCategory[]> => {
  const root = exactRecord(
    await fetchJson(getBagistoApiUrl("/api/b2b/catalog/categories", true)),
    "Danh mục",
    ["data", "meta"],
  );
  validateBaseMeta(root.meta, "Danh mục.meta", false);
  return array(root.data, "Danh mục.data")
    .map((item, index) => parseCategory(item, `Danh mục.data[${index}]`));
});

async function fetchJson(url: URL): Promise<unknown> {
  const { payload, response } = await catalogJson(url);
  return responsePayload(response, payload);
}

async function catalogJson(url: URL) {
  try {
    return await fetchBagistoJson(url, { headers: { Accept: "application/json" } });
  } catch (error) {
    if (error instanceof SyntaxError) throw new CatalogApiError("Dịch vụ danh mục trả về JSON không hợp lệ.");
    throw error;
  }
}

function responsePayload(response: Response, payload: unknown): unknown {
  if (!response.ok) throw new CatalogApiError("Không thể tải dữ liệu danh mục.", response.status);
  return payload;
}

function parseProductList(payload: unknown): CatalogProductList {
  const root = exactRecord(payload, "Sản phẩm", ["data", "links", "meta"]);
  const links = exactRecord(root.links, "Sản phẩm.links", ["first", "last", "next", "prev"]);
  ["first", "last", "next", "prev"].forEach((key) => nullableString(links[key], `Sản phẩm.links.${key}`));
  const meta = exactRecord(root.meta, "Sản phẩm.meta", [
    "channel", "contract_version", "currency", "current_page", "from", "last_page",
    "locale", "path", "per_page", "to", "total",
  ]);
  validateProductMeta(meta, "Sản phẩm.meta");
  nullablePositiveInteger(meta.from, "Sản phẩm.meta.from");
  nullablePositiveInteger(meta.to, "Sản phẩm.meta.to");
  nonEmptyString(meta.path, "Sản phẩm.meta.path");
  const products = array(root.data, "Sản phẩm.data")
    .map((item, index) => parseParent(item, `Sản phẩm.data[${index}]`, false));
  assertUnique(products.map((product) => product.id), "Sản phẩm.data.id");
  assertUnique(products.map((product) => product.sku), "Sản phẩm.data.sku");
  return {
    products,
    pagination: {
      currentPage: positiveInteger(meta.current_page, "Sản phẩm.meta.current_page"),
      lastPage: positiveInteger(meta.last_page, "Sản phẩm.meta.last_page"),
      perPage: positiveInteger(meta.per_page, "Sản phẩm.meta.per_page"),
      total: nonNegativeInteger(meta.total, "Sản phẩm.meta.total"),
    },
  };
}

function parseProductResponse(payload: unknown): CatalogProductDetail {
  const root = exactRecord(payload, "Sản phẩm", ["data", "meta"]);
  validateProductMeta(
    exactRecord(root.meta, "Sản phẩm.meta", ["channel", "contract_version", "currency", "locale"]),
    "Sản phẩm.meta",
  );
  const value = exactRecord(root.data, "Sản phẩm.data", [
    "available_variant_count", "categories", "description", "id", "image", "name",
    "option_groups", "sku", "slug", "starting_price", "type", "variant_count",
    "variant_index", "variants",
  ]);
  const parent = parseParent(value, "Sản phẩm.data", true);
  const optionGroups = array(value.option_groups, "Sản phẩm.data.option_groups")
    .map((item, index) => parseOptionGroup(item, `Sản phẩm.data.option_groups[${index}]`));
  const variants = array(value.variants, "Sản phẩm.data.variants")
    .map((item, index) => parseVariant(item, `Sản phẩm.data.variants[${index}]`));
  const variantIndex = parseVariantIndex(value.variant_index, "Sản phẩm.data.variant_index");
  validateDetail(parent, optionGroups, variants, variantIndex);
  return { ...parent, optionGroups, variantIndex, variants };
}

function parseParent(payload: unknown, label: string, detail: boolean): CatalogProductParent {
  const value = record(payload, label);
  if (!detail) {
    exactKeys(value, label, [
      "available_variant_count", "categories", "description", "id", "image", "name",
      "sku", "slug", "starting_price", "type", "variant_count",
    ]);
  }
  if (string(value.type, `${label}.type`) !== "configurable") throw invalid(`${label}.type phải là configurable.`);
  const categories = array(value.categories, `${label}.categories`)
    .map((item, index) => parseCategory(item, `${label}.categories[${index}]`));
  assertUnique(categories.map((category) => category.id), `${label}.categories.id`);
  const variantCount = positiveInteger(value.variant_count, `${label}.variant_count`);
  const availableVariantCount = positiveInteger(value.available_variant_count, `${label}.available_variant_count`);
  if (availableVariantCount > variantCount) throw invalid(`${label}.available_variant_count vượt variant_count.`);
  const startingPrice = exactRecord(value.starting_price, `${label}.starting_price`, ["currency", "unit_price"]);
  if (string(startingPrice.currency, `${label}.starting_price.currency`) !== "VND") {
    throw invalid(`${label}.starting_price.currency phải là VND.`);
  }
  const description = nullableString(value.description, `${label}.description`) ?? "";
  return {
    availableVariantCount,
    category: categories[0] ?? null,
    description,
    id: positiveInteger(value.id, `${label}.id`),
    imageUrl: parseImage(value.image, `${label}.image`),
    name: nonEmptyString(value.name, `${label}.name`),
    shortDescription: description,
    sku: nonEmptyString(value.sku, `${label}.sku`),
    slug: nonEmptyString(value.slug, `${label}.slug`),
    startingPrice: {
      currency: "VND",
      price: positiveInteger(startingPrice.unit_price, `${label}.starting_price.unit_price`),
    },
    type: "configurable",
    variantCount,
  };
}

function parseOptionGroup(payload: unknown, label: string): CatalogOptionGroup {
  const value = exactRecord(payload, label, ["attribute_id", "code", "label", "options"]);
  const options = array(value.options, `${label}.options`)
    .map((item, index) => parseOption(item, `${label}.options[${index}]`));
  if (!options.length) throw invalid(`${label}.options không được rỗng.`);
  assertUnique(options.map((option) => option.id), `${label}.options.option_id`);
  return {
    attributeId: positiveInteger(value.attribute_id, `${label}.attribute_id`),
    code: nonEmptyString(value.code, `${label}.code`),
    label: nonEmptyString(value.label, `${label}.label`),
    options,
  };
}

function parseOption(payload: unknown, label: string): CatalogOption {
  const value = exactRecord(payload, label, ["label", "option_id", "variant_ids"]);
  const variantIds = array(value.variant_ids, `${label}.variant_ids`)
    .map((id, index) => positiveInteger(id, `${label}.variant_ids[${index}]`));
  if (!variantIds.length) throw invalid(`${label}.variant_ids không được rỗng.`);
  assertUnique(variantIds, `${label}.variant_ids`);
  return {
    id: positiveInteger(value.option_id, `${label}.option_id`),
    label: nonEmptyString(value.label, `${label}.label`),
    variantIds,
  };
}

function parseVariant(payload: unknown, label: string): CatalogVariant {
  const value = exactRecord(payload, label, [
    "availability", "contact_from_quantity", "id", "image", "moq", "name",
    "option_values", "quantity_step", "sku", "tier_prices", "unit",
  ]);
  const minimumOrderQuantity = positiveInteger(value.moq, `${label}.moq`);
  const quantityStep = positiveInteger(value.quantity_step, `${label}.quantity_step`);
  const contactFromQuantity = positiveInteger(value.contact_from_quantity, `${label}.contact_from_quantity`);
  const tierPrices = array(value.tier_prices, `${label}.tier_prices`)
    .map((item, index) => parseTier(item, `${label}.tier_prices[${index}]`));
  validatePurchaseRules(minimumOrderQuantity, quantityStep, contactFromQuantity, tierPrices, label);
  const optionValues = array(value.option_values, `${label}.option_values`)
    .map((item, index) => parseOptionValue(item, `${label}.option_values[${index}]`));
  assertUnique(optionValues.map((item) => item.attributeId), `${label}.option_values.attribute_id`);
  const availability = exactRecord(value.availability, `${label}.availability`, ["is_available"]);
  return {
    contactFromQuantity,
    id: positiveInteger(value.id, `${label}.id`),
    imageUrl: parseImage(value.image, `${label}.image`),
    isAvailable: boolean(availability.is_available, `${label}.availability.is_available`),
    minimumOrderQuantity,
    name: nonEmptyString(value.name, `${label}.name`),
    optionValues,
    quantityStep,
    sku: nonEmptyString(value.sku, `${label}.sku`),
    tierPrices,
    unit: nonEmptyString(value.unit, `${label}.unit`),
  };
}

function parseOptionValue(payload: unknown, label: string): CatalogOptionValue {
  const value = exactRecord(payload, label, ["attribute_code", "attribute_id", "option_id", "option_label"]);
  return {
    attributeCode: nonEmptyString(value.attribute_code, `${label}.attribute_code`),
    attributeId: positiveInteger(value.attribute_id, `${label}.attribute_id`),
    optionId: positiveInteger(value.option_id, `${label}.option_id`),
    optionLabel: nonEmptyString(value.option_label, `${label}.option_label`),
  };
}

function parseVariantIndex(payload: unknown, label: string): Record<string, Record<string, number>> {
  const value = record(payload, label);
  return Object.fromEntries(Object.entries(value).map(([variantId, options]) => {
    positiveInteger(Number(variantId), `${label}.${variantId}`);
    const optionMap = record(options, `${label}.${variantId}`);
    return [variantId, Object.fromEntries(Object.entries(optionMap).map(([code, optionId]) => [
      nonEmptyString(code, `${label}.${variantId}.code`),
      positiveInteger(optionId, `${label}.${variantId}.${code}`),
    ]))];
  }));
}

function validateDetail(
  parent: CatalogProductParent,
  groups: CatalogOptionGroup[],
  variants: CatalogVariant[],
  index: Record<string, Record<string, number>>,
) {
  if (groups.length !== 1 || !variants.length) throw invalid("Sản phẩm.data phải có đúng một option_group và variants.");
  assertUnique(groups.map((group) => group.attributeId), "Sản phẩm.data.option_groups.attribute_id");
  assertUnique(groups.map((group) => group.code), "Sản phẩm.data.option_groups.code");
  assertUnique(variants.map((variant) => variant.id), "Sản phẩm.data.variants.id");
  assertUnique(variants.map((variant) => variant.sku), "Sản phẩm.data.variants.sku");
  if (parent.variantCount !== variants.length) throw invalid("Sản phẩm.data.variant_count không khớp variants.");
  if (parent.availableVariantCount !== variants.filter((variant) => variant.isAvailable).length) {
    throw invalid("Sản phẩm.data.available_variant_count không khớp variants.");
  }
  const availableStartingPrice = Math.min(...variants
    .filter((variant) => variant.isAvailable)
    .map((variant) => variant.tierPrices[0].price));
  if (parent.startingPrice.price !== availableStartingPrice) {
    throw invalid("Sản phẩm.data.starting_price không khớp giá tại MOQ.");
  }
  const expectedVariantKeys = variants.map((variant) => String(variant.id)).sort();
  if (!sameValues(Object.keys(index).sort(), expectedVariantKeys)) throw invalid("Sản phẩm.data.variant_index không khớp variants.");
  for (const variant of variants) {
    if (variant.optionValues.length !== groups.length) throw invalid(`Variant ${variant.sku} thiếu lựa chọn.`);
    const indexEntry = index[String(variant.id)];
    if (!sameValues(Object.keys(indexEntry).sort(), groups.map((group) => group.code).sort())) {
      throw invalid(`Variant index ${variant.sku} không khớp option groups.`);
    }
    for (const group of groups) {
      const selected = variant.optionValues.find((item) => item.attributeId === group.attributeId && item.attributeCode === group.code);
      const option = selected && group.options.find((item) => item.id === selected.optionId);
      if (!selected || !option || option.label !== selected.optionLabel || indexEntry[group.code] !== selected.optionId) {
        throw invalid(`Variant ${variant.sku} có lựa chọn không nhất quán.`);
      }
    }
  }
  for (const group of groups) {
    for (const option of group.options) {
      if (option.variantIds.length !== 1) throw invalid(`Option ${option.label} phải trỏ đến đúng một variant.`);
      const expectedIds = variants
        .filter((variant) => variant.optionValues.some((item) => item.attributeId === group.attributeId && item.optionId === option.id))
        .map((variant) => variant.id)
        .sort((a, b) => a - b);
      if (!sameValues([...option.variantIds].sort((a, b) => a - b), expectedIds)) {
        throw invalid(`Option ${option.label} có variant_ids không nhất quán.`);
      }
    }
  }
}

function validatePurchaseRules(
  minimumOrderQuantity: number,
  quantityStep: number,
  contactFromQuantity: number,
  tiers: CatalogTierPrice[],
  label: string,
) {
  if (contactFromQuantity <= minimumOrderQuantity || (contactFromQuantity - minimumOrderQuantity) % quantityStep !== 0) {
    throw invalid(`${label}.contact_from_quantity không khớp MOQ và bước số lượng.`);
  }
  if (
    tiers[0]?.minQuantity !== minimumOrderQuantity
    || tiers.some((tier, index) => (
      tier.minQuantity >= contactFromQuantity
      || (tier.minQuantity - minimumOrderQuantity) % quantityStep !== 0
      || (index > 0 && tier.minQuantity <= tiers[index - 1].minQuantity)
    ))
  ) {
    throw invalid(`${label}.tier_prices không khớp quy tắc số lượng.`);
  }
}

function validateProductMeta(payload: unknown, label: string) {
  const meta = record(payload, label);
  nonEmptyString(meta.channel, `${label}.channel`);
  nonEmptyString(meta.locale, `${label}.locale`);
  if (positiveInteger(meta.contract_version, `${label}.contract_version`) !== 2) throw invalid(`${label}.contract_version phải là 2.`);
  if (string(meta.currency, `${label}.currency`) !== "VND") throw invalid(`${label}.currency phải là VND.`);
}

function validateBaseMeta(payload: unknown, label: string, withCurrency: boolean) {
  const keys = withCurrency
    ? ["channel", "contract_version", "currency", "locale"]
    : ["channel", "contract_version", "locale"];
  const meta = exactRecord(payload, label, keys);
  nonEmptyString(meta.channel, `${label}.channel`);
  nonEmptyString(meta.locale, `${label}.locale`);
  if (positiveInteger(meta.contract_version, `${label}.contract_version`) !== 2) throw invalid(`${label}.contract_version phải là 2.`);
  if (withCurrency && string(meta.currency, `${label}.currency`) !== "VND") throw invalid(`${label}.currency phải là VND.`);
}

function parseCategory(payload: unknown, label: string): CatalogCategory {
  const value = exactRecord(payload, label, ["description", "id", "image", "name", "parent_id", "slug"]);
  nullableInteger(value.parent_id, `${label}.parent_id`);
  nullableString(value.description, `${label}.description`);
  parseImage(value.image, `${label}.image`);
  return {
    id: positiveInteger(value.id, `${label}.id`),
    name: nonEmptyString(value.name, `${label}.name`),
    slug: nonEmptyString(value.slug, `${label}.slug`),
  };
}

function parseTier(payload: unknown, label: string): CatalogTierPrice {
  const value = exactRecord(payload, label, ["currency", "min_quantity", "unit_price"]);
  if (string(value.currency, `${label}.currency`) !== "VND") throw invalid(`${label}.currency phải là VND.`);
  return {
    minQuantity: positiveInteger(value.min_quantity, `${label}.min_quantity`),
    price: positiveInteger(value.unit_price, `${label}.unit_price`),
  };
}

function parseImage(value: unknown, label: string): string | null {
  if (value === null) return null;
  const image = exactRecord(value, label, ["alt", "url"]);
  const url = nonEmptyString(image.url, `${label}.url`);
  nullableString(image.alt, `${label}.alt`);
  let parsed: URL;
  try {
    parsed = new URL(url, getBagistoApiUrl("/", true));
  } catch {
    throw invalid(`${label}.url không hợp lệ.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw invalid(`${label}.url không hợp lệ.`);
  return parsed.toString();
}

function exactRecord(value: unknown, label: string, keys: string[]): Record<string, unknown> {
  const result = record(value, label);
  exactKeys(result, label, keys);
  return result;
}

function exactKeys(value: Record<string, unknown>, label: string, keys: string[]) {
  if (!sameValues(Object.keys(value).sort(), [...keys].sort())) throw invalid(`${label} không đúng định dạng.`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid(`${label} phải là object.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw invalid(`${label} phải là mảng.`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw invalid(`${label} phải là chuỗi.`);
  return value;
}

function nonEmptyString(value: unknown, label: string): string {
  const result = string(value, label).trim();
  if (!result) throw invalid(`${label} không được rỗng.`);
  return result;
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw invalid(`${label} phải là boolean.`);
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw invalid(`${label} phải là số nguyên dương.`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw invalid(`${label} phải là số nguyên không âm.`);
  return value;
}

function nullablePositiveInteger(value: unknown, label: string): number | null {
  return value === null ? null : positiveInteger(value, label);
}

function nullableInteger(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) throw invalid(`${label} phải là số nguyên hoặc null.`);
  return value;
}

function assertUnique(values: Array<number | string>, label: string) {
  if (new Set(values).size !== values.length) throw invalid(`${label} không được trùng.`);
}

function sameValues(left: Array<number | string>, right: Array<number | string>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function invalid(message: string): CatalogApiError {
  return new CatalogApiError(`Dữ liệu danh mục không hợp lệ: ${message}`);
}
