# 08. Technical Architecture

## 1. Stack
- Next.js App Router.
- React + TypeScript strict.
- Tailwind CSS v4+.
- Motion for React.
- Radix/shadcn-style primitives.
- Swiper cho carousel phức tạp.
- React Hook Form + Zod.
- Lucide icons.
- CMS: Sanity hoặc Strapi; local adapter cho MVP.
- Lead storage: Supabase/PostgreSQL hoặc CRM webhook.
- Email: Resend hoặc SMTP provider.
- Hosting: Vercel hoặc hạ tầng Node tương thích.

## 2. Folder structure
```text
src/
  app/
    (marketing)/
      page.tsx
      ve-giacong-vn/page.tsx
      dich-vu/page.tsx
      dich-vu/[slug]/page.tsx
      tin-tuc/page.tsx
      tin-tuc/[slug]/page.tsx
      lien-he/page.tsx
    (commerce)/
      san-pham/page.tsx
      san-pham/[slug]/page.tsx
      gio-hang/page.tsx
      thanh-toan/page.tsx
    api/quote-requests/route.ts
    layout.tsx
    globals.css
    sitemap.ts
    robots.ts
    not-found.tsx
  components/
    ui/
    layout/
    marketing/
    commerce/
    forms/
    motion/
  content/
  lib/
    cms/
    commerce/
    validation/
    seo/
    analytics/
  types/
  styles/
public/
  images/
  icons/
```

## 3. Server/Client boundary

### Server components mặc định
- Page layouts.
- Nội dung CMS.
- Product/article grids nếu không cần interaction trực tiếp.
- SEO/JSON-LD.

### Client components
- Header menu state.
- Carousels.
- Product filters/URL interaction.
- Quantity stepper/cart.
- Forms.
- Motion wrappers.

Không biến toàn page thành client component chỉ để animate. Tách `Reveal` client wrapper nhỏ.

## 4. Data fetching/caching
- Static marketing content: `revalidate` 1h-24h tùy CMS webhook.
- Products: ISR + query SSR hoặc database pagination.
- Article: ISR, revalidate khi publish.
- Dùng tags để invalidation nếu CMS hỗ trợ.
- Không cache user cart/checkout.

## 5. SEO implementation
- `generateMetadata` cho dynamic pages.
- JSON-LD component serialize an toàn.
- Organization/WebSite ở root/home.
- Product schema chỉ khi giá/tồn kho chính xác.
- Article schema trên bài viết.
- BreadcrumbList trên trang cấp sâu.
- `alternates.canonical`.

## 6. Images
- Remote patterns allowlist, không `unoptimized` toàn site.
- `priority` chỉ hero/LCP.
- `fetchPriority="high"` khi cần.
- `sizes` đúng theo grid.
- AVIF/WebP tự động.
- Dùng blur placeholder cho ảnh lớn.

## 7. State management
- URL state cho filters/search/sort.
- Local component state cho UI nhỏ.
- Cart: Zustand chỉ khi cần; persist localStorage và hydrate cẩn thận.
- Server state không đưa vào global store nếu không cần.

## 8. Forms/backend
- Server action hoặc route handler.
- Validate lại bằng Zod server.
- Rate limit theo IP + fingerprint nhẹ.
- File upload signed URL nếu dùng storage.
- Email notification + database transaction.
- Log request ID, không log dữ liệu nhạy cảm đầy đủ.

## 9. Analytics
Sự kiện tối thiểu:
- `quote_cta_click` với source/section.
- `quote_form_start`, `quote_form_submit`, `quote_form_success`, `quote_form_error`.
- `phone_click`, `zalo_click`.
- `product_view`, `add_to_cart`, `begin_checkout`.
- `article_view`.

Consent/cookie banner phụ thuộc chính sách pháp lý.

## 10. Security headers
- Content-Security-Policy hợp lý.
- Referrer-Policy.
- X-Content-Type-Options.
- Permissions-Policy.
- Frame-ancestors qua CSP.
- HSTS ở production HTTPS.

## 11. Testing
- Vitest: utils, pricing, validation, serializers.
- Testing Library: component interaction quan trọng.
- Playwright: navigation, mega menu, filters, product, quote form, responsive screenshot.
- Axe optional trong E2E.

## 12. CI
```yaml
steps:
  - install with frozen lockfile
  - lint
  - typecheck
  - unit test
  - build
  - playwright smoke
```

## 13. Deployment environments
- Local.
- Preview per PR.
- Staging với CMS staging dataset.
- Production.

Biến môi trường mẫu trong `config/env.example`.

## 14. Source versions
Dùng stable versions tại thời điểm khởi tạo và commit lockfile. Không copy dependency version từ ảnh thiết kế. Thường xuyên cập nhật bản vá bảo mật cho Next.js/React Server Components.
