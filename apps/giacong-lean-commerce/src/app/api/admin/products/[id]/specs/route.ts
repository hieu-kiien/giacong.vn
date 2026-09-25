import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { adminErrorFrom } from "@/lib/admin-error-mapping";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageCatalog } from "@/lib/admin-permissions";
import { readBoundedAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

interface TechSpecsInput {
  material?: string;
  tolerance?: string;
  manufacturingProcess?: string;
  surfaceFinish?: string;
  weightGrams?: number;
  certifications?: string[];
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "catalog.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem thông số kỹ thuật.");
  }
  const productId = parsePositiveInt((await context.params).id);
  if (!productId) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  try {
    const row = await guard.database
      .prepare(
        "SELECT material, tolerance, manufacturing_process, surface_finish, weight_grams, certifications_json FROM product_tech_specs WHERE product_id = ?"
      )
      .bind(productId)
      .first<{
        material: string;
        tolerance: string;
        manufacturing_process: string;
        surface_finish: string;
        weight_grams: number;
        certifications_json: string;
      }>();

    if (!row) {
      return adminSuccess(crypto.randomUUID(), {
        specs: {
          material: "",
          tolerance: "",
          manufacturingProcess: "",
          surfaceFinish: "",
          weightGrams: 0,
          certifications: [],
        },
      });
    }

    let certifications: string[] = [];
    try {
      certifications = JSON.parse(row.certifications_json || "[]");
    } catch {
      certifications = [];
    }

    return adminSuccess(crypto.randomUUID(), {
      specs: {
        material: row.material || "",
        tolerance: row.tolerance || "",
        manufacturingProcess: row.manufacturing_process || "",
        surfaceFinish: row.surface_finish || "",
        weightGrams: row.weight_grams ?? 0,
        certifications,
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải thông số kỹ thuật sản phẩm.");
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa thông số kỹ thuật.");
  }
  const productId = parsePositiveInt((await context.params).id);
  if (!productId) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) {
    return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  }

  const body = (parsedRequest.body ?? {}) as TechSpecsInput;
  const material = typeof body.material === "string" ? body.material.trim() : "";
  const tolerance = typeof body.tolerance === "string" ? body.tolerance.trim() : "";
  const manufacturingProcess = typeof body.manufacturingProcess === "string" ? body.manufacturingProcess.trim() : "";
  const surfaceFinish = typeof body.surfaceFinish === "string" ? body.surfaceFinish.trim() : "";
  const weightGrams = typeof body.weightGrams === "number" && !Number.isNaN(body.weightGrams) ? Math.max(0, body.weightGrams) : 0;
  const certifications = Array.isArray(body.certifications) ? body.certifications.filter((c) => typeof c === "string") : [];
  const certificationsJson = JSON.stringify(certifications);

  try {
    await guard.database
      .prepare(
        `INSERT INTO product_tech_specs (
          product_id, material, tolerance, manufacturing_process, surface_finish, weight_grams, certifications_json, revision, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(product_id) DO UPDATE SET
          material = excluded.material,
          tolerance = excluded.tolerance,
          manufacturing_process = excluded.manufacturing_process,
          surface_finish = excluded.surface_finish,
          weight_grams = excluded.weight_grams,
          certifications_json = excluded.certifications_json,
          revision = product_tech_specs.revision + 1,
          updated_at = excluded.updated_at`
      )
      .bind(productId, material, tolerance, manufacturingProcess, surfaceFinish, weightGrams, certificationsJson)
      .run();

    return adminSuccess(parsedRequest.requestId, { success: true });
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể lưu thông số kỹ thuật sản phẩm.");
  }
}
