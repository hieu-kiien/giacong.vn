import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { adminErrorFrom } from "@/lib/admin-error-mapping";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageCrm } from "@/lib/admin-permissions";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { insertCrmCustomerSchema } from "@/lib/admin-crm-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "crm.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem danh sách khách hàng.");
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Math.min(Number(url.searchParams.get("pageSize") || 20), 100);
  const query = url.searchParams.get("query") || "";
  const tier = url.searchParams.get("tier") || "";

  try {
    const offset = (page - 1) * pageSize;
    const whereConditions: string[] = [];
    const params: string[] = [];

    if (query) {
      if (query.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        whereConditions.push(`source_lead_id = ?`);
        params.push(query);
      } else {
        const q = `%${query}%`;
        whereConditions.push(`(company_name LIKE ? OR code LIKE ? OR phone LIKE ? OR email LIKE ?)`);
        params.push(q, q, q, q);
      }
    }

    if (tier && ["vip", "strategic", "potential", "standard", "dormant"].includes(tier)) {
      whereConditions.push(`tier = ?`);
      params.push(tier);
    }

    const whereClause = whereConditions.length > 0 ? ` WHERE ${whereConditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM crm_customers${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const countSql = `SELECT count(*) as total FROM crm_customers${whereClause}`;
    
    const [countResult, itemsResult] = await Promise.all([
      guard.database.prepare(countSql).bind(...params).first<{ total: number }>(),
      guard.database.prepare(sql).bind(...params, pageSize, offset).all()
    ]);

    const total = countResult?.total || 0;

    return adminSuccess(crypto.randomUUID(), {
      items: itemsResult.results,
      pagination: {
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(total / pageSize)),
        pageSize,
        total,
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách khách hàng.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCrm(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo khách hàng.");
  }

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);

  const validation = insertCrmCustomerSchema.safeParse(parsedRequest.body);
  if (!validation.success) {
    const errors: Record<string, string> = {};
    for (const err of validation.error.errors) {
      if (err.path.length) errors[err.path.join(".")] = err.message;
    }
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu khách hàng chưa hợp lệ.", errors);
  }

  const data = validation.data;
  const id = crypto.randomUUID();
  const code = data.code || `CUST-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;

  try {
    await guard.database.prepare(
      `INSERT INTO crm_customers (
        id, code, company_name, short_name, tax_code, industry, tier, status, credit_status, credit_limit, credit_term_days,
        headquarters_address, factory_address, city, country, website, phone, email, assigned_manager_id, source_lead_id, acquisition_channel,
        required_certifications_json, internal_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?
      )`
    ).bind(
      id, code, data.company_name, data.short_name || null, data.tax_code || null, data.industry, data.tier || 'standard', data.status || 'active', data.credit_status || 'good', data.credit_limit || 0, data.credit_term_days || 0,
      data.headquarters_address || null, data.factory_address || null, data.city || null, data.country || 'VN', data.website || null, data.phone || null, data.email || null, data.assigned_manager_id || null, data.source_lead_id || null, data.acquisition_channel || 'inbound_web',
      data.required_certifications_json || '[]', data.internal_notes || null
    ).run();

    return adminSuccess(parsedRequest.requestId, { id, code }, 201);
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể tạo khách hàng.");
  }
}
