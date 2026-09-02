# Bàn giao vận hành — giacong.vn trên kienhieu.id.vn

Tài liệu dành cho người vận hành (khách + chủ dự án). Quyết định kiến trúc xem [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md); checklist nghiệm thu xem [PRODUCTION_ACCEPTANCE_CHECKLIST.md](./PRODUCTION_ACCEPTANCE_CHECKLIST.md). Cập nhật 2026-09-02.

## 1. Bản đồ hệ thống

| Thành phần | Địa chỉ | Ghi chú |
| --- | --- | --- |
| Storefront production | https://kienhieu.id.vn | Cloudflare Worker `giacong-vn` @100% |
| Admin production | https://admin.kienhieu.id.vn/admin | Sau Cloudflare Access — fail-closed |
| Storefront staging | https://staging.kienhieu.id.vn | Worker `giacong-vn-staging`, public demo; version `d1d270a8-52d5-4a8b-a988-daa21e8fdfa3` |
| Admin staging | https://admin-staging.kienhieu.id.vn/admin | Cloudflare Access thật; storefront staging mới public; không có identity thì fail-closed |
| D1 production | `giacong-vn-catalog` | Catalog, leads, media metadata, CMS |
| R2 production | `giacong-vn-product-media` | Ảnh product/variant/service qua `/media/*` |
| Request intake | Google Sheet "Yêu cầu báo giá Giacong" + Apps Script | Xem mục 3 |
| Backup D1 | `.runtime/production-d1-backup-20260902-pre-release.sql` (SHA-256 `583BE2FBFFC2C6D8F0C77E7D97C3786E838EDBFD228E024AD7A8F078A147ABFD`) | Export mới + restore-drill cục bộ đạt `integrity_check=ok`; vẫn phải re-export lại ngay trước cửa sổ migration nếu dữ liệu thay đổi |

## 2. Vận hành admin

1. Đăng nhập `admin.kienhieu.id.vn/admin` — Cloudflare Access sẽ xác thực email Google được phép.
2. Vai trò nội bộ: `owner` (toàn quyền), `content_manager` (nội dung/dịch vụ/media/news), `catalog_manager` (sản phẩm/biến thể/giá), `sales_manager` (leads), `viewer` (chỉ xem). Phân quyền kiểm tra **server-side** — ẩn button bên UI chỉ là tiện ích.
3. Sản phẩm: tạo draft → điền SKU/MOQ/bước số lượng/ngưỡng liên hệ/giá tier → publish. Ràng buộc bất biến (MOQ > 0, tier đúng bậc từ MOQ theo bước, ngưỡng liên hệ nằm trên số lượng hợp lệ) được server kiểm tra — vi phạm sẽ bị từ chối.
4. Ảnh: upload qua panel media (≤ 8 MiB, JPEG/PNG/WebP) → "Dùng làm ảnh chính". Xóa ảnh đang là ảnh chính sẽ bị chặn 409 — chọn ảnh chính khác trước.
5. CMS (logo/hero/hotline): tab Nội dung → lưu draft → Publish riêng biệt; có chống ghi đè (stale-write).
6. Thiết kế page: `/admin/thiet-ke` cho phép chỉnh các section schema an toàn, xem preview draft rồi Publish; không nhập HTML/CSS/JavaScript tùy ý.
7. Điều hướng: `/admin/dieu-huong` chỉnh nhãn, href, thứ tự, ẩn/hiện primary menu desktop/mobile; chỉ bản Publish mới ra storefront.
8. Thành viên & quyền: `qtu1053@gmail.com` là owner cấp cao nhất trên staging; tại `/admin/thanh-vien`, owner được thêm tài khoản admin, cấp/sửa role và active state. `accessSubject` phải khớp identity Cloudflare Access; không dùng shared administrator account. Owner không thể tự hạ quyền hoặc tự vô hiệu hóa.
9. Mọi thay đổi quan trọng đều xuất hiện trong trang `Lịch sử thay đổi` và các
   bảng audit D1 liên quan; không lưu token hoặc secret vào audit.

## 3. Vận hành Google Sheet (request intake)

- Lead từ form/giỏ hàng → Worker tính tiền canonical từ D1 → queue → Apps Script → Sheet.
- Tab `Yêu cầu`: 1 lead = 1 dòng, 15 cột khóa schema. Tab `Chi tiết giỏ hàng`: each cart line. Tab `Tổng quan`: đếm tự động.
- Trạng thái chỉnh tại cột L (`Mới → Đang tư vấn → Chờ khách → …`) — chỉ cho phép chuyển trạng thái hợp lệ, sai sẽ tự hoàn tác.
- Trùng `request_id` không ghi trùng dòng (idempotency).
- Secret webhook nằm trong Script Properties (`CONTACT_WEBHOOK_SECRET`) và Worker secrets (`GOOGLE_SHEETS_WEBHOOK_URL/SECRET`) — không chia sẻ công khai.
- Nếu sửa code script: Deploy → Quản lý tùy chọn triển khai → ✏️ → **Phiên bản: "Mã mới"** → Triển khai. Kiểm tra tab "Thực thi" để xem log.

## 4. Triển khai & rollback

```bash
# Staging (luôn đi trước)
npm run check && npm run cf:deploy:staging

# Production: upload chưa nhận traffic → smoke → promote
npm run cf:upload:production
npx wrangler versions deploy <VERSION_ID> --name giacong-vn
```

Rollback: `npx wrangler versions deploy <VERSION_CŨ> --name giacong-vn` (mỗi lần promote đều ghi rõ rollback point trong checklist). Rollback D1: chỉ dùng backup `.sql` đã re-export, checksum và thử restore — chỉ khi có chủ ý, kèm audit trước/sau.

## 5. Giám sát

```bash
npx wrangler tail giacong-vn --format json        # log trực tiếp production
npx wrangler queues info giacong-vn-leads-dlq      # hàng đợi lead thất bại
```

- Lead thất bại xem tại D1: `SELECT full_name, delivery_status, delivery_error FROM leads WHERE delivery_status != 'delivered'`.
- DLQ có message = có lead không giao được sau 3 lần thử — kiểm tra Sheet/Apps Script trước khi replay.
- Apps Script: tab "Thực thi" trong trình chỉnh sửa để xem log `doPost`.

## 6. Khi nào cần dev

- Lỗi 502/504 lặp lại trên `/api/contact` (kiểm tra Web App còn "Bất kỳ ai" và Sheet còn quota).
- Cần thêm trường mới trên form/Sheet (thay đổi contract — phải cập nhật cả Worker lẫn Apps Script + test).
- Thêm admin viên trên staging: cấu hình email/identity trong chính sách Cloudflare Access, sau đó owner `qtu1053@gmail.com` dùng `/admin/thanh-vien` để tạo bản ghi `admin_members` và cấp đúng một trong năm role. Không ghi trực tiếp production khi chưa có backup/acceptance.

Trạng thái bàn giao hiện tại: code/test, staging storefront, Access identity
thật, owner route navigation, public deep-QA, owner bootstrap, CMS draft
isolation, navigation draft isolation và lead write/read-back có kiểm soát đã
được xác minh;
role matrix nhiều identity, write/read-back đầy đủ, production data approval, migrations `0009–0019` và
restore/rollback drill vẫn cần chủ dự án phê duyệt và thực hiện chủ ý. Không
dùng dữ liệu demo staging làm dữ liệu production.
