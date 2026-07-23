# Master plan: Nền tảng bán hàng và gia công

**Ngày chốt:** 2026-07-23  
**Trạng thái:** Quyết định kiến trúc chính thức, thay thế `docs/BAGISTO_HEADLESS_MVP.md`  
**Mục tiêu phiên kế tiếp:** Slice 0 — khóa ranh giới Bagisto và dựng nền `Acme/Commerce`

## 1. Tuyên bố sản phẩm

Dự án là một nền tảng kết hợp:

1. **Mua hàng:** bán lẻ và bán sỉ sản phẩm có sẵn; khách chọn vị/quy cách, số lượng theo MOQ và bước số lượng, nhận giá theo bậc.
2. **Thuê gia công:** khách chọn nhóm sản phẩm, công thức có sẵn/điều chỉnh/phát triển riêng, vị, bao bì và số lượng để gửi brief và nhận báo giá.

Hai ý định này ngang hàng trên storefront và dùng chung taxonomy sản phẩm. Khách chính là doanh nghiệp, đại lý và người làm nhãn riêng; khách mua lẻ vẫn được phục vụ ở các SKU cho phép mua trực tiếp.

### Tham chiếu sản phẩm

- [RainShadow Labs](https://www.rainshadowlabs.com/): cách tách Buy Direct và Private Label/Custom Manufacturing.
- [Nutribl](https://www.nutribl.com/default.aspx): công thức có sẵn, MOQ và giá theo bậc.
- [Makers Nutrition](https://www.makersnutrition.com/custom-supplement-manufacturing): dữ liệu cần thu thập trong brief gia công.
- [BulkSupplements](https://www.bulksupplements.com/): cách chọn biến thể/quy cách trong một sản phẩm.

Chỉ học information architecture và workflow; không sao chép logo, claim, nội dung hay tài sản thương hiệu.

## 2. Vai trò chính xác của Bagisto

Bagisto là **commerce kernel nội bộ**, không phải sản phẩm backend hoàn chỉnh và không phải giao diện nhân viên.

### Giữ làm engine

- Configurable product, simple variant, category, attribute và option.
- Product media, tồn kho và các flat/price/inventory indexer.
- Customer, customer group và địa chỉ.
- Cart, checkout, Sales Order, Invoice và Shipment.
- Admin user, role, session và 2FA.
- Channel/locale/currency; v1 chỉ dùng một channel, `vi`, VND.
- Chuyển khoản và phương thức giao hàng cơ bản khi được bật.

### Sửa sâu

- Lifecycle tạo/sửa/publish sản phẩm lớn, option và variant.
- MOQ, bước số lượng, giá bậc và ngưỡng chuyển báo giá.
- Customer/company và nhóm giá retail/wholesale.
- Cart/checkout/order routing giữa mua trực tiếp và báo giá.
- Inventory, pricing và order APIs dành riêng cho dự án.
- RBAC theo catalog, giá, tồn kho, dịch vụ, brief, quote, order và người dùng.

### Tạo mới cho dự án

- `ServiceFamily`, `ServiceOffering` và các option dịch vụ.
- `ManufacturingBrief`, inbox, assignee, note, attachment và status history.
- `SalesQuote`, quote item, revision và chuyển quote thành order.
- `Company`, company membership.
- `DomainAuditEvent` dùng chung toàn hệ thống.
- Operations API và toàn bộ giao diện `/quan-tri`.

### Ẩn hoặc tắt

- Bagisto storefront và generic Shop API sau khi custom API đạt parity.
- `/admin` trên public host; chỉ giữ private cho superadmin trong giai đoạn chuyển đổi, sau đó tắt.
- CMS/Marketing/Review/Wishlist/Compare/MagicAI/RMA và product type không dùng.
- Multi-channel, multi-locale và multi-currency trong v1.
- Payment gateway, carrier và promotion không thuộc nghiệp vụ đã chốt.

Không unregister provider một cách cơ học: phải giữ hoặc đăng ký lại config, event listener, cache/index và notification mà commerce kernel cần.

## 3. Kiến trúc đích

```text
Browser
  -> Next.js storefront + /quan-tri
  -> same-origin BFF
  -> /api/storefront/v1 | /api/operations/v1
  -> Acme/Commerce application + domain
  -> Bagisto adapters | custom repositories
  -> Bagisto commerce kernel + MySQL
```

### Quyết định package

- Tạo package mới `packages/Acme/Commerce`.
- `Acme/Commerce` sở hữu Catalog, Services, Briefs, Quotes, Orders, Customers, Audit và Bagisto adapters.
- `Acme/B2b` trở thành compatibility adapter cho API/data hiện tại trong một chu kỳ chuyển đổi.
- Không thêm nghiệp vụ mới vào `Acme/B2b` ngoài sửa lỗi tương thích.
- Không ghi trực tiếp bảng core Bagisto từ controller/application code mới.
- Product mutation phải dùng Bagisto repository/type service và phát event/index/cache sau transaction.

### API boundaries

- Storefront: catalog, service, cart, checkout, order, quote và manufacturing brief.
- Operations: session/me/dashboard; product/category/media/variant/pricing/inventory; service; brief; quote; order; customer/company; user/role/audit.
- Browser chỉ gọi BFF Next.js; không gọi trực tiếp Laravel.
- API không tin giá, MOQ hay tổng tiền từ client.

## 4. Domain model đã chốt

### Sản phẩm bán

- Bagisto configurable parent: `Bột dinh dưỡng`.
- Simple variant: SKU bán được theo vị/quy cách.
- Attribute/option: Hương vị, Khối lượng, Bao bì.
- Custom `commerce_product_profiles`: sales mode `direct | quote | both`, lifecycle/version.
- Custom `commerce_variant_policies`: unit, MOQ, quantity step, contact threshold, lead time.
- Giá bậc tiếp tục dùng customer-group pricing qua adapter được kiểm soát.

```text
qty < MOQ                       -> từ chối
(qty - MOQ) % step != 0         -> từ chối
MOQ <= qty < contact threshold  -> mua trực tiếp
qty >= contact threshold        -> chuyển báo giá
```

### Dịch vụ gia công

- `service_families`
- `service_offerings`
- `service_option_groups`
- `service_option_values`
- Media, content, status, sort order và version.

Dịch vụ không bị nhét vào `products` nếu không có SKU, tồn kho và checkout. Một offering lớn chứa nhiều vị/tùy chọn bên trong; không tạo 38 trang rời.

### Brief, quote và order

- Brief: company/customer, family/offering, selections, quantity, requirement, attachment, assignee, notes và history.
- Brief statuses: `new -> qualifying -> waiting_customer -> ready_to_quote -> converted/lost/closed`.
- Quote: item snapshot, option, quantity, proposed price, revisions và expiry.
- Quote statuses: `submitted -> qualifying -> priced -> sent -> accepted/rejected/expired -> converted`.
- Quote được chấp nhận sẽ tạo Bagisto Order qua application service.
- Order/quote luôn lưu snapshot SKU, option, số lượng, policy và giá tại thời điểm tạo.

## 5. Quyết định nghiệp vụ v1

- Chỉ tiếng Việt, VND và một channel.
- Chưa thanh toán online; đơn trực tiếp ở trạng thái chờ nhân viên xác nhận.
- Cho phép chuyển khoản/COD khi cấu hình thật được cung cấp.
- Nếu bất kỳ dòng nào vượt ngưỡng liên hệ, toàn bộ cart chuyển thành quote; không split cart trong v1.
- Gia công v1 dừng ở brief, qualification và quote; chưa làm BOM, nguyên liệu, lệnh sản xuất, QC hay tiến độ nhà máy.
- Tài khoản company nhiều thành viên và công nợ không chặn MVP; company cơ bản và customer group vẫn có từ đầu.
- `/admin` chỉ private-superadmin trong migration; nhân viên chỉ dùng `/quan-tri`.
- Dữ liệu demo chỉ tồn tại ở local/staging; phải xóa bằng ownership guard sau khi nhập dữ liệu thật.

## 6. Storefront và operations UI

### Storefront

- Navigation: `Mua hàng`, `Thuê gia công`, `Năng lực sản xuất`, `Kiến thức`, `Về chúng tôi`, `Liên hệ`.
- Home viewport đầu có đúng hai lựa chọn: mua sản phẩm có sẵn hoặc gia công thương hiệu riêng.
- Product detail: ảnh, vị/quy cách, MOQ/step, tier price, quantity và sticky CTA.
- Manufacturing family: chọn offering/options và mở brief wizard ngay; tối đa hai điều hướng từ home.
- Xóa captured markup, 9 CSS WordPress/Flatsome, hotlink asset, link giả, claim/logo chưa xác minh và dữ liệu `B2B-DEMO`.

### `/quan-tri`

- Tổng quan công việc.
- Bán hàng: Đơn hàng, Báo giá, Khách hàng.
- Sản phẩm: Sản phẩm bán, Nhóm sản phẩm, Tùy chọn/vị, Giá và tồn kho.
- Gia công: Nhóm dịch vụ, Offering, Yêu cầu gia công.
- Vận hành: Người dùng/vai trò, Lịch sử thay đổi, Cài đặt.

Không dùng các thuật ngữ kỹ thuật như “sản phẩm cha” trong UI nhân viên.

## 7. Roadmap thực thi

### Slice 0 — Containment và nền application layer

- Characterization tests cho provider, event, index, cache, auth và API hiện tại.
- Tạo skeleton `Acme/Commerce` và Bagisto adapter boundaries.
- Đưa direct-table writes hiện tại sau compatibility interface; chưa đổi behavior public.
- Thêm feature flag cho generic `/admin` và Shop routes nhưng chưa tắt trước parity.

**Exit:** suite hiện tại xanh; chứng minh product mutation chạy event/index sau commit; không sửa trực tiếp core/vendor.

### Slice 1 — Product end-to-end

- Operations API + wizard tạo/sửa configurable product, option, variant, media, category, inventory và commercial policy.
- Storefront đọc contract mới.
- Audit, ETag, rollback và cache revalidation.

**Exit:** nhân viên tạo “Bột dinh dưỡng” với ít nhất hai vị hoàn toàn từ `/quan-tri`; storefront cập nhật trong 30 giây; không vào Bagisto Admin/DB/code.

### Slice 2 — Service catalog

- Tạo schema/service APIs/admin UI.
- Migrate 6 family/38 offering từ TypeScript sang DB.
- Redirect URL offering cũ về family với lựa chọn đã chọn.

**Exit:** thêm/sửa/ẩn/sắp xếp dịch vụ không cần sửa code hoặc deploy frontend.

### Slice 3 — Manufacturing brief inbox

- Wizard structured, attachment, inbox, assignment, status, notes và history.
- Brief cũ migrate thành `legacy_unclassified`, không bịa dữ liệu thiếu.

**Exit:** nhân viên biết chính xác khách chọn dịch vụ/tùy chọn/số lượng nào và ai xử lý.

### Slice 4 — Direct order và quote routing

- Cart/checkout server-enforced MOQ, step, tier và stock.
- Dưới threshold tạo order chờ xác nhận; từ threshold tạo quote.
- Quote accepted chuyển thành Bagisto Order với snapshot/audit.

**Exit:** không bypass policy bằng API; không còn query `intent` bị bỏ qua.

### Slice 5 — Company, RBAC, dashboard và audit

- Company cơ bản, customer groups, quyền theo nhiệm vụ.
- Dashboard lead/quote/order/data-quality cần xử lý.
- Audit UI theo entity và actor.

### Slice 6 — Cutover và loại facade cũ

- Backfill policies, audit và brief cũ.
- Compatibility `/api/b2b/*` trong một chu kỳ rồi loại bỏ.
- Private `/admin`, tắt generic Shop routes khi parity đạt.
- Xóa dữ liệu demo có ownership guard; performance/security/rollback rehearsal.

## 8. Quality gates chung

- TDD từng behavior; implementation và review do agent khác nhau.
- Mọi thay đổi nhiều file theo lát cắt nhỏ, commit độc lập.
- Backend feature, public regression, migration rollback và audit tests.
- Frontend lint, typecheck, build, browser E2E desktop/mobile và accessibility.
- Không asset hotlink; không claim/logo không xác minh.
- Storefront LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 ở staging mục tiêu.
- Navigation warm dưới 800ms; không prefetch hàng loạt product/offering trước ý định.
- Không public Bagisto branding hoặc generic admin.
- Backup và rollback rehearsal trước migration/cutover.

## 9. Trạng thái bàn giao hiện tại

- Frontend repo: branch `codex/headless-environment-baseline`, HEAD `0ed5ca0`.
- Backend repo: branch `codex/b2b-environment-baseline`, HEAD `eb62867`.
- Local live: frontend `http://localhost:3001`, backend nội bộ `http://127.0.0.1:18001`, DB `127.0.0.1:3307`.
- Các app ngoài dự án đang chiếm 3000/8000/8001; không được dừng hoặc thay thế.
- Frontend/backend hiện tại là baseline có thể hồi quy, không phải thiết kế đích.
- Không được xây tiếp trên captured UI hoặc coi editor commercial-rules hiện tại là backend hoàn chỉnh.

## 10. Lệnh mở session kế tiếp

Chạy từ PowerShell trong thư mục dự án:

```powershell
codex "Đọc AGENTS.md và docs/COMMERCE_PLATFORM_MASTER_PLAN.md. Tiếp tục đúng Slice 0, điều khiển Terra triển khai backend theo TDD trong worktree riêng và Luna review độc lập. Không xây UI mới trước khi khóa Acme/Commerce application layer; không ghi trực tiếp bảng core Bagisto; không chạm các app ngoài dự án ở cổng 3000/8000/8001; không push. Bắt đầu bằng audit trạng thái Git và tạo task brief/RED characterization tests."
```

Nếu mở session bằng giao diện Codex Desktop, dán nguyên phần nằm trong dấu ngoặc kép làm tin nhắn đầu tiên.
