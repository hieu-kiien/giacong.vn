import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  canonicalTierMutationPayload,
  canonicalVariantMutationPayload,
  decodeVariantVersion,
  encodeVariantVersion,
  normalizeTierPrices,
  normalizeVariantInput,
  type AdminVariant,
} from "./admin-variant.ts";

interface Statement { bind(...values: unknown[]): Statement; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<{ meta?: { changes?: number } }>; }
interface Database { prepare(sql: string): Statement; batch<T extends Statement>(statements: T[]): Promise<unknown>; }
interface Env { GIACONG_VN_CATALOG?: Database; }
interface Row { id:number; product_id:number; name:string; sku:string; option_label:string; unit:string; moq:number; quantity_step:number; contact_from_quantity:number; is_available:number; sort_order:number; attribute_id:number; attribute_code:string; attribute_label:string; option_id:number; image_url:string|null; revision:number; updated_at:string; }
interface TierRow { min_quantity:number; price:number; currency:string; }

export class AdminVariantConflictError extends Error {}
export class AdminVariantNotFoundError extends Error {}
export class AdminVariantValidationError extends Error {}
export class AdminVariantPayloadTooLargeError extends Error {}
export class AdminVariantIdempotencyConflictError extends Error {}

export async function listProductVariants(productId:number):Promise<AdminVariant[]> {
  const db=getDatabase();
  const product=await db.prepare("SELECT id FROM products WHERE id=? LIMIT 1").bind(productId).first<{id:number}>();
  if(!product) throw new AdminVariantNotFoundError("Product not found.");
  const rows=await db.prepare(`SELECT id,product_id,name,sku,option_label,unit,moq,quantity_step,contact_from_quantity,is_available,sort_order,attribute_id,attribute_code,attribute_label,option_id,image_url,revision,updated_at FROM product_variants WHERE product_id=? ORDER BY sort_order ASC,id ASC`).bind(productId).all<Row>();
  return Promise.all(rows.results.map(toVariantWithTiers));
}

export async function getVariant(id:number):Promise<AdminVariant|null>{
  const row=await getDatabase().prepare(`SELECT id,product_id,name,sku,option_label,unit,moq,quantity_step,contact_from_quantity,is_available,sort_order,attribute_id,attribute_code,attribute_label,option_id,image_url,revision,updated_at FROM product_variants WHERE id=? LIMIT 1`).bind(id).first<Row>();
  return row?toVariantWithTiers(row):null;
}

export async function createVariant(productId:number,raw:unknown,actorSubject:string,requestId:string):Promise<AdminVariant>{
  const input=normalizeVariantInput(raw); const db=getDatabase();
  const product=await db.prepare("SELECT id FROM products WHERE id=? LIMIT 1").bind(productId).first<{id:number}>();
  if(!product) throw new AdminVariantNotFoundError("Product not found.");
  await assertSkuAvailable(db,input.sku);
  const hash=await sha256(canonicalVariantMutationPayload(input));
  const idem=await existingAudit(db,requestId,hash);
  if(idem){if(idem.entityType!=="variant")throw new AdminVariantIdempotencyConflictError("Request ID already used.");const replay=await getVariant(Number(idem.entityKey));if(!replay)throw new AdminVariantNotFoundError("Variant not found.");return replay;}
  const statements=[
    db.prepare(`INSERT INTO product_variants(product_id,name,sku,option_label,unit,moq,quantity_step,contact_from_quantity,is_available,sort_order,attribute_id,attribute_code,attribute_label,option_id,image_url,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).bind(productId,input.name,input.sku,input.optionLabel,input.unit,input.moq,input.quantityStep,input.contactFromQuantity,input.isAvailable?1:0,input.sortOrder,input.attributeId,input.attributeCode,input.attributeLabel,input.optionId,input.imageUrl),
    db.prepare(`INSERT INTO admin_audit_log(request_id,actor_subject,action,entity_type,entity_key,previous_revision,resulting_revision,payload_sha256) VALUES(?,?, 'create','variant',CAST((SELECT id FROM product_variants WHERE sku=? LIMIT 1) AS TEXT),NULL,1,?)`).bind(requestId,actorSubject,input.sku,hash),
  ];
  await db.batch(statements); const created=await db.prepare("SELECT id FROM product_variants WHERE sku=? LIMIT 1").bind(input.sku).first<{id:number}>();
  if(!created)throw new Error("Created variant could not be loaded."); const result=await getVariant(created.id); if(!result)throw new Error("Created variant could not be loaded."); return result;
}

export async function updateVariant(id:number,raw:unknown,actorSubject:string,requestId:string):Promise<AdminVariant>{
  if(!isRecord(raw))throw new AdminVariantValidationError("Invalid variant request."); const version=decodeVariantVersion(raw.version); const input=normalizeVariantInput(raw); const db=getDatabase();
  const existing=await getVariant(id); if(!existing)throw new AdminVariantNotFoundError("Variant not found."); await assertSkuAvailable(db,input.sku,id);
  const hash=await sha256(canonicalVariantMutationPayload(input)); const idem=await existingAudit(db,requestId,hash);
  if(idem){if(idem.entityType!=="variant"||idem.entityKey!==String(id))throw new AdminVariantIdempotencyConflictError("Request ID already used.");const replay=await getVariant(id);if(!replay)throw new AdminVariantNotFoundError("Variant not found.");return replay;}
  const tiers=await getTierPrices(db,id); if(tiers.length) normalizeTierPrices(tiers.map(t=>({minQuantity:t.min_quantity,price:t.price})),input);
  const result=await db.prepare(`UPDATE product_variants SET name=?,sku=?,option_label=?,unit=?,moq=?,quantity_step=?,contact_from_quantity=?,is_available=?,sort_order=?,attribute_id=?,attribute_code=?,attribute_label=?,option_id=?,image_url=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND revision=?`).bind(input.name,input.sku,input.optionLabel,input.unit,input.moq,input.quantityStep,input.contactFromQuantity,input.isAvailable?1:0,input.sortOrder,input.attributeId,input.attributeCode,input.attributeLabel,input.optionId,input.imageUrl,id,version).run();
  if((result.meta?.changes??0)!==1)throw new AdminVariantConflictError("Variant was changed by another operator.");
  await db.prepare(`INSERT INTO admin_audit_log(request_id,actor_subject,action,entity_type,entity_key,previous_revision,resulting_revision,payload_sha256) VALUES(?,?, 'update','variant',?,?,?,?)`).bind(requestId,actorSubject,String(id),version,version+1,hash).run();
  const updated=await getVariant(id);if(!updated)throw new AdminVariantNotFoundError("Variant not found.");return updated;
}

export async function deleteVariant(id:number,versionRaw:unknown,actorSubject:string,requestId:string):Promise<void>{
  const version=decodeVariantVersion(versionRaw);const db=getDatabase();const existing=await getVariant(id);if(!existing)throw new AdminVariantNotFoundError("Variant not found.");
  const sibling=await db.prepare("SELECT COUNT(*) AS total FROM product_variants WHERE product_id=?").bind(existing.productId).first<{total:number}>();if(Number(sibling?.total??0)<=1)throw new AdminVariantValidationError("A product must retain at least one variant.");
  const hash=await sha256(JSON.stringify({id,version:encodeVariantVersion(version)}));const idem=await existingAudit(db,requestId,hash);if(idem){if(idem.entityType!=="variant"||idem.entityKey!==String(id))throw new AdminVariantIdempotencyConflictError("Request ID already used.");return;}
  const result=await db.prepare("DELETE FROM product_variants WHERE id=? AND revision=?").bind(id,version).run();if((result.meta?.changes??0)!==1)throw new AdminVariantConflictError("Variant was changed by another operator.");
  await db.prepare(`INSERT INTO admin_audit_log(request_id,actor_subject,action,entity_type,entity_key,previous_revision,resulting_revision,payload_sha256) VALUES(?,?, 'delete','variant',?,?,NULL,?)`).bind(requestId,actorSubject,String(id),version,hash).run();
}

export async function replaceTierPrices(variantId:number,raw:unknown,actorSubject:string,requestId:string):Promise<AdminVariant>{
  if(!isRecord(raw))throw new AdminVariantValidationError("Invalid tier price request."); const version=decodeVariantVersion(raw.version); const db=getDatabase(); const variant=await getVariant(variantId); if(!variant)throw new AdminVariantNotFoundError("Variant not found.");
  const tiers=normalizeTierPrices(raw.tierPrices,{moq:variant.moq,quantityStep:variant.quantityStep,contactFromQuantity:variant.contactFromQuantity});
  const hash=await sha256(canonicalTierMutationPayload({variantId,version:encodeVariantVersion(version),tierPrices:tiers})); const idem=await existingAudit(db,requestId,hash);
  if(idem){if(idem.entityType!=="tier_prices"||idem.entityKey!==String(variantId))throw new AdminVariantIdempotencyConflictError("Request ID already used.");const replay=await getVariant(variantId);if(!replay)throw new AdminVariantNotFoundError("Variant not found.");return replay;}
  const statements:Statement[]=[];
  statements.push(db.prepare("DELETE FROM variant_tier_prices WHERE variant_id=? AND EXISTS (SELECT 1 FROM product_variants WHERE id=? AND revision=?)").bind(variantId,variantId,version));
  for(const tier of tiers) statements.push(db.prepare("INSERT INTO variant_tier_prices(variant_id,min_quantity,price,currency) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM product_variants WHERE id=? AND revision=?)").bind(variantId,tier.minQuantity,tier.price,"VND",variantId,version));
  statements.push(db.prepare("UPDATE product_variants SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND revision=?").bind(variantId,version));
  statements.push(db.prepare(`INSERT INTO admin_audit_log(request_id,actor_subject,action,entity_type,entity_key,previous_revision,resulting_revision,payload_sha256) SELECT ?,?,'update','tier_prices',?,?,?,? WHERE EXISTS (SELECT 1 FROM product_variants WHERE id=? AND revision=?)`).bind(requestId,actorSubject,String(variantId),version,version+1,hash,variantId,version+1));
  await db.batch(statements);
  const updated=await getVariant(variantId);if(!updated)throw new AdminVariantNotFoundError("Variant not found.");if(updated.version===encodeVariantVersion(version))throw new AdminVariantConflictError("Variant was changed by another operator.");return updated;
}

async function toVariantWithTiers(row:Row):Promise<AdminVariant>{const tiers=await getTierPrices(getDatabase(),row.id);return{ id:row.id,productId:row.product_id,name:row.name,sku:row.sku,optionLabel:row.option_label,unit:row.unit,moq:row.moq,quantityStep:row.quantity_step,contactFromQuantity:row.contact_from_quantity,isAvailable:row.is_available===1,sortOrder:row.sort_order,attributeId:row.attribute_id,attributeCode:row.attribute_code,attributeLabel:row.attribute_label,optionId:row.option_id,imageUrl:row.image_url,version:encodeVariantVersion(row.revision),updatedAt:row.updated_at,tierPrices:tiers.map(t=>({minQuantity:t.min_quantity,price:t.price}))};}
async function getTierPrices(db:Database,id:number){return (await db.prepare("SELECT min_quantity,price,currency FROM variant_tier_prices WHERE variant_id=? ORDER BY min_quantity ASC").bind(id).all<TierRow>()).results;}
async function assertSkuAvailable(db:Database,sku:string,excludeId?:number){const row=await db.prepare(excludeId===undefined?"SELECT id FROM product_variants WHERE sku=? LIMIT 1":"SELECT id FROM product_variants WHERE sku=? AND id<>? LIMIT 1").bind(...(excludeId===undefined?[sku]:[sku,excludeId])).first<{id:number}>();if(row)throw new AdminVariantConflictError("Variant SKU already exists.");}
async function existingAudit(db:Database,requestId:string,payloadHash:string){const row=await db.prepare("SELECT entity_type AS entityType,entity_key AS entityKey,payload_sha256 AS payloadHash FROM admin_audit_log WHERE request_id=? LIMIT 1").bind(requestId).first<{entityType:string;entityKey:string;payloadHash:string}>();if(!row)return null;if(row.payloadHash!==payloadHash)throw new AdminVariantIdempotencyConflictError("Request ID already used with different payload.");return row;}
function getDatabase():Database{const {env}=getCloudflareContext();const db=(env as unknown as Env).GIACONG_VN_CATALOG;if(!db)throw new Error("Missing D1 catalog binding.");return db;}
function isRecord(value:unknown):value is Record<string,any>{return typeof value==="object"&&value!==null&&!Array.isArray(value);}
async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");}
