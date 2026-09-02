# Cloudflare production deployment — Lean V1

Tài liệu này khóa kiến trúc triển khai production cho Lean V1. Khi tài liệu cũ còn nhắc Bagisto như backend production, quyết định Cloudflare-native trong tài liệu này được ưu tiên.

## Quyết định đã khóa

- Production platform: **Cloudflare**.
- Production hostname: **`https://kienhieu.id.vn`**.
- Next.js storefront/BFF chạy trên **Cloudflare Workers** qua **OpenNext for Cloudflare**.
- Worker production: **`giacong-vn`**.
- Worker staging: **`giacong-vn-staging`**.
- Catalog, variant, MOQ, quantity step, availability và tier price đọc trực tiếp từ **Cloudflare D1** qua binding `GIACONG_VN_CATALOG`.
- Product media đọc từ **Cloudflare R2** qua binding `GIACONG_VN_PRODUCT_MEDIA` và route cùng origin `/media/*`.
- Incremental cache dùng R2 binding `NEXT_INC_CACHE_R2_BUCKET` ở staging hiện hữu.
- Bagisto/Docker chỉ là thử nghiệm lịch sử, **không thuộc production runtime**.
- Không có VPS, PHP origin hoặc Cloudflare Tunnel trong kiến trúc đích.
- Vercel không thuộc đường production.
- Mọi thay đổi application phải đi **staging trước**, production chỉ promotion sau acceptance.
- Google Apps Script + Google Sheet hiện vẫn là intake/hàng đợi vận hành theo phạm vi Lean V1; việc có chuyển intake hoàn toàn sang D1 là quyết định riêng, không chặn migration catalog hiện tại.

## Kiến trúc đích

```text
Internet
  |
Cloudflare DNS / TLS / WAF / CDN / Turnstile
  |
Cloudflare Worker: Next.js + OpenNext
  |-- staging:    giacong-vn-staging
  `-- production: giacong-vn -> kienhieu.id.vn
          |
          +-- storefront / BFF
          +-- catalog / cart validation ------> D1: GIACONG_VN_CATALOG
          +-- /media/* -----------------------> R2: GIACONG_VN_PRODUCT_MEDIA
          +-- Next cache ---------------------> R2: NEXT_INC_CACHE_R2_BUCKET
          `-- /api/contact -------------------> Google Apps Script -> Google Sheet
```

## D1 staging đã xác minh

Database: `giacong-vn-catalog-staging`.

Các bảng nghiệp vụ hiện có:

- `categories`
- `products`
- `product_variants`
- `variant_tier_prices`
- `services`

Ngoài ra có `d1_migrations` phục vụ migration metadata.

Snapshot audit ngày 2026-08-14:

- 4 categories
- 10 products
- 18 variants
- 54 tier-price rows
- 0 managed service rows

Dữ liệu catalog staging hiện là demo/test và chưa được xem là production data.

## Runtime boundary

Worker không gọi một HTTP commerce backend bên ngoài. Server components/API routes lấy binding bằng OpenNext Cloudflare context, sau đó query D1 bằng prepared statements. Vì vậy:

- browser không nhận D1 credential;
- không có D1 API token trong `.env`;
- giá/tồn/MOQ/bước số lượng được đọc lại server-side khi revalidate/submit cart;
- client chỉ giữ `parentSlug`, `variantSku`, `quantity` trong localStorage;
- R2 cũng được truy cập qua Worker binding, không dùng public bucket credential.

## Wrangler staging bindings

`wrangler.jsonc` phải giữ các resource hiện hữu khi upload version mới:

- `GIACONG_VN_CATALOG` → `giacong-vn-catalog-staging`
- `GIACONG_VN_PRODUCT_MEDIA` → `giacong-vn-product-media-staging`
- `NEXT_INC_CACHE_R2_BUCKET` → `giacong-vn-next-cache-staging`

Không tự tạo production D1/R2 bằng tên suy đoán. Production resources chỉ được khai báo sau khi audit/tạo có chủ ý và migration dữ liệu được duyệt.

## Cổng an toàn deployment

`npm run cf:deploy` chỉ được phép trỏ staging. Production không có auto-deploy trong giai đoạn migration.

Khi kiểm tra production config bằng Wrangler, luôn chỉ rõ environment gốc bằng
`--env=""`; nếu bỏ cờ này Wrangler cảnh báo vì file có nhiều environment. Dry-run
không nhận traffic và không thay đổi Worker:

```bash
npm run check
npm run cf:build
npx wrangler deploy --dry-run --env=""
```

Quy trình:

1. `npm run check` xanh.
2. `npm run cf:build:staging` xanh.
3. Wrangler dry-run xanh và giữ đủ D1/R2 bindings.
4. Upload một staging version **không nhận traffic**.
5. Preview smoke test ít nhất: `/`, `/san-pham`, một product detail, `/gui-yeu-cau`, cart revalidation và `/thue-gia-cong`.
6. Kiểm tra media R2 khi có object tương ứng.
7. Chỉ khi preview đạt mới promotion version vào `giacong-vn-staging`.
8. QA staging hoàn chỉnh.
9. Sau đó mới tạo resource/migration production và promotion có kiểm soát cho `giacong-vn`; mỗi migration window phải có export D1 mới, checksum, restore-drill và rollback point.

## Production safety

- Không thay `giacong-vn` trong lúc migration staging chưa đạt.
- Không ghi dữ liệu production từ demo D1 staging.
- Không dùng `BAGISTO_API_URL`, `BAGISTO_PROXY_ORIGIN` hay private PHP origin.
- Không tạo Tunnel chỉ để duy trì Bagisto thử nghiệm.
- Không đưa giá do browser gửi vào Sheet; canonical money luôn do Worker tính lại từ D1.
- Không xóa D1/R2 cũ trước khi bản OpenNext mới đã được smoke test và có rollback point.

## Điều kiện hoàn thành migration Cloudflare-native

Migration application layer được coi là hoàn thành khi:

1. catalog listing đọc D1 thành công;
2. product detail/variant/tier price đọc D1 thành công;
3. cart revalidation và submit re-read D1 thành công;
4. `/media/*` đọc R2 thành công cho object thật;
5. service managed copy dùng D1 khi có row và fallback tĩnh khi chưa di trú;
6. staging version mới được promotion sau preview QA;
7. Bagisto không còn nằm trên runtime path;
8. production D1/R2 được tạo/audit và migration dữ liệu riêng trước production promotion.
