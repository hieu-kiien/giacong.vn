# Cloudflare deployment — Lean V1

**Production platform duy nhất:** Cloudflare.

Tài liệu này mô tả delivery path và safety gate. Product scope/roadmap nằm ở `CLOUDFLARE_NATIVE_V1_PLAN.md`; runtime evidence nằm ở `CLOUDFLARE_CURRENT_STATE.md`.

## 1. Deployment target

- Production hostname: `https://kienhieu.id.vn`.
- Production Worker: `giacong-vn`.
- Staging Worker: `giacong-vn-staging`.
- Next.js storefront/BFF: OpenNext → Cloudflare Workers.
- Catalog/variant/MOQ/quantity step/availability/tier price: Cloudflare D1.
- Product media: Cloudflare R2 qua Worker route `/media/*`.
- OpenNext incremental cache: R2 binding riêng.
- Admin admission: Cloudflare Access.
- Request intake: Google Apps Script → Google Sheet trong Lean V1 hiện tại.
- GitHub Actions: build/test/audit/deploy bridge cho Cloudflare.

### Không thuộc deployment target

- Vercel;
- Bagisto;
- PHP origin/VPS;
- Cloudflare Tunnel;
- browser trực tiếp tới D1/R2.

Vercel `giacong-vn-demo` chỉ là legacy Git integration cần cleanup; không sửa application để phục vụ Vercel preview.

## 2. Architecture

```text
Internet
  |
Cloudflare DNS / TLS / WAF / Turnstile / Access
  |
Cloudflare Worker (Next.js + OpenNext)
  |-- staging:    giacong-vn-staging
  `-- production: giacong-vn -> kienhieu.id.vn
          |
          +-- storefront / BFF
          +-- catalog / cart validation ------> D1: GIACONG_VN_CATALOG
          +-- /media/* -----------------------> R2: GIACONG_VN_PRODUCT_MEDIA
          +-- Next cache ---------------------> R2: NEXT_INC_CACHE_R2_BUCKET
          `-- /api/contact -------------------> Apps Script -> Google Sheet

Admin:
admin-staging.kienhieu.id.vn
          |
      Cloudflare Access
          |
      Cloudflare Worker
          |
       D1 / R2
```

## 3. Staging bindings

`wrangler.jsonc` phải giữ các resource staging hiện hữu khi upload version mới:

- `GIACONG_VN_CATALOG` → `giacong-vn-catalog-staging`;
- `GIACONG_VN_PRODUCT_MEDIA` → `giacong-vn-product-media-staging`;
- `NEXT_INC_CACHE_R2_BUCKET` → `giacong-vn-next-cache-staging`;
- `ADMIN_HOSTNAME` → `admin-staging.kienhieu.id.vn`.

Không tự tạo production D1/R2 bằng tên suy đoán. Production resources chỉ được khai báo sau audit/tạo có chủ ý và migration dataset đã duyệt.

## 4. GitHub Actions → Cloudflare

Cloudflare API credentials nằm trong GitHub Actions Secrets. Workflow được phép dùng secret để gọi Cloudflare API/Wrangler nhưng:

- không commit token/account secret;
- không in secret value vào log;
- chỉ log các trạng thái/ID cần thiết để audit;
- ưu tiên workflow audit có sẵn thay vì tự tạo credential path mới.

Live verification phải kiểm tra tối thiểu:

- Worker/deployment version;
- routes;
- D1 bindings/schema/data postconditions;
- R2 bindings/object behavior;
- Access application/policy;
- DNS/routing;
- Observability khi workflow có scope.

## 5. Standard staging release

1. Cập nhật code/docs trên branch staging-only.
2. `npm run check` xanh.
3. `npm run cf:build:staging` xanh.
4. Wrangler dry-run xanh và giữ đủ D1/R2 bindings.
5. Upload một staging version **không nhận traffic**.
6. Preview smoke test: `/`, `/san-pham`, product detail, `/gui-yeu-cau`, cart revalidation, service route và R2 media.
7. Nếu có admin change: verify Cloudflare Access admission và protected `/api/admin/**`.
8. Nếu có D1 mutation: preflight/guard → mutation → postcondition/audit.
9. Chỉ khi preview đạt mới promotion vào `giacong-vn-staging`.
10. Deep QA + responsive browser QA.
11. Ghi active version/route/evidence vào `CLOUDFLARE_CURRENT_STATE.md`.
12. Chỉ sau production acceptance mới chuẩn bị production promotion.

## 6. Admin release gate

Admin server contract phải hoàn tất trước Admin UI:

1. admission/auth;
2. category/product/variant write;
3. tier-price atomic replacement;
4. R2 media safety/reference integrity;
5. service content;
6. automated regression;
7. protected staging runtime readback.

Admin UI không được gọi D1/R2 trực tiếp và không được chứa canonical pricing logic.

## 7. Production safety

Không thay `giacong-vn`, production D1/R2 hoặc `kienhieu.id.vn/*` để debug/verify staging.

Không:

- copy demo D1 staging sang production;
- đưa `BAGISTO_*` trở lại runtime;
- tạo Tunnel để duy trì legacy origin;
- tin giá do browser gửi;
- xóa resource cũ trước khi có rollback point;
- bật production admin write trước acceptance.

## 8. Production acceptance

Production promotion chỉ được phép khi đủ:

- staging runtime acceptance;
- admin staging write + CRUD acceptance;
- production taxonomy/SKU/variant/price/MOQ/media/content được duyệt;
- production D1/R2 được tạo/audit có chủ ý;
- request intake live verification hoàn tất;
- backup/export + rollback procedure hoàn tất;
- production smoke checklist đạt.

Sau đó:

1. upload production version không nhận traffic;
2. smoke test versioned preview nếu khả dụng;
3. kiểm tra bindings/routes;
4. promote có rollback point;
5. production smoke;
6. ghi evidence.

## 9. Legacy cleanup

Sau khi xác minh không còn dependency:

- disable/remove Vercel Git integration/project `giacong-vn-demo`;
- loại bỏ workflow/status/check không còn phục vụ Cloudflare;
- giữ Bagisto docs/artifacts chỉ khi cần truy vết lịch sử;
- không tạo thêm deployment path song song.
