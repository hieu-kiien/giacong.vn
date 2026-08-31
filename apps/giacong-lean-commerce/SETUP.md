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

Nếu `npm ci` báo `EPERM` trên file native trong `node_modules`, hãy dừng mọi
Next/Worker dev server đang chạy trong app rồi chạy lại. Không xóa `.runtime`,
`.env*` hoặc dùng `git clean` để chữa lỗi dependency.

Chỉ thêm các secret cần thiết vào `.env.local` hoặc Cloudflare secrets. Không thêm `BAGISTO_API_URL`, `BAGISTO_PROXY_ORIGIN` hay credential D1/R2 phía client. `GOOGLE_SHEETS_WEBHOOK_URL` chỉ cần khi kiểm thử request intake thật.

## 2. Chuẩn bị D1 local

Các migration trong `migrations/` là migration bổ sung cho catalog D1 đã tồn tại;
baseline dữ liệu thật không nằm trong Git. Với database local trống, tạo schema
catalog tối thiểu trước rồi mới áp migration:

```powershell
npm run db:local:bootstrap
npx wrangler@4.115.0 d1 migrations apply giacong-vn-catalog --local
npx wrangler@4.115.0 d1 migrations list giacong-vn-catalog --local
```

`db:local:bootstrap` chỉ chạy local và chỉ tạo schema, không đưa dữ liệu demo vào
database. Migration `0009_admin_control_plane.sql` tạo page builder, navigation và
revision cho admin member. Nếu local database đã có dữ liệu cũ, kiểm tra migration
history trước khi apply; không dùng lệnh reset/xóa database để chữa lỗi schema.

Baseline local được coi là sẵn sàng khi `migrations list` báo không còn migration
phải apply và các bảng `site_settings`, `site_pages`, `site_navigation_items`,
`admin_members`, `news_posts`, `media_assets` tồn tại.

## 3. Chạy website

```powershell
$env:PORT = "3000"
npm run dev
```

Storefront local chạy tại `http://localhost:3000`. Admin local vẫn đi qua admission contract và sẽ fail closed nếu không có Access hợp lệ. Dùng `admin-staging.kienhieu.id.vn` để kiểm thử admin staging sau khi đăng nhập theo policy đã cấp quyền.

## 4. Kiểm tra trước khi deploy

```powershell
npm run test:admin
npm run test:catalog
npm run lint
npm run typecheck
npm run build
```

Đối với công việc admin visual, đọc và cập nhật đồng thời:

- [`docs/ADMIN_VISUAL_ROADMAP.md`](docs/ADMIN_VISUAL_ROADMAP.md);
- [`docs/ADMIN_VISUAL_FILE_MAP.md`](docs/ADMIN_VISUAL_FILE_MAP.md);
- [`docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`](docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md).

Mỗi lát triển khai phải có test contract/server trước UI, browser QA trên staging
cho flow liên quan và ghi rõ bằng chứng đạt trong pull request hoặc handoff. Không
chạy mutation production để kiểm tra local/staging.

Staging luôn đi trước production. Apply migration, backup, smoke test và audit dữ liệu theo [`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md) và [`docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md`](docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md). Không chạy mutation production từ máy local.

## 5. Dừng website

Dừng Next.js bằng `Ctrl+C` tại cửa sổ đang chạy.
