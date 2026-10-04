import { adminFailure } from "@/lib/admin-api.ts";
import {
  listAdminCategories,
  listAdminProducts,
  parseAdminProductCategoryFilter,
  parseAdminProductSort,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage } from "@/lib/admin-permissions.ts";
import { buildProductExportCsv, type AdminProductExportInput } from "@/lib/admin-product-export.ts";

export const dynamic = "force-dynamic";

const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 2000;

function dateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "catalog.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem sản phẩm.");
  }

  const url = new URL(request.url);
  const filters = {
    categoryId: parseAdminProductCategoryFilter(url.searchParams.get("categoryId")),
    query: url.searchParams.get("query") ?? undefined,
    sort: parseAdminProductSort(url.searchParams.get("sort")),
    status: url.searchParams.get("status") ?? undefined,
  };

  try {
    const categories = await listAdminCategories(guard.database);
    const slugById = new Map(categories.map((category) => [category.id, category.slug]));
    const rows: AdminProductExportInput[] = [];
    for (let page = 1; rows.length < MAX_EXPORT_ROWS; page += 1) {
      const { products, total } = await listAdminProducts(guard.database, { ...filters, page, pageSize: EXPORT_PAGE_SIZE });
      for (const product of products) {
        rows.push({
          categorySlug: product.categoryId === null ? null : (slugById.get(product.categoryId) ?? null),
          description: product.description,
          imageUrl: product.imageUrl,
          isActive: product.isActive,
          leadTimeDays: product.leadTimeDays ?? null,
          name: product.name,
          shortDescription: product.shortDescription,
          sku: product.sku,
          slug: product.slug,
          startingPrice: product.startingPrice,
          status: product.status,
          variantCount: product.variantCount,
        });
      }
      if (products.length === 0 || page * EXPORT_PAGE_SIZE >= total) break;
    }

    return new Response(buildProductExportCsv(rows.slice(0, MAX_EXPORT_ROWS)), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="san-pham-${dateStamp()}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể xuất danh sách sản phẩm.");
  }
}
