import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AdminCatalogWriteConflictError,
  AdminCatalogWriteIdempotencyConflictError,
  AdminCatalogWriteStorageError,
  archiveAdminProductAtomically,
  createAdminProductAtomically,
  createAdminProductVariantAtomically,
  updateAdminProductAtomically,
  updateAdminProductVariantAtomically,
} from "../src/lib/admin-catalog-write.ts";
import { parseAdminProductCreateCommand, parseAdminProductUpdateCommand } from "../src/lib/admin-product-command.ts";
import { parseAdminProductVariantCreateCommand, parseAdminProductVariantUpdateCommand } from "../src/lib/admin-variant-command.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";

const root = new URL("../", import.meta.url);
const actor = "owner@example.com";
const productRequest = "11111111-1111-4111-8111-111111111111";
const updateRequest = "22222222-2222-4222-8222-222222222222";
const variantRequest = "33333333-3333-4333-8333-333333333333";

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, root), "utf8");
}

const productFields = {
  categoryId: null,
  description: "Mô tả sản phẩm",
  imageUrl: null,
  isActive: false,
  leadTimeDays: 14,
  name: "Bột thử nghiệm",
  shortDescription: "Mô tả ngắn",
  sku: "TEST-PRODUCT-01",
  slug: "bot-thu-nghiem",
  status: "draft" as const,
};

const variantFields = {
  attributeCode: "b2b_variant",
  attributeId: 31,
  attributeLabel: "Phiên bản",
  contactFromQuantity: 100,
  imageUrl: null,
  isAvailable: true,
  moq: 10,
  name: "Bao 10 kg",
  optionId: 1,
  optionLabel: "Bao 10 kg",
  quantityStep: 10,
  sku: "TEST-VARIANT-01",
  sortOrder: 0,
  tierPrices: [{ currency: "VND" as const, minQuantity: 10, price: 78000 }],
  unit: "kg",
};

class FakeCatalogStatement implements D1PreparedStatementLike {
  values: unknown[] = [];
  readonly database: FakeCatalogDatabase;
  readonly query: string;

  constructor(database: FakeCatalogDatabase, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): FakeCatalogStatement {
    this.values = values;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.database.all<T>(this.query, this.values) };
  }

  async first<T>(): Promise<T | null> {
    return this.database.first<T>(this.query, this.values);
  }

  async run(): Promise<unknown> {
    return this.database.execute(this.query, this.values);
  }
}

type ProductState = {
  category_id: number | null;
  description: string;
  id: number;
  image_url: string | null;
  is_active: number;
  lead_time_days: number | null;
  meta_updated_at: string | null;
  name: string;
  revision: number;
  short_description: string;
  sku: string;
  slug: string;
  status: string;
};

type VariantState = {
  attribute_code: string;
  attribute_id: number;
  attribute_label: string;
  contact_from_quantity: number;
  id: number;
  image_url: string | null;
  is_available: number;
  moq: number;
  name: string;
  option_id: number;
  option_label: string;
  product_id: number;
  quantity_step: number;
  revision: number;
  sku: string;
  sort_order: number;
  unit: string;
};

type TierState = { currency: "VND"; id: number; min_quantity: number; price: number; variant_id: number };
type MutationState = { action: string; entity_key: string; entity_type: string; payload_sha256: string; request_id: string };

class FakeCatalogDatabase implements D1DatabaseLike {
  readonly products = new Map<number, ProductState>();
  readonly variants = new Map<number, VariantState>();
  readonly tiers: TierState[] = [];
  readonly mutations = new Map<string, MutationState>();
  batchCalls = 0;
  failTierInsert = false;
  returnEmptyMetaResult = false;
  returnEmptyMutationResult = false;
  private nextProductId = 1;
  private nextVariantId = 1;
  private nextTierId = 1;
  private lastChanges = 0;
  private pendingRequestId: string | null = null;
  private productWriteSucceeded = false;

  prepare(query: string): FakeCatalogStatement {
    return new FakeCatalogStatement(this, query);
  }

  async batch(statements: FakeCatalogStatement[]): Promise<unknown[]> {
    this.batchCalls += 1;
    const snapshot = this.snapshot();
    this.pendingRequestId = null;
    this.productWriteSucceeded = false;
    try {
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    } catch (error) {
      this.restore(snapshot);
      this.pendingRequestId = null;
      this.productWriteSucceeded = false;
      throw error;
    }
  }

  first<T>(query: string, values: unknown[]): T | null {
    if (query.includes("sqlite_master")) {
      const table = String(values[0]);
      return (["admin_audit_log", "product_admin_meta"].includes(table) ? { name: table } : null) as T | null;
    }
    if (query.includes("catalog-product-postcondition-read")) {
      const requestId = String(values[0]);
      const mutation = this.mutations.get(requestId);
      const product = mutation ? this.products.get(Number(mutation.entity_key)) : null;
      return { complete: mutation && product && product.meta_updated_at !== null ? 1 : 0 } as T;
    }
    if (query.includes("FROM admin_audit_log")) return (this.mutations.get(String(values[0])) ?? null) as T | null;
    if (query.includes("FROM product_variants") && query.includes("SELECT product_id")) {
      const row = this.variants.get(Number(values[0]));
      return row ? ({ product_id: row.product_id } as T) : null;
    }
    if (query.includes("FROM products")) {
      const row = this.products.get(Number(values.at(-1)));
      return row ? ({ ...row, category_name: null } as T) : null;
    }
    if (query.includes("FROM product_variants")) {
      const row = this.variants.get(Number(values[1]));
      return row && row.product_id === Number(values[0]) ? ({ ...row } as T) : null;
    }
    throw new Error(`Unexpected first query: ${query}`);
  }

  all<T>(query: string, values: unknown[]): T[] {
    if (query.includes("FROM variant_tier_prices")) {
      const variantId = Number(values[0]);
      return this.tiers.filter((tier) => tier.variant_id === variantId).map((tier) => ({ ...tier })) as T[];
    }
    throw new Error(`Unexpected all query: ${query}`);
  }

  execute(query: string, values: unknown[]): { meta: { changes: number }; results?: unknown[] } {
    if (query.includes("INSERT INTO products")) {
      const [name, slug, sku, shortDescription, description, imageUrl, categoryId, isActive] = values;
      const id = this.nextProductId++;
      this.products.set(id, {
        category_id: (categoryId as number | null) ?? null,
        description: String(description),
        id,
        image_url: (imageUrl as string | null) ?? null,
        is_active: Number(isActive),
        lead_time_days: null,
        meta_updated_at: null,
        name: String(name),
        revision: 1,
        short_description: String(shortDescription),
        sku: String(sku),
        slug: String(slug),
        status: "draft",
      });
      this.lastChanges = 1;
      this.productWriteSucceeded = true;
      return { meta: { changes: 1 }, results: [{ id, revision: 1 }] };
    }
    if (query.includes("INSERT INTO product_variants")) {
      const [productId, name, sku, optionLabel, unit, moq, quantityStep, contactFromQuantity, isAvailable, sortOrder, attributeId, attributeCode, attributeLabel, optionId, imageUrl] = values;
      const id = this.nextVariantId++;
      this.variants.set(id, {
        attribute_code: String(attributeCode),
        attribute_id: Number(attributeId),
        attribute_label: String(attributeLabel),
        contact_from_quantity: Number(contactFromQuantity),
        id,
        image_url: (imageUrl as string | null) ?? null,
        is_available: Number(isAvailable),
        moq: Number(moq),
        name: String(name),
        option_id: Number(optionId),
        option_label: String(optionLabel),
        product_id: Number(productId),
        quantity_step: Number(quantityStep),
        revision: 1,
        sku: String(sku),
        sort_order: Number(sortOrder),
        unit: String(unit),
      });
      this.lastChanges = 1;
      return { meta: { changes: 1 }, results: [{ id, revision: 1 }] };
    }
    if (query.includes("UPDATE products")) return this.updateProduct(query, values);
    if (query.includes("UPDATE product_variants")) return this.updateVariant(query, values);
    if (query.includes("catalog-product-postcondition-assert")) return this.executeProductPostconditionAssertion();
    if (query.includes("INSERT INTO admin_audit_log")) return this.insertMutation(query, values);
    if (query.includes("INSERT INTO product_admin_meta")) {
      if (this.returnEmptyMetaResult) {
        this.lastChanges = 0;
        return { meta: { changes: 0 }, results: [] };
      }
      const archive = query.includes("'archived'");
      const requestId = String(archive ? values[2] : values.at(-1));
      const productId = archive
        ? Number(values[0])
        : values[0] === null
          ? Number(this.mutations.get(requestId)?.entity_key)
          : Number(values[0]);
      const row = this.products.get(productId);
      if (!row || !this.mutations.has(requestId)) return { meta: { changes: 0 }, results: [] };
      row.status = archive ? "archived" : String(values[2]);
      row.lead_time_days = archive ? null : (values[3] as number | null) ?? null;
      row.meta_updated_at = "2026-08-31T00:00:00.000Z";
      this.lastChanges = 1;
      return { meta: { changes: 1 }, results: [{ product_id: productId }] };
    }
    if (query.includes("DELETE FROM variant_tier_prices")) {
      const variantId = Number(values[0]);
      const requestId = String(values[1]);
      if (!this.mutations.has(requestId)) return { meta: { changes: 0 }, results: [] };
      const removed = this.tiers.filter((tier) => tier.variant_id === variantId);
      for (const tier of removed) this.tiers.splice(this.tiers.indexOf(tier), 1);
      this.lastChanges = removed.length;
      return { meta: { changes: removed.length }, results: removed.map((tier) => ({ id: tier.id })) };
    }
    if (query.includes("INSERT INTO variant_tier_prices")) {
      if (this.failTierInsert) throw new Error("tier insert failed");
      const createdVariant = query.includes("FROM product_variants");
      const [variantId, minQuantity, price, currency, requestId] = createdVariant
        ? [this.findVariant(Number(values[3]), String(values[4]))?.id, values[0], values[1], values[2], values[5]]
        : [values[0], values[1], values[2], values[3], values[4]];
      if (!this.mutations.has(String(requestId))) return { meta: { changes: 0 }, results: [] };
      const tier = { currency: String(currency) as "VND", id: this.nextTierId++, min_quantity: Number(minQuantity), price: Number(price), variant_id: Number(variantId) };
      this.tiers.push(tier);
      this.lastChanges = 1;
      return { meta: { changes: 1 }, results: [{ id: tier.id }] };
    }
    throw new Error(`Unhandled fake statement: ${query}`);
  }

  private updateProduct(query: string, values: unknown[]): { meta: { changes: number }; results: unknown[] } {
    const isArchive = values.length === 2;
    const id = Number(values[isArchive ? 0 : 8]);
    const expectedRevision = Number(values[isArchive ? 1 : 9]);
    const row = this.products.get(id);
    if (!row || row.revision !== expectedRevision) {
      this.lastChanges = 0;
      return { meta: { changes: 0 }, results: [] };
    }
    if (isArchive) {
      row.is_active = 0;
      row.status = "archived";
    } else {
      row.name = String(values[0]);
      row.slug = String(values[1]);
      row.sku = String(values[2]);
      row.short_description = String(values[3]);
      row.description = String(values[4]);
      row.image_url = (values[5] as string | null) ?? null;
      row.category_id = (values[6] as number | null) ?? null;
      row.is_active = Number(values[7]);
    }
    row.revision += 1;
    this.lastChanges = 1;
    this.productWriteSucceeded = true;
    return { meta: { changes: 1 }, results: [{ id, revision: row.revision }] };
  }

  private updateVariant(query: string, values: unknown[]): { meta: { changes: number }; results: unknown[] } {
    const isArchive = values.length === 3;
    const productId = Number(values[isArchive ? 0 : 14]);
    const variantId = Number(values[isArchive ? 1 : 15]);
    const expectedRevision = Number(values[isArchive ? 2 : 16]);
    const row = this.variants.get(variantId);
    if (!row || row.product_id !== productId || row.revision !== expectedRevision || (isArchive && row.is_available !== 1)) {
      this.lastChanges = 0;
      return { meta: { changes: 0 }, results: [] };
    }
    if (isArchive) row.is_available = 0;
    else {
      row.name = String(values[0]);
      row.sku = String(values[1]);
      row.option_label = String(values[2]);
      row.unit = String(values[3]);
      row.moq = Number(values[4]);
      row.quantity_step = Number(values[5]);
      row.contact_from_quantity = Number(values[6]);
      row.is_available = Number(values[7]);
      row.sort_order = Number(values[8]);
      row.attribute_id = Number(values[9]);
      row.attribute_code = String(values[10]);
      row.attribute_label = String(values[11]);
      row.option_id = Number(values[12]);
      row.image_url = (values[13] as string | null) ?? null;
    }
    row.revision += 1;
    this.lastChanges = 1;
    return { meta: { changes: 1 }, results: [{ id: row.id, revision: row.revision }] };
  }

  private insertMutation(query: string, values: unknown[]): { meta: { changes: number }; results: unknown[] } {
    if (this.lastChanges !== 1) return { meta: { changes: 0 }, results: [] };
    const action = query.includes("'create'") ? "create" : query.includes("'delete'") ? "delete" : "update";
    const isProduct = query.includes("FROM products");
    const requestId = String(values[0]);
    this.pendingRequestId = requestId;
    if (this.mutations.has(requestId)) throw new Error("UNIQUE constraint failed: admin_audit_log.request_id");
    const entityKey = isProduct
      ? (action === "create" ? String(this.findProductBySlug(String(values[3]))?.id ?? "") : String(this.products.get(Number(values[4]))?.id ?? ""))
      : (action === "create" ? String(this.findVariant(Number(values[3]), String(values[4]))?.id ?? "") : String(this.variants.get(Number(values[5]))?.id ?? ""));
    if (!entityKey) return { meta: { changes: 0 }, results: [] };
    const hash = action === "create" ? String(values[2]) : String(values[3]);
    const mutation = { action, entity_key: entityKey, entity_type: isProduct ? "product" : "variant", payload_sha256: hash, request_id: requestId };
    this.mutations.set(requestId, mutation);
    this.lastChanges = 1;
    if (this.returnEmptyMutationResult) return { meta: { changes: 1 }, results: [] };
    return { meta: { changes: 1 }, results: [{ request_id: requestId }] };
  }

  private executeProductPostconditionAssertion(): { meta: { changes: number }; results: unknown[] } {
    const mutation = this.pendingRequestId ? this.mutations.get(this.pendingRequestId) : null;
    const product = mutation ? this.products.get(Number(mutation.entity_key)) : null;
    if (this.productWriteSucceeded && (!mutation || !product || product.meta_updated_at === null)) {
      throw new Error("catalog product write postcondition failed");
    }
    return { meta: { changes: 0 }, results: [] };
  }

  private findProductBySlug(slug: string): ProductState | undefined {
    return [...this.products.values()].find((row) => row.slug === slug);
  }

  private findVariant(productId: number, sku: string): VariantState | undefined {
    return [...this.variants.values()].find((row) => row.product_id === productId && row.sku === sku);
  }

  private snapshot() {
    return {
      mutations: new Map([...this.mutations].map(([key, value]) => [key, { ...value }])),
      nextProductId: this.nextProductId,
      nextTierId: this.nextTierId,
      nextVariantId: this.nextVariantId,
      products: new Map([...this.products].map(([key, value]) => [key, { ...value }])),
      tiers: this.tiers.map((tier) => ({ ...tier })),
      variants: new Map([...this.variants].map(([key, value]) => [key, { ...value }])),
    };
  }

  private restore(snapshot: ReturnType<FakeCatalogDatabase["snapshot"]>): void {
    this.products.clear();
    for (const [key, value] of snapshot.products) this.products.set(key, value);
    this.variants.clear();
    for (const [key, value] of snapshot.variants) this.variants.set(key, value);
    this.tiers.splice(0, this.tiers.length, ...snapshot.tiers);
    this.mutations.clear();
    for (const [key, value] of snapshot.mutations) this.mutations.set(key, value);
    this.nextProductId = snapshot.nextProductId;
    this.nextVariantId = snapshot.nextVariantId;
    this.nextTierId = snapshot.nextTierId;
  }
}

test("catalog mutation commands require exact request envelopes and positive revisions", () => {
  const create = parseAdminProductCreateCommand({ requestId: productRequest, ...productFields });
  assert.equal(create.command?.requestId, productRequest);
  assert.equal(parseAdminProductCreateCommand({ requestId: productRequest, ...productFields, unexpected: true }).command, null);
  assert.equal(parseAdminProductCreateCommand({ requestId: "bad", ...productFields }).command, null);
  assert.equal(parseAdminProductCreateCommand({ requestId: productRequest, ...productFields, leadTimeDays: "14" }).command, null);

  const update = parseAdminProductUpdateCommand({ requestId: updateRequest, revision: 1, ...productFields });
  assert.equal(update.command?.revision, 1);
  assert.equal(parseAdminProductUpdateCommand({ requestId: updateRequest, revision: 0, ...productFields }).command, null);
  assert.equal(parseAdminProductUpdateCommand({ requestId: updateRequest, ...productFields }).command, null);

  assert.equal(parseAdminProductVariantCreateCommand({ requestId: variantRequest, ...variantFields }).command?.input.sku, variantFields.sku);
  assert.equal(parseAdminProductVariantCreateCommand({ requestId: variantRequest, ...variantFields, optionId: 0 }).command?.input.optionId, 0);
  assert.equal(parseAdminProductVariantCreateCommand({ requestId: variantRequest, ...variantFields, revision: 1 }).command, null);
  assert.equal(parseAdminProductVariantCreateCommand({ requestId: variantRequest, ...variantFields, tierPrices: [{ currency: "VND", minQuantity: "10", price: 78000 }] }).command, null);
  assert.equal(parseAdminProductVariantUpdateCommand({ requestId: variantRequest, revision: 1, ...variantFields }).command?.revision, 1);
});

test("product create/update/archive use one atomic batch, revision guards and idempotent replay", async () => {
  const database = new FakeCatalogDatabase();
  const created = await createAdminProductAtomically(database, productFields, actor, productRequest);
  assert.equal(created.revision, 1);
  assert.equal(database.batchCalls, 1);
  assert.equal(database.mutations.size, 1);

  const replay = await createAdminProductAtomically(database, productFields, actor, productRequest);
  assert.equal(replay.id, created.id);
  assert.equal(database.batchCalls, 1);
  await assert.rejects(
    () => createAdminProductAtomically(database, { ...productFields, name: "Khác" }, actor, productRequest),
    AdminCatalogWriteIdempotencyConflictError,
  );

  const updated = await updateAdminProductAtomically(database, created.id, { ...productFields, name: "Bột đã sửa" }, 1, actor, updateRequest);
  assert.equal(updated?.revision, 2);
  assert.equal(updated?.name, "Bột đã sửa");
  await assert.rejects(
    () => updateAdminProductAtomically(database, created.id, { ...productFields, name: "Ghi đè stale" }, 1, actor, "44444444-4444-4444-8444-444444444444"),
    AdminCatalogWriteConflictError,
  );
  assert.equal(database.products.get(created.id)?.name, "Bột đã sửa");

  const archived = await archiveAdminProductAtomically(database, created.id, 2, actor, "55555555-5555-4555-8555-555555555555");
  assert.equal(archived?.isActive, false);
  assert.equal(archived?.revision, 3);
});

test("a complete product batch remains successful when D1 omits returned rows", async () => {
  const database = new FakeCatalogDatabase();
  database.returnEmptyMutationResult = true;

  const created = await createAdminProductAtomically(database, productFields, actor, productRequest);

  assert.equal(created.revision, 1);
  assert.equal(database.products.size, 1);
  assert.equal(database.mutations.size, 1);
});

test("an incomplete product batch is not accepted as an idempotent replay", async () => {
  const database = new FakeCatalogDatabase();
  database.returnEmptyMetaResult = true;

  await assert.rejects(
    () => createAdminProductAtomically(database, productFields, actor, productRequest),
    AdminCatalogWriteStorageError,
  );

  assert.equal(database.products.size, 0);
  assert.equal(database.mutations.size, 0);
});

test("variant tier replacement is in the same batch and rolls back on a tier failure", async () => {
  const database = new FakeCatalogDatabase();
  const product = await createAdminProductAtomically(database, productFields, actor, "66666666-6666-4666-8666-666666666666");
  const created = await createAdminProductVariantAtomically(database, product.id, variantFields, actor, variantRequest);
  assert.equal(created?.revision, 1);
  assert.equal(database.tiers.length, 1);
  assert.equal(database.batchCalls, 2);

  const before = structuredClone({
    auditCount: database.mutations.size,
    revision: database.variants.get(created?.id ?? 0)?.revision,
    tiers: database.tiers,
  });
  database.failTierInsert = true;
  await assert.rejects(
    () => updateAdminProductVariantAtomically(database, product.id, created?.id ?? 0, { ...variantFields, name: "Variant lỗi", tierPrices: [{ currency: "VND", minQuantity: 10, price: 79000 }] }, 1, actor, "77777777-7777-4777-8777-777777777777"),
    /tier insert failed/,
  );
  assert.equal(database.variants.get(created?.id ?? 0)?.revision, before.revision);
  assert.deepEqual(database.tiers, before.tiers);
  assert.equal(database.mutations.size, before.auditCount);
});

test("catalog write routes and UI carry request ids, revisions and atomic writer calls", async () => {
  const [collection, detail, variants, variantDetail, productPage, variantPanel, data] = await Promise.all([
    read("src/app/api/admin/products/route.ts"),
    read("src/app/api/admin/products/[id]/route.ts"),
    read("src/app/api/admin/products/[id]/variants/route.ts"),
    read("src/app/api/admin/products/[id]/variants/[variantId]/route.ts"),
    read("src/app/admin/san-pham/page.tsx"),
    read("src/components/admin/AdminVariantPanel.tsx"),
    read("src/lib/admin-data.ts"),
  ]);
  assert.match(collection, /parseAdminProductCreateCommand/);
  assert.match(collection, /createAdminProductAtomically/);
  assert.match(detail, /parseAdminProductUpdateCommand/);
  assert.match(detail, /archiveAdminProductAtomically/);
  assert.match(variants, /parseAdminProductVariantCreateCommand/);
  assert.match(variants, /createAdminProductVariantAtomically/);
  assert.match(variantDetail, /parseAdminProductVariantUpdateCommand/);
  assert.match(variantDetail, /updateAdminProductVariantAtomically/);
  assert.match(variantDetail, /requestId/);
  assert.match(productPage, /revision: product\.revision/);
  assert.match(productPage, /requestId: crypto\.randomUUID\(\)/);
  assert.match(variantPanel, /requestId: crypto\.randomUUID\(\)/);
  assert.match(data, /p\.revision/);
  assert.match(data, /image_url, revision/);
});
