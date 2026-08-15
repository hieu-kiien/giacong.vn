import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { AdminVariantConflictError, AdminVariantIdempotencyConflictError, AdminVariantNotFoundError, AdminVariantValidationError, createVariant, listProductVariants } from "@/lib/admin-variant-repository";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 64 * 1024;

type Context = { params: Promise<{ productId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const requestId = crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  const productId = parseId((await context.params).productId);
  if (productId === null) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  try { return adminSuccess(requestId, { variants: await listProductVariants(productId) }); }
  catch (error) { return mapError(requestId, error); }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  if (!isJson(request.headers.get("content-type"))) return adminFailure(requestId, 415, "UNSUPPORTED_MEDIA", "Content-Type không được hỗ trợ.");
  const productId = parseId((await context.params).productId);
  if (productId === null) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  try { return adminSuccess(requestId, await createVariant(productId, await readJson(request), admission.actor.subject, requestId), 201); }
  catch (error) { return mapError(requestId, error); }
}

async function readJson(request: Request): Promise<unknown> { const length=Number(request.headers.get("content-length")); if(Number.isFinite(length)&&length>MAX_BODY_BYTES)throw new AdminVariantValidationError("Payload too large."); const bytes=await request.arrayBuffer(); if(bytes.byteLength>MAX_BODY_BYTES)throw new AdminVariantValidationError("Payload too large."); try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AdminVariantValidationError("Malformed JSON request.");} }
function mapError(requestId:string,error:unknown):Response { if(error instanceof AdminVariantNotFoundError)return adminFailure(requestId,404,"NOT_FOUND","Không tìm thấy dữ liệu biến thể."); if(error instanceof AdminVariantConflictError)return adminFailure(requestId,409,"UNIQUE_CONFLICT","SKU biến thể đã tồn tại hoặc dữ liệu xung đột."); if(error instanceof AdminVariantIdempotencyConflictError)return adminFailure(requestId,409,"IDEMPOTENCY_CONFLICT","Request ID đã được sử dụng cho payload khác."); if(error instanceof AdminVariantValidationError||error instanceof Error&&/invalid|required|integer|MOQ|tier|payload/i.test(error.message))return adminFailure(requestId,422,"VALIDATION_ERROR","Dữ liệu biến thể không hợp lệ."); return adminFailure(requestId,500,"INTERNAL_ERROR","Không thể hoàn tất thao tác quản trị."); }
function parseId(value:string){const id=Number(value);return Number.isSafeInteger(id)&&id>0?id:null;}
function isJson(value:string|null){return Boolean(value&&value.toLowerCase().split(";",1)[0].trim()==="application/json");}
