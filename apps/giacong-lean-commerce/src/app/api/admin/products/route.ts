import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import {
  createAdminProduct,
  listAdminCategories,
  listAdminProducts,
  type AdminProductInput,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminProductPayload } from "@/lib/admin-product-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 20), 100);

  try {
    const [data, categories] = await Promise.all([
      listAdminProducts(guard.database, {
        page,
        pageSize,
        query: url.searchParams.get("query") ?? undefined,
      }),
      listAdminCategories(guard.database),
    ]);
    return adminSuccess(crypto.randomUUID(), {
      categories,
      ...data,
      pagination: {
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(data.total / pageSize)),
        pageSize,
        total: data.total,
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách sản phẩm.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo sản phẩm.");
  }

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminProductPayload(parsedRequest.body);
  if (!parsed.input) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu sản phẩm chưa hợp lệ.", parsed.fieldErrors);
  }
  if (parsed.input.status === "published") {
    return adminFailure(
      parsedRequest.requestId,
      422,
      "VALIDATION_ERROR",
      "Sản phẩm mới cần được tạo ở draft trước khi thêm và kiểm tra variants.",
      { status: "Hãy lưu draft, thêm variants hợp lệ rồi mới publish." },
    );
  }

  try {
    const product = await createAdminProduct(guard.database, parsed.input, guard.actorSubject);
    return adminSuccess(parsedRequest.requestId, { product }, 201);
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể tạo sản phẩm.", {
      fieldErrors: { slug: "Slug hoặc SKU đã tồn tại." },
      message: "Slug hoặc SKU đã tồn tại.",
    });
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
