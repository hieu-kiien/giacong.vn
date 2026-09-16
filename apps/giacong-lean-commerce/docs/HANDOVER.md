# Bàn giao vận hành — giacong.vn trên kienhieu.id.vn

Tài liệu dành cho người vận hành (khách + chủ dự án). Quyết định kiến trúc xem [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md); checklist nghiệm thu xem [PRODUCTION_ACCEPTANCE_CHECKLIST.md](./PRODUCTION_ACCEPTANCE_CHECKLIST.md). Cập nhật 2026-09-16.

## Checkpoint bàn giao mới nhất

Production **chưa được thay đổi trong đợt này**; source đã kiểm tra và push là
commit `6eec54f1` trên nhánh `codex/admin-quality-completion`. Staging đang chạy
`giacong-vn-staging` version
`4f005c6f-b437-4278-82ef-3dd0a35b2c5b` trên
`staging.kienhieu.id.vn` và `admin-staging.kienhieu.id.vn`.
Read-only Wrangler đối chiếu production Worker `giacong-vn` đang ở version
`7f98ed7b-0d9f-4d59-880c-ee364e02e610`; migration staging `0023–0026` chưa được
áp dụng vào D1 production.

Regression trên đúng staging version này đã xác nhận URL sản phẩm demo cũ
`/san-pham/b2b-demo-bot-dinh-duong-vi-vani` chuyển an toàn về `/san-pham/`,
không trỏ nhầm sang sản phẩm mới; trang dịch vụ cũ vẫn hiển thị nội dung và đã
loại CTA bán mẫu web. Giỏ yêu cầu đọc lại đủ 2 SKU, tổng tạm tính
`14.335.000 ₫`, console không có warning/error; thanh giỏ nổi ở viewport 1132px
có vùng 38×38 và icon 22×22, không tràn ngang. Không gửi RFQ thật và không ghi
thêm/xóa dữ liệu staging trong lượt này.

Hotfix H1 captured service đã được kiểm tra trên public staging sau deploy:
`/gia-cong-sot-bo-dau-phong/` hiển thị H1 theo đúng nội dung dịch vụ và
canonical đúng URL; homepage vẫn giữ H1 Hero. Hotfix không ghi D1/R2 và đã push
trên nhánh `codex/admin-quality-completion`.

Access owner đã đọc lại các shortcut inline sản phẩm/dịch vụ/tin tức/liên hệ
trên đúng version `4c85039f`; form dịch vụ mở đúng bản ghi ID 8, form contact
mở và đọc đúng giá trị website đang dùng. UAT runtime dịch vụ QA
(publish/đổi slug/redirect/khôi phục) và tin tức redirect QA đã đạt rồi khôi
phục sạch. Các suite source và OpenNext build pass; shell runner Windows cần
dừng sau output cuối.
QA sản phẩm đã round-trip và khôi phục/ẩn; QA dịch vụ động ID 16 đang là nháp;
QA tin tức ID 4 hiện không xuất bản, slug cũ được khôi phục và redirect QA đã
được xóa. Chưa chốt bàn
giao vì còn phải duyệt dataset/nội dung kinh doanh, xác nhận đích nhận request
và thực hiện UAT ghi/publish bằng tài khoản thật; tình huống hai tab stale
revision đã đạt trên staging nhưng logout/expiry và audit đầy đủ còn mở. Lead staging cũ có cả trạng
thái chuyển Google lỗi `502/504`, nên chưa gửi controlled request mới.
Sau deploy mới, live browser đã xác nhận facts MOQ đổi theo SKU và giá tier/tạm
tính cập nhật đúng khi đổi số lượng; giỏ nhiều SKU giữ nguyên sau tải lại.
UAT owner bổ sung ngày 2026-09-16 đã round-trip sản phẩm QA, dịch vụ QA và bài
tin QA (lưu → tải lại; bài tin xuất bản → đọc public → gỡ xuất bản), sau đó khôi
phục đúng snapshot; không gửi RFQ thật và không sửa dữ liệu kinh doanh.
Sản phẩm QA `test 1` (ID 10) đã được ẩn mềm: D1 là `is_active=0`,
`status=archived`, còn nguyên 1 biến thể/3 giá bậc; admin hiển thị `Tạm ẩn`,
sitemap staging còn 223 URL và URL `/san-pham/test1` trả `404` với title riêng,
noindex, không canonical. Biến thể QA `SMOKE-VARIANT-20260816` (ID 28) đã
  được xóa khỏi D1 staging sau khi kiểm tra không có media/lead tham chiếu;
  2 tier bị cascade và 3 audit lịch sử được giữ.
Quality/staging gate GitHub run
`35089195699` (HEAD `7fe69b52`) xanh cả Quality gate và staging dry-run;
workflow không deploy. Deep-QA run
`35089196729` (HEAD `7fe69b52`) xanh trên active protected preview, gồm catalog,
product/cart/contact-drift, R2 media và responsive browser checks. Workflow
không soft-pass: nó lấy preview URL của deployment đang chạy và chỉ gửi Access
service token khi cần. Lượt cũ `35085313576` vẫn được giữ làm bằng chứng rằng
GitHub runner gọi hostname public ổn định bị edge trả `403`; nếu muốn CI gọi
đúng hostname đó, owner cần duyệt allowlist/egress rule riêng.

## 1. Bản đồ hệ thống

| Thành phần | Địa chỉ | Ghi chú |
| --- | --- | --- |
| Storefront production | https://kienhieu.id.vn | Chưa deploy bản checkpoint 2026-09-16; chỉ phát hành sau duyệt |
| Admin production | https://admin.kienhieu.id.vn/admin | Sau Cloudflare Access — fail-closed |
| Storefront staging | https://staging.kienhieu.id.vn | Worker `giacong-vn-staging`; version `0083b43f-6d2d-4b7d-b55d-cb161432477b` |
| Admin staging | https://admin-staging.kienhieu.id.vn/admin | Cloudflare Access thật; storefront staging mới public; không có identity thì fail-closed |
| D1 production | `giacong-vn-catalog` | Catalog, leads, media metadata, CMS |
| R2 production | `giacong-vn-product-media` | Ảnh product/variant/service qua `/media/*` |
| Request intake | Google Sheet "Yêu cầu báo giá Giacong" + Apps Script | Xem mục 3 |
| Backup D1 | `.runtime/handover-20260913/production-d1-after-navigation.sql` (SHA-256 `FA70535FB59FA0F738CDE82598369AD515216D5587C4A556FA2D7538A7D34B41`) | Export sau thay đổi navigation; restore-drill trước release đạt `integrity_check=ok` |

## 2. Vận hành admin

1. Đăng nhập `admin.kienhieu.id.vn/admin` — Cloudflare Access sẽ xác thực email Google được phép.
2. Vai trò hiện dùng: `owner` (toàn quyền). Các role cũ (`content_manager`, `catalog_manager`, `sales_manager`, `viewer`) không còn được admission; phân quyền vẫn kiểm tra **server-side** — ẩn button bên UI chỉ là tiện ích.
3. Sản phẩm: tạo draft → điền SKU/MOQ/bước số lượng/ngưỡng liên hệ/giá tier → publish. Ràng buộc bất biến (MOQ > 0, tier đúng bậc từ MOQ theo bước, ngưỡng liên hệ nằm trên số lượng hợp lệ) được server kiểm tra — vi phạm sẽ bị từ chối.
4. Ảnh: upload qua panel media (≤ 8 MiB, JPEG/PNG/WebP) → "Dùng làm ảnh chính". Xóa ảnh đang là ảnh chính sẽ bị chặn 409 — chọn ảnh chính khác trước.
5. CMS (logo/hero/hotline): tab Nội dung → lưu draft → Publish riêng biệt; có chống ghi đè (stale-write).
6. Thiết kế page: `/admin/thiet-ke` cho phép chỉnh các section schema an toàn, lưu/Publish rồi mở đúng route storefront thật để kiểm tra; không nhập HTML/CSS/JavaScript tùy ý.
7. Điều hướng: `/admin/dieu-huong` chỉnh nhãn, href, thứ tự, ẩn/hiện menu chính desktop/mobile hoặc tạo mục liên kết cuối trang; chỉ bản Publish mới ra storefront. Footer managed links xuất hiện trong vùng riêng, không ghi đè cột captured legacy.
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

Authenticated admin staging QA (read-only, không submit form) dùng một
Playwright storage state đã tạo sau khi đăng nhập Access:

```bash
QA_ADMIN_STORAGE_STATE=./.runtime/access-owner.storage.json \\
QA_ADMIN_EXPECTED_ROLE=owner \\
npm run qa:admin-staging
```

Runner kiểm tra 10 route admin ở mobile/desktop, heading, trạng thái Access,
lỗi 1102/5xx, overflow và console lỗi từ staging origin. Không dùng storage
state chứa secret trong Git; role matrix đủ năm role có thể chạy bằng một JSON
map local, ví dụ:

```json
{
  "owner": "./.runtime/access-owner.storage.json",
  "content_manager": "./.runtime/access-content.storage.json",
  "catalog_manager": "./.runtime/access-catalog.storage.json",
  "sales_manager": "./.runtime/access-sales.storage.json",
  "viewer": "./.runtime/access-viewer.storage.json"
}
```

```bash
QA_ADMIN_ROLE_STATES=./.runtime/admin-role-states.json \\
npm run qa:admin-staging
```

Mỗi storage state phải thuộc một identity được chủ dự án cấp phép; runner
không tạo tài khoản, không submit form và không tự đóng write/read-back gate.

Controlled 1102 stress recheck chỉ dành cho admin staging, không thực hiện
mutation và tự chặn mọi hostname khác:

```powershell
$env:QA_ADMIN_STORAGE_STATE = './.runtime/access-owner.storage.json'
$env:QA_ADMIN_STRESS_CONCURRENCY = '2'
$env:QA_ADMIN_STRESS_ROUNDS = '2'
npm run qa:admin-stress
```

Runner đi qua 10 route admin với concurrency hữu hạn, kiểm tra HTTP/render,
1102/resource-limit, console và mọi request `POST/PUT/PATCH/DELETE`; thiếu
storage state hoặc dùng URL không phải `https://admin-staging.kienhieu.id.vn`
sẽ fail-closed.

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
- Thêm admin viên trên staging: cấu hình email/identity trong chính sách Cloudflare Access, sau đó owner `qtu1053@gmail.com` dùng `/admin/thanh-vien` để tạo bản ghi `admin_members` và cấp role `owner` theo mô hình Lean V1. Không ghi trực tiếp production khi chưa có backup/acceptance.

Trạng thái bàn giao hiện tại: production storefront vẫn chạy 100% trên
`kienhieu.id.vn` với version `7f98ed7b-0d9f-4d59-880c-ee364e02e610`; chưa được
promotion bản mới. Staging đang chạy source `6eec54f1` với version
`4f005c6f-b437-4278-82ef-3dd0a35b2c5b`. Các nhóm regression catalog/service/
commerce lần lượt pass `7/7`, `28/28`, `104/104`; build OpenNext/Cloudflare
hoàn tất; GitHub Actions run `35099413896` cũng pass Quality gate và staging
gate. Browser read-back trên staging đã kiểm tra URL cũ, CTA dịch vụ và giỏ.
Không dùng dữ liệu demo staging làm dữ liệu production.

Các gate còn lại của bàn giao là theo dõi observability đủ 24 giờ, chủ dự án
duyệt nội dung kinh doanh/catalog và quyết định redirect `giacong.vn` nếu có
quyền DNS/hosting domain cũ.
