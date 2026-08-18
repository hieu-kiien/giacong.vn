# Cài đặt local

Hướng dẫn này áp dụng cho runtime Lean V1 hiện hành trong `apps/giacong-lean-commerce`.

**Không cần PHP, Composer, Docker hay Bagisto để chạy ứng dụng hiện tại.** Catalog, CMS, lead và audit dùng Cloudflare D1; media dùng R2; production/staging chạy trên Cloudflare Workers qua OpenNext.

## Yêu cầu

- Node.js 24 trở lên.
- npm đi kèm Node.js.
- Git.
- Tài khoản/credential Cloudflare chỉ cần khi chủ động làm việc với resource remote. Local development không được yêu cầu chứa D1/R2 API key trong `.env`.

## 1. Cài dependencies

Mở terminal tại:

```text
apps/giacong-lean-commerce
```

Cài đúng dependency lockfile:

```powershell
npm ci
```

## 2. Tạo environment local

```powershell
Copy-Item .env.example .env.local
```

`.env.example` chỉ chứa cấu hình local/secondary integration phù hợp. D1 và R2 được khai báo bằng Cloudflare bindings trong `wrangler.jsonc`; không thêm API key D1/R2 vào `.env.local`.

Nếu cần thử secondary delivery tới Google Apps Script, cấu hình:

```dotenv
GOOGLE_SHEETS_WEBHOOK_URL=
GOOGLE_SHEETS_WEBHOOK_SECRET=
```

Webhook là secondary operational sink. Lead vẫn phải được ghi bền vững vào D1 trước delivery.

## 3. Khởi tạo D1 local

Khi cần chạy các flow phụ thuộc database local, apply toàn bộ migration hiện hành vào D1 local:

```powershell
npx wrangler d1 migrations apply GIACONG_VN_CATALOG --local
```

D1 local tách biệt với staging và production. Không dùng dữ liệu demo/crawl làm production data nếu chưa được phê duyệt.

Repo không duy trì một lệnh seed production tự động. Nếu cần dữ liệu test local, chỉ import/seed snapshot đã được kiểm soát cho mục đích development.

## 4. Chạy website

```powershell
npm run dev
```

Mặc định Next.js chạy tại:

```text
http://localhost:3000
```

OpenNext dev initialization đọc Cloudflare binding contract của ứng dụng. Public storefront có thể được kiểm tra local; các flow admin được thiết kế fail-closed và staging protected host là môi trường acceptance chính cho Access + D1 membership.

Nếu cần launcher preview riêng theo quy ước repo, dùng script preview hiện hành và `COMMERCE_PREVIEW_PORT` trong `.env.example` thay vì tạo một cổng hard-code mới.

## 5. Chạy quality gate

Trước khi mở PR:

```powershell
npm run check
```

Các lệnh hữu ích khác:

```powershell
npm run check:fe
npm run check:be
npm run cf:build:staging
```

PR chuẩn sẽ chạy Quality gate và Cloudflare package gate. Pull request không được mutate remote staging state.

## 6. Staging Cloudflare

Lifecycle canonical hiện tại là:

1. PR chạy test/build/package dry-run.
2. Sau khi merge vào `master`, pipeline apply pending **staging D1 migrations**.
3. Pipeline deploy OpenNext Worker staging.
4. Deep QA chạy trên đúng commit vừa deploy.

Không tự apply migration production hoặc deploy production từ máy local nếu chưa đi qua production acceptance gate và rollback plan.

Khi cần kiểm tra package Cloudflare thủ công mà không deploy:

```powershell
npm run cf:build:staging
npx wrangler@4.115.0 deploy --env=staging --dry-run --outdir=.wrangler-dry-run
```

## 7. Dừng local server

Nhấn `Ctrl+C` tại terminal đang chạy `npm run dev`.

## Tài liệu quyết định

- `docs/CLOUDFLARE_NATIVE_V1_PLAN.md`: kiến trúc và scope hiện hành.
- `docs/CLOUDFLARE_CURRENT_STATE.md`: bằng chứng implementation/runtime đã xác minh.
- `docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`: contract bảo mật và data integrity cho admin writes.

Nếu tài liệu legacy mâu thuẫn với ba tài liệu trên, dùng tài liệu Cloudflare-native hiện hành làm nguồn quyết định.
