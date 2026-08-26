# Cài đặt local

## Yêu cầu

- Node.js 24 trở lên;
- Wrangler 4 và quyền truy cập D1/R2 nếu cần kiểm tra staging;
- Cloudflare Access riêng nếu cần mở admin production/staging.

Lean V1 hiện chạy Next.js/OpenNext trên Cloudflare. Bagisto/Docker legacy không thuộc
checkout sạch và không cần khởi động để chạy storefront hoặc admin; lịch sử kiến trúc
cũ chỉ được giữ trong Git history/tài liệu tham khảo.

## 1. Cài dependency và biến môi trường

Mở PowerShell trong thư mục `giacong-lean-commerce`:

```powershell
Copy-Item .env.example .env.local
npm ci
```

Chỉ thêm các secret cần thiết vào `.env.local` hoặc Cloudflare secrets. Không thêm `BAGISTO_API_URL`, `BAGISTO_PROXY_ORIGIN` hay credential D1/R2 phía client. `GOOGLE_SHEETS_WEBHOOK_URL` chỉ cần khi kiểm thử request intake thật.

## 2. Chuẩn bị D1 local

Các migration trong `migrations/` là migration bổ sung cho catalog D1 đã tồn tại;
baseline dữ liệu thật không nằm trong Git. Với database local trống, tạo schema
catalog tối thiểu trước rồi mới áp migration:

```powershell
npm run db:local:bootstrap
npx wrangler d1 migrations apply giacong-vn-catalog --local
```

`db:local:bootstrap` chỉ chạy local và chỉ tạo schema, không đưa dữ liệu demo vào
database. Migration `0009_admin_control_plane.sql` tạo page builder, navigation và
revision cho admin member. Nếu local database đã có dữ liệu cũ, kiểm tra migration
history trước khi apply; không dùng lệnh reset/xóa database để chữa lỗi schema.

## 3. Chạy website

```powershell
$env:PORT = "3000"
npm run dev
```

Storefront local chạy tại `http://localhost:3000`. Admin local vẫn đi qua admission contract; nếu không có Cloudflare Access/public staging mode hợp lệ, màn hình sẽ fail closed. Dùng `admin-staging.kienhieu.id.vn` để kiểm thử admin staging theo policy đã cấp quyền.

## 4. Kiểm tra trước khi deploy

```powershell
npm run test:admin
npm run test:catalog
npm run lint
npm run typecheck
npm run build
```

Staging luôn đi trước production. Apply migration, backup, smoke test và audit dữ liệu theo [`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md) và [`docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md`](docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md). Không chạy mutation production từ máy local.

## 5. Dừng website

Dừng Next.js bằng `Ctrl+C` tại cửa sổ đang chạy.
