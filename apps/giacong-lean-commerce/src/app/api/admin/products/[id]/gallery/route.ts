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

interface GalleryImageInput {
  id?: number;
  imageUrl: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "catalog.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem sản phẩm.");
  }
  const productId = parsePositiveInt((await context.params).id);
  if (!productId) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  try {
    const result = await guard.database
      .prepare(
        "SELECT id, image_url, sort_order, is_primary FROM product_gallery_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC"
      )
      .bind(productId)
      .all<{ id: number; image_url: string; sort_order: number; is_primary: number }>();

    const images = (result.results ?? []).map((row) => ({
      id: row.id,
      imageUrl: row.image_url,
      sortOrder: row.sort_order,
      isPrimary: Boolean(row.is_primary),
    }));

    return adminSuccess(crypto.randomUUID(), { images });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải thư viện ảnh sản phẩm.");
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa sản phẩm.");
  }
  const productId = parsePositiveInt((await context.params).id);
  if (!productId) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) {
    return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  }

  const body = parsedRequest.body as { images?: GalleryImageInput[] };
  const images = Array.isArray(body?.images) ? body.images : [];

  try {
    await guard.database.prepare("DELETE FROM product_gallery_images WHERE product_id = ?").bind(productId).run();

    for (let idx = 0; idx < images.length; idx++) {
      const img = images[idx];
      await guard.database
        .prepare(
          "INSERT INTO product_gallery_images (product_id, image_url, sort_order, is_primary) VALUES (?, ?, ?, ?)"
        )
        .bind(productId, img.imageUrl.trim(), typeof img.sortOrder === "number" ? img.sortOrder : idx, img.isPrimary ? 1 : 0)
        .run();
    }

    return adminSuccess(parsedRequest.requestId, { success: true, count: images.length });
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể lưu thư viện ảnh sản phẩm.");
  }
}
