import { getCloudflareContext } from "@opennextjs/cloudflare";

import { handleContactSubmission } from "@/lib/contact-webhook";
import { getAdminDatabase } from "@/lib/admin-data";
import { createLeadPersistence } from "@/lib/lead-data";
import { getCustomerSession } from "@/lib/customer-auth";
import { getCatalogProduct } from "@/lib/cloudflare-catalog";
import { getManagedServiceFamily } from "@/lib/cloudflare-services";
import { getLeadQueue } from "@/lib/lead-queue";
import { resolveRequestCartFromCatalog } from "@/lib/request-cart-resolver";

interface ContactRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Absent outside the Workers runtime (next dev, unit tests): the handler then runs unthrottled. */
function getContactRateLimiter(): ContactRateLimitBinding | undefined {
  try {
    const env = getCloudflareContext().env as { GIACONG_VN_CONTACT_LIMIT?: ContactRateLimitBinding };
    return env.GIACONG_VN_CONTACT_LIMIT;
  } catch {
    return undefined;
  }
}

async function isCustomerRequest(request: Request): Promise<boolean> {
  const contentType = request.headers.get("content-type") ?? "";
  if (/^application\/json(?:\s*;|$)/i.test(contentType)) return true;
  if (!/^(?:multipart\/form-data|application\/x-www-form-urlencoded)(?:\s*;|$)/i.test(contentType)) {
    return false;
  }

  try {
    const form = await request.clone().formData();
    return ["product", "variant", "qty"].some((field) => {
      const value = form.get(field);
      return typeof value === "string" && value.trim() !== "";
    });
  } catch {
    return false;
  }
}

function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return originUrl.origin === requestUrl.origin
      && host === requestUrl.host.toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormRequest = /^(?:multipart\/form-data|application\/x-www-form-urlencoded)(?:\s*;|$)/i.test(contentType);
  let contactRateLimiter = getContactRateLimiter();

  // Parse a cloned FormData only after the public form has passed abuse limiting.
  if (isFormRequest && contactRateLimiter) {
    try {
      const result = await contactRateLimiter.limit({
        key: request.headers.get("cf-connecting-ip")?.trim() || "unknown",
      });
      if (!result.success) {
        return Response.json(
          { message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.", ok: false },
          { headers: { "Cache-Control": "no-store", "Retry-After": "60" }, status: 429 },
        );
      }
    } catch (error) {
      console.error("[contact] rate limiter unavailable; failing open", error);
    }
    contactRateLimiter = undefined;
  }

  let customerId: string | null = null;

  if (await isCustomerRequest(request)) {
    if (!hasSameOrigin(request)) {
      return Response.json(
        { message: "Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.", ok: false },
        { headers: { "Cache-Control": "no-store" }, status: 403 },
      );
    }

    let session;
    try {
      session = await getCustomerSession(request.headers);
    } catch {
      return Response.json(
        { message: "Không thể xác thực tài khoản lúc này. Vui lòng thử lại.", ok: false },
        { headers: { "Cache-Control": "no-store" }, status: 503 },
      );
    }
    if (!session?.user.id || !session.user.emailVerified) {
      return Response.json(
        { message: "Vui lòng đăng nhập bằng tài khoản đã xác minh email trước khi gửi yêu cầu sản phẩm.", ok: false },
        { headers: { "Cache-Control": "no-store" }, status: 401 },
      );
    }
    customerId = session.user.id;
  }

  let leadPersistence;
  try {
    leadPersistence = createLeadPersistence(getAdminDatabase(), customerId);
  } catch {
    return Response.json(
      { message: "Dịch vụ tiếp nhận yêu cầu chưa sẵn sàng.", ok: false },
      { headers: { "Cache-Control": "no-store" }, status: 503 },
    );
  }

  return handleContactSubmission(request, {
    cartBatchResolver: resolveRequestCartFromCatalog,
    contactRateLimiter,
    environment: process.env,
    leadQueue: getLeadQueue(),
    leadPersistence,
    productResolver: async (slug) => {
      const product = await getCatalogProduct(slug);
      if (!product) return null;
      return {
        name: product.name,
        variants: product.variants.map((variant) => ({
          contactFromQuantity: variant.contactFromQuantity,
          isAvailable: variant.isAvailable,
          label: variant.name,
          minimumOrderQuantity: variant.minimumOrderQuantity,
          quantityStep: variant.quantityStep,
          sku: variant.sku,
        })),
      };
    },
    serviceResolver: async (slug) => {
      const family = await getManagedServiceFamily(slug);
      return family ? { name: family.name, slug: family.slug } : null;
    },
  });
}
