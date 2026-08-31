# Lộ trình Giacong Visual Admin

**Trạng thái:** kế hoạch thực thi chính
**Cập nhật:** 2026-08-31
**Phạm vi:** apps/giacong-lean-commerce
**Bản đồ đi kèm:** ADMIN_VISUAL_FILE_MAP.md

Tài liệu này là nguồn bám theo cho việc biến admin hiện tại thành mô hình
**storefront-first hybrid admin**: chỉnh sửa theo ngữ cảnh ở nơi nội dung được
hiển thị, nhưng vẫn giữ trung tâm vận hành đầy đủ cho nghiệp vụ phức tạp và xử
lý hàng loạt.

## 1. Quyết định sản phẩm

### 1.1 Mô hình đích

~~~
admin-staging.kienhieu.id.vn
├─ Chỉnh sửa website
│  └─ storefront thật + nút contextual + điều khiển bản nháp/phát hành
├─ Trung tâm quản trị
│  └─ dữ liệu, lọc, chọn nhiều, xử lý hàng loạt, nghiệp vụ đặc biệt
└─ Tài khoản, trợ giúp và trạng thái hệ thống
~~~

- Public storefront không hiển thị bất kỳ nút, outline, toolbar hay dữ liệu admin
  nào.
- Admin sau Cloudflare Access dùng cùng renderer và cùng giao diện storefront;
  một thanh điều khiển nhỏ là tùy chọn, không phải điều kiện bắt buộc.
- Nút Sửa cạnh vùng nội dung là cơ chế chính cho chỉnh sửa cục bộ. Toolbar chỉ
  chứa hành động toàn cục như xem trước, lưu nháp, phát hành và mở trung tâm
  quản trị.
- Owner có toàn bộ capability được phê duyệt; các role khác chỉ thấy và thực thi
  đúng phần được cấp. UI ẩn nút không thay thế cho server authorization.
- Không biến hệ thống thành page builder tự do. Chỉ chỉnh sửa region/field có
  source-of-truth, validation, quyền và test rõ ràng.

### 1.2 Ranh giới không được phá vỡ

- Cloudflare Access là lớp xác thực đầu vào; D1 là source of truth cho dữ liệu;
  R2 là nơi lưu media.
- Tất cả write đi qua server-side contract, same-origin guard, validation,
  optimistic concurrency, audit và idempotency theo
  CLOUDFLARE_ADMIN_WRITE_CONTRACT.md.
- Staging là nơi phát triển và acceptance. Không bật admin write hoặc thử nghiệm
  bằng mutation trên production.
- Không phục hồi Bagisto, checkout, payment, order engine, customer account hay
  marketplace vào Lean V1.
- Không thêm role, dependency, module hoặc data model mới chỉ vì có thể hữu ích.
  Nếu cần, phải ghi lý do và hợp đồng trước.

### 1.3 Nguồn quyết định

Thứ tự ưu tiên khi có mâu thuẫn:

1. CLOUDFLARE_NATIVE_V1_PLAN.md;
2. CLOUDFLARE_ADMIN_WRITE_CONTRACT.md;
3. CLOUDFLARE_CURRENT_STATE.md — bằng chứng runtime, không tự mở rộng scope;
4. AI_ADMIN_SKILL_GUIDE.md;
5. ADMIN_VISUAL_FILE_MAP.md;
6. tài liệu research/design lịch sử.

## 2. Baseline đã kiểm tra

Đây là trạng thái sau các lát implementation và QA ngày 2026-08-31. Các mục có
giới hạn phải được ghi đúng như vậy, không coi là xanh hoàn toàn.

### 2.1 Đã xác minh

- `master` đang chứa các lát đã review của P1/P2/P3/P4/P5: host-gated visual
  context, settings write contract, contextual brand/hero editor, contextual
  news/page hand-off, AdminShell grouping, product bulk import và product/service
  bulk archive UI/backend.
- Node v24.14.0, npm 11.9.0, .nvmrc yêu cầu Node 24.
- package-lock.json tồn tại; dependency tree sau khi cài lại khớp các package
  quan trọng trong lockfile.
- Wrangler local dùng version trong package (4.115.0) qua npx.
- Local D1 đã bootstrap và áp đủ 16 migration; d1 migrations list báo không
  còn migration phải apply. Các bảng admin/CMS chính gồm site_settings,
  site_pages, site_navigation_items, admin_members, news_posts và media_assets
  đã tồn tại.
- Các suite focused sau khi merge hiện tại đã pass: test:admin 158/158,
  test:contact 103/103, test:catalog 5/5, test:catalog-purchase-ui 1/1,
  test:service 3/3, test:commerce 33/33, test:listing 4/4 và test:detail
  29/29; UI import 2/2, category batch 4/4 và harness timing 1/1.
- Deep QA Playwright đã pass responsive route matrix, catalog search/sort/filter,
  detail mobile stacking, cart localStorage → request route và keyboard
  reachability ở local fixture và public staging (2026-08-29). Đây là evidence
  runtime storefront; admin staging vẫn cần một phiên Cloudflare Access hợp lệ.
- File `src/components/admin/AdminCategoryPanel.tsx` ở root workspace là bản
  trùng không thuộc app triển khai, không có caller trong app và đã được loại bỏ;
  bản canonical vẫn ở `apps/giacong-lean-commerce/src/components/admin/AdminCategoryPanel.tsx`.
- `apps/giacong-lean-commerce/package-lock.json` đã được npm 11 chuẩn hóa để
  khớp tên package `@workspace/web`; không có thay đổi version dependency.
- Không có .env, .env.local, node_modules, .next, .wrangler hay file .runtime
  nào được Git track.

### 2.2 Còn phải lưu ý

- Lần chạy full `npm run check` trên source hiện tại đã in xanh toàn bộ
  test/lint/typecheck/build với exit code `0`; marker được ghi nhận riêng vì
  wrapper PowerShell trên máy có thể giữ process sau khi Node đã in hết kết quả.
  Sau mỗi lát mới vẫn phải chạy lại gate trong cửa sổ release không có dev server
  trước khi đánh dấu production ready.
- Lát hardening mới đã đưa toàn bộ admin JSON writes qua
  `readBoundedAdminJson` và thêm `LIMIT 100` cho các collection read model chính;
  đây là contract/security evidence, không thay thế role matrix và browser QA.
- Commit `cf3856c` bổ sung regression cho race revision của service batch: lỗi
  guard có chủ đích được map thành `STALE_WRITE`, transaction không để lại
  marker/audit dở dang. Lát P6 kế tiếp bổ sung focus trap, restore focus và
  `aria-describedby` cho dialog dùng chung; browser runtime evidence vẫn mở.
- Build local không có dữ liệu CMS nếu D1 chưa bootstrap; khi đó code fallback về
  default và có log no such table. Đây là lỗi setup, không được dùng làm bằng
  chứng cho admin runtime.
- .runtime có thể chứa backup hoặc audit artifact. Không dọn bằng git clean
  hoặc xóa đệ quy.

## 3. Nguyên tắc kiến trúc

### 3.1 Một renderer, hai context

Public và admin phải gọi cùng source/render path. Admin chỉ thêm context và lớp
điều khiển:

~~~
published data → shared storefront renderer → public view
draft data     → same renderer + admin context → edit/preview view
~~~

Không tạo cặp PublicHero/AdminHero chỉ vì admin có thêm nút. Vùng nào hiện còn
là captured markup thì phải có adapter/region mapping có giới hạn; không được
giả vờ rằng mọi node HTML đều là field có thể sửa.

### 3.2 Ba nguồn trạng thái phải luôn tách biệt

| Trạng thái | Ai nhìn thấy | Mục đích |
| --- | --- | --- |
| Published | public và admin | bản đang phục vụ storefront |
| Draft | admin có quyền | bản đang chỉnh sửa, chưa làm public |
| Preview | admin có quyền | render draft trong cùng layout để kiểm tra |

Mỗi mutation phải có version hiện tại. Write cũ phải bị từ chối bằng lỗi stale
thay vì ghi đè âm thầm.

### 3.3 Chỉnh sửa theo region, không theo quyền admin chung

Mỗi region muốn bật nút phải có đủ:

~~~
regionKey
→ data source
→ read/write/publish capability
→ input validation
→ draft/published semantics
→ API/server guard
→ loading/error/empty/stale feedback
→ automated test + browser acceptance
~~~

Thiếu một mắt xích thì region chỉ được xem, chưa được xem là editable.

## 4. Lộ trình theo lát triển khai

Mỗi phase phải kết thúc bằng một hệ thống vẫn chạy được. Không gom toàn bộ admin
visual vào một pull request lớn.

### P0 — Dọn baseline và tạo nguồn bám theo

**Trạng thái:** đã thực hiện trong đợt này.

**Kết quả cần giữ:**

- Một app canonical: apps/giacong-lean-commerce.
- Lệnh cài/chạy trong README dùng npm đúng với package-lock và không giả định có
  root npm workspace.
- Local D1 có schema đầy đủ nhưng không chứa dữ liệu production.
- Có roadmap, file map, test matrix và Definition of Done.
- Không track secret hoặc generated output.

**Gate:**

- git status --short chỉ hiện đúng thay đổi đang làm;
- git diff --check không có lỗi;
- npm ls --depth=0 không có invalid/missing;
- npx wrangler@4.115.0 d1 migrations list giacong-vn-catalog --local báo
  No migrations to apply!;
- test/lint/typecheck/build có log và exit code được ghi rõ; nếu dev server đang
  chạy thì dừng trước khi kết luận.

### P1 — MVP-0: Admin mode shell, chưa cho write

**Trạng thái:** code và contract đã có trong `master`; browser proof cho public
local đã pass. Proof admin thật vẫn chờ staging Cloudflare Access.

**Mục tiêu:** admin đã vào được cùng storefront và hiểu mình đang ở chế độ nào,
nhưng chưa có mutation inline.

**Công việc:**

1. Tạo context admin tối thiểu dựa trên session hiện tại.
2. Root admin sau Access render đúng route/storefront tương ứng.
3. Thêm nhãn rõ Chế độ quản trị và đường về Trung tâm quản trị.
4. Có trạng thái loading, blocked, unavailable và retry dễ hiểu.
5. Public host không tải overlay, không render control và không gọi admin session
   ngoài phạm vi cần thiết.
6. Giữ /admin và AdminShell làm back office; chưa đổi routing hàng loạt.

**Files chính:**

- hiện có: src/app/(storefront)/page.tsx,
  src/app/(storefront)/[...slug]/page.tsx,
  src/components/site/CapturedStorefrontShell.tsx,
  src/components/admin/AdminShell.tsx, src/lib/admin-session.ts,
  src/lib/admin-access.ts;
- dự kiến: component/context mới trong src/components/admin/, tích hợp mỏng
  vào storefront layout/route; tên file phải cập nhật vào file map trước khi code.

**Test bắt buộc:**

- test session/auth host và public isolation;
- browser staging: public không có control, admin owner có mode indicator;
- role không hợp lệ/Access thiếu thì fail closed;
- desktop và mobile public không thay đổi;
- keyboard focus vào mode control và link back office.

**Đạt khi:** admin nhìn đúng storefront bằng shared renderer, public không bị
ảnh hưởng, không có write mới và mọi trạng thái lỗi đều giải thích được cho người
không chuyên môn.

### P2 — MVP-1: Một lát chỉnh sửa end-to-end

**Checkpoint 2026-08-28:** Per-setting settings write contract, bulk
`publish-all` và contextual editor brand/hero đã vào `master`. Editor dùng
canonical `/api/admin/site-settings`, có role-aware read/write/publish, draft,
preview card, loading/error/stale feedback và keyboard/mobile handling. Gate còn
mở của P2 là browser proof trên admin host thật, staging read-back và kiểm tra
preview bằng renderer storefront đầy đủ thay cho draft card MVP.

**Mục tiêu:** hoàn thành trọn vẹn một flow có giá trị cao, bắt đầu từ brand/hero
đã có mapping.

**Scope đề xuất:**

- logo và brand name;
- phone, email và kênh liên hệ;
- hero eyebrow/title/description/image/CTA đã có trong settings;
- lưu draft, preview draft, publish và hiển thị public sau publish.

**Công việc:**

1. Tạo region registry cho các field trên, không scan/edit HTML tùy ý.
2. Dùng site_settings hiện tại và API server hiện tại nếu contract đáp ứng;
   chỉ tạo migration khi có gap đã ghi rõ.
3. Nút contextual có label tiếng Việt, mở popover/dialog nhỏ, không che nội dung.
4. Save draft và publish có version, dirty state, stale state và feedback.
5. Owner/content manager thao tác được; catalog/sales/viewer bị giới hạn đúng
   capability.

**Test bắt buộc:**

- field validation và URL/media validation;
- draft không làm thay đổi public;
- preview dùng draft nhưng không ghi public;
- publish thay đổi public đúng một lần;
- stale write trả lỗi và giữ nội dung của người sửa trước;
- role matrix cho read/write/publish;
- audit event cho save/publish;
- browser screenshot trước/sau và kiểm tra responsive.

**Đạt khi:** một người ít chuyên môn có thể đổi hero/phone/logo mà không cần biết
database hay route API, còn public vẫn sạch và dữ liệu chưa publish không rò ra.
Lưu ý: local contract/UI đã đạt phần MVP; phase chưa đóng cho tới khi có
staging/admin evidence.

### P3 — MVP-2: Tin tức và media

**Checkpoint 2026-08-29:** backend P3 đã vào `master` và focused contract tests
đã pass. Migration `0012_news_draft_publish_contract.sql` tách bản nháp khỏi
snapshot public; lưu nháp không đổi storefront, publish/unpublish là mutation
riêng, batch tối đa 100 bài có kết quả skipped, revision, idempotency và audit
envelope/per-item. Media product/site đã giới hạn multipart trước khi parse,
file tối đa 8 MiB và kiểm tra chữ ký JPEG/PNG/WebP. Contextual action cho news
detail đã nối qua `AdminVisualMode` và deep-link về `/admin/tin-tuc?edit=<id>`;
admin page đọc lại bài bằng `/api/admin/news/<id>`, ID không hợp lệ báo lỗi an
toàn. Public staging `/tin-tuc` đã kiểm tra không có admin session request hoặc
control. P3 chưa được đánh dấu hoàn tất cho tới khi có admin browser
desktop/mobile/keyboard, staging read-back bằng phiên Access thật và media
runtime acceptance.

**Operations update 2026-08-31:** media product/site write path đã được nâng
lên exact `requestId` + revision/CAS + idempotent audit với R2 compensation;
focused `admin-media-write` pass. Migrations `0013–0016` đã apply trên staging,
worker version `0d1e14c1-ec4d-47db-b0e2-4275f246f919` đã promote 100% và public
smoke/deep QA pass. P3 vẫn mở ở runtime write/read-back bằng Access identity,
admin browser và media object/reference evidence.

**Mục tiêu:** quản trị nội dung thường xuyên mà không phải quay lại nhiều màn hình
khó hiểu.

**Công việc:**

1. Trên storefront, nút contextual cho danh sách/detail tin khi region đã có
   mapping.
2. Trong back office, giữ danh sách tin, tìm kiếm, lọc trạng thái và thao tác
   an toàn.
3. Đưa news về semantics draft/published nhất quán với settings/pages; không
   tiếp tục coi checkbox isPublished trực tiếp là đủ nếu flow cần preview.
4. Media picker hỗ trợ chọn ảnh, alt text, thay ảnh và guard không xóa asset đang
   được tham chiếu.
5. Có batch tối thiểu cho tin: chọn nhiều, đổi trạng thái/phát hành/ẩn nếu API
   và audit contract đã khóa.

**Test bắt buộc:**

- news input/slug/excerpt/cover URL;
- draft/public listing separation;
- media checksum, URL safety, alt text, in-use deletion guard;
- batch success, batch partial failure và retry idempotent;
- audit một event cho mỗi mutation thành công;
- keyboard/table/mobile behavior cho danh sách.

**Đạt khi:** content manager hoàn thành một chu kỳ viết → xem trước → phát hành
tin và catalog manager xử lý media mà không làm hỏng ảnh đang dùng.

### P4 — MVP-3: Trang, section và navigation

**Checkpoint 2026-08-29:** managed page renderer đã nhận `pageKey` tùy chọn và
hiển thị contextual action chỉ sau khi `AdminVisualMode` xác nhận session ready
với role owner/content_manager. Nút mở `/admin/thiet-ke?page=<pageKey>`; builder
đọc query rồi chọn đúng page sau khi gọi API pages canonical. Captured fallback
không truyền `pageKey`, public không tự fetch session. Contract P4 mới đạt cho
managed-page hand-off; footer renderer, browser route matrix và staging Access
read-back vẫn mở.

**Mục tiêu:** chuyển các vùng layout cần thay đổi thường xuyên sang cấu trúc an
toàn có thể chỉnh sửa.

**Công việc:**

1. Dùng PageBlocks và schema an toàn hiện có: hero, rich text, image,
   feature grid, CTA, contact.
2. Storefront edit button mở đúng block/section; thêm, di chuyển và xóa có
   confirmation, giới hạn và preview.
3. Navigation primary desktop/mobile dùng cùng published source; kiểm tra riêng
   footer vì model hiện có nhưng renderer không mặc định áp dụng đầy đủ.
4. Chỉ cho phép URL/text đã normalize; không cho HTML/CSS/JS tùy ý.
5. Giữ page builder back office cho thao tác lớn; inline editing chỉ là shortcut
   đến đúng region/block.

**Test bắt buộc:**

- block schema bounds và unsafe payload rejection;
- reorder/delete/add và version conflict;
- page draft/published route behavior;
- primary/footer navigation read/write/publish;
- public fallback khi page managed chưa publish;
- browser route matrix và screenshot desktop/mobile;
- no arbitrary markup execution.

**Đạt khi:** người dùng có thể chỉnh các section đã hỗ trợ ngay tại storefront,
nhưng hệ thống vẫn giữ layout an toàn và luôn có đường thao tác đầy đủ trong
back office.

### P5 — MVP-4: Trung tâm vận hành đầy đủ và xử lý hàng loạt

**Checkpoint 2026-08-31:** AdminShell được nhóm lại theo ngôn ngữ dễ hiểu, có
nhãn vai trò/link storefront; product bulk import, product bulk archive và
service/category bulk archive đã có backend + UI. Product import giữ giới hạn stream 64
KiB/tối đa 50 dòng,
owner/catalog_manager, UUID idempotency, fingerprint ổn định trước lookup
category và D1 batch atomic cho product/meta/audit. Service archive dùng route
snapshot revision additive, tối đa 100 item, `expectedRevision`, per-item
`stale/already_archived/not_found`, D1 batch, audit child/envelope và replay
idempotency mà không thay đổi `AdminService` read model dùng chung. Product
archive cũng giữ `AdminProduct` read model bất biến; category archive bảo toàn
row và dùng snapshot revision, per-item stale/not-found/already-archived, D1
atomic audit/idempotency. Viewer không thấy control mutation. UI có preview lỗi,
guard kết quả atomic, retry giữ request ID và thông báo kết quả một phần rõ
ràng. Member/lead/media write contract đã được promote lên staging: exact
command, revision/CAS, idempotent replay/conflict, audit chuyên biệt; member có
owner/self-account safety, lead ghi `lead_events`, media ghép D1 audit với R2
compensation/reference guard. Public staging smoke/deep QA đã pass; P5 vẫn chưa
hoàn tất vì batch các domain còn lại, browser/admin staging evidence và full
operational acceptance còn mở.

**Working-tree slice 2026-08-31:** product/variant single-row writes đã có
exact body, strict numeric validation, optimistic revision, request-id replay,
atomic D1 coupling giữa row/meta/tier/audit và focused regression. Admin suite
hiện đạt `158/158`; SQLite in-memory chạy đủ migration `0001–0016` qua create,
update, archive, tier rollback, member/lead/media write và R2 compensation.
Members/leads/media đã có exact command, revision/CAS, idempotency và audit;
staging migration/upload đã pass, còn runtime admin read-back và role/browser
acceptance là điều kiện đóng lát này.

**Mục tiêu:** admin có toàn quyền vận hành trong phạm vi Lean V1, không hy sinh
tính rõ ràng cho người mới.

**Công việc:**

1. Tổ chức lại AdminShell thành các nhóm dễ hiểu: Chỉnh sửa website,
   Catalog, Nội dung, Yêu cầu khách hàng, Cài đặt, Tài khoản & quyền.
2. Chuẩn hóa table contract: search, filter, sort, pagination, select all trong
   phạm vi trang, trạng thái, empty/loading/error/stale.
3. Bổ sung batch action theo từng domain: product import và service archive đã có
   contract/UI; tiếp tục sản phẩm/danh mục còn thiếu, tin, media,
   navigation/page nếu contract cho phép.
4. Batch response phải trả được thành công/thất bại theo item, reason an toàn,
   request id/idempotency và audit; không dùng một thông báo đã xong cho kết quả
   một phần.
5. Owner-only cho member/role; sales manager tập trung lead; viewer read-only.
6. Nút nâng cao/destructive đặt trong menu có cảnh báo; thao tác thường ngày vẫn
   hiển thị bằng ngôn ngữ đơn giản.

**Test bắt buộc:**

- role/capability matrix cho từng route và từng batch action;
- batch 0/1/n/maximum items, duplicate selection, stale item và partial failure;
- pagination bounded theo contract (mặc định 50, hard max 100 nếu không có quy
  định hẹp hơn);
- D1 atomicity + audit coupling;
- R2 reference integrity;
- browser table density, keyboard multi-select và mobile fallback;
- error message không lộ SQL, token hay stack trace.

**Đạt khi:** owner làm được tất cả nghiệp vụ approved; role khác không vượt quyền;
người mới tìm được việc cần làm trong vài bước; batch không gây thay đổi âm thầm.

### P6 — Bản đầy đủ: hardening, vận hành và production gate

**Mục tiêu:** biến MVP thành hệ thống có thể vận hành lâu dài, không mở rộng sang
những domain Lean V1 chưa phê duyệt.

**Checkpoint 2026-08-31:** đã có lát audit/history read-only owner-only tại
`/admin/audit` và `/api/admin/audit`, tổng hợp an toàn các audit table đã
được migrate, có bounded search/pagination và không trả metadata payload. P6
chưa đóng vì browser/admin staging, consistency audit, runbook và production
acceptance còn mở.

**Runtime update 2026-08-30:** staging version
`91f79c65-a116-4865-b906-6467929c0f9b` đã được promotion 100%; admin audit
hostname trả HTTP 200 và hiển thị 93 sự kiện. Lát này đã xử lý giới hạn
compound SELECT của D1 bằng nested union và có regression test. Đây chỉ là
evidence đóng cho audit/runtime slice, không thay thế browser role matrix,
production data, restore/rollback và các gate P6 còn mở.

**Runtime update 2026-08-31:** version staging
`c2d91d94-6737-447d-88b7-991f9808ba3f` đã được upload và promotion 100%; version
`d9caf3ef-e212-45ee-bd26-f37450ed2928` là rollback point. Public route/API/cart
smoke sau promotion pass; bản này chứa bounded JSON admin writes và hard bound
collection reads trên nền category bulk archive/accessibility hardening trước
đó. Preview `workers.dev` vẫn bị Access bảo vệ nên không ghi nhận preview đó là
public route pass; active public staging đã được kiểm tra thực tế. Tab browser
mới không có Access session nên admin host chỉ chứng minh được boundary redirect;
role matrix, focus/reduced-motion read-back và screenshot admin bằng identity
thật vẫn mở.

**Runtime update 2026-08-31 (catalog contract):** version staging
`8eb11c5e-f7bc-4a2f-a37f-2949a3d03541` đã được upload và promotion 100%; version
`c2d91d94-6737-447d-88b7-991f9808ba3f` là rollback point. Product/variant
single-row create/update/soft-archive hiện dùng exact request envelope,
revision guard, idempotent replay/conflict và atomic D1 batch cho tier/meta/audit;
SQLite migration verification, full `npm run check` (`136/136` admin) và deep
staging QA đều pass. Admin host không có Access identity vẫn redirect 302, nên
role matrix, authenticated browser QA và admin write/read-back chưa được đánh
đồng là đã đạt.

**Runtime update 2026-08-31 (member/lead/media contract):** version staging
`0d1e14c1-ec4d-47db-b0e2-4275f246f919` đã được upload và promotion 100%; version
`8eb11c5e-f7bc-4a2f-a37f-2949a3d03541` là rollback point. Migrations
`0013–0016` đã apply trên D1 staging và không còn pending; public route smoke,
responsive deep QA và local `npm run check` (`157/157` admin) đều pass. Preview
workers.dev và admin hostname vẫn chịu Access khi không có identity hợp lệ; vì
vậy runtime write/read-back member/lead/media, role matrix và browser admin
desktop/mobile/keyboard/focus/reduced-motion vẫn chưa được đánh dấu đạt.

**Runtime update 2026-08-31 (authenticated staging browser):** version staging
`a22e9ecb-e1f6-4966-b96b-e2883d138fb1` đã được upload và promotion 100%; version
`0d1e14c1-ec4d-47db-b0e2-4275f246f919` là rollback point. Bản này chứa fix
`d4383df` cho dòng mẫu CSV không tạo page-level horizontal overflow. Với actor
`public-demo` ở chế độ staging được cấp sẵn, browser read-only đã đi qua đủ 10
màn hình admin; `/admin/audit` đọc 20 dòng đầu trong tổng 93 event, product editor
đọc lại media asset và không có alert/console error/warning. Mobile 390×844 pass
no-overflow cho 10/10 route, menu mobile mở đúng `aria-expanded=true`.
`public-demo` là actor demo của staging, không thay thế bằng chứng Access identity
thật hoặc role matrix owner/content_manager/catalog_manager/sales_manager/viewer;
mọi write/read-back mutation và reduced-motion/focus evidence vẫn giữ là gate mở.

**Runtime update 2026-08-31 (storefront motion follow-up):** version staging
`ec0522c7-2840-4118-a7fb-0740c5d7c91e` đã được promotion 100%; version
`a5534149-5af4-415b-8e2d-947a0a995016` là rollback point. Browser runtime xác
minh slider dots hiển thị và thao tác `Nội dung 2` đổi slide thành công, không có
console error/warning. Đây là acceptance cho lát motion/a11y storefront; không
thay thế Access identity thật, role matrix hoặc production gates.

**Runtime update 2026-08-31 (footer settings):** version staging
`cd4a973e-6fde-4538-b66b-04d3fadbb02d` đã được promotion 100%; version
`ec0522c7-2840-4118-a7fb-0740c5d7c91e` là rollback point. Published footer
description/address/copyright đã được browser đọc lại từ DOM sau deploy; dữ liệu
được escape an toàn và console không có error/warning. Gate Access thật, role
matrix và production vẫn chưa bị đánh dấu đạt.

Public staging smoke sau cùng pass năm route chính (`/`, `/san-pham/`, `/tin-tuc/`,
`/gui-yeu-cau/`, `/thue-gia-cong/`); public host không render admin control và
không có console error/warning.

**Runtime update 2026-08-31 (Access lock):** commit `41f65eb` và version
`11eb20a9-69c8-4dbd-884e-b65aa31d2d93` đã tắt public-demo trên staging admin;
browser không có identity hiện nhận đúng trang yêu cầu Cloudflare Access, trong
khi 5 route storefront public vẫn pass HTTP 200 và không render admin control.
Đây là boundary evidence; role matrix, authenticated write/read-back và
production gate chỉ được đánh dấu sau khi đăng nhập Access thật.

**Công việc:**

- audit/history/revision hiển thị đủ để biết ai đổi gì, lúc nào, từ bản nào;
- rollback hoặc khôi phục theo contract nếu nghiệp vụ đã được phê duyệt;
- consistency audit giữa region registry, setting/page/news/catalog source;
- accessibility WCAG 2.2 AA: keyboard, focus, labels, error association,
  non-color status, touch target, reduced motion;
- performance: không làm public tải admin JS/data; overlay lazy-load khi admin
  context hợp lệ; list có bound/pagination;
- visual regression ở viewport desktop/mobile; public/admin screenshot trước và
  sau;
- runbook backup, migration, rollback, incident và support cho người vận hành;
- staging promotion có rollback point; production acceptance riêng theo plan.

**Đạt khi:** mọi capability trong scope có evidence code + test + browser + audit;
staging acceptance xanh; production data/content đã được duyệt; chỉ khi đó mới
xem xét production promotion. Không đánh dấu đạt chỉ vì build thành công.

## 5. Ma trận test và lệnh kiểm tra

### 5.1 Lệnh local chuẩn

Chạy trong apps/giacong-lean-commerce:

~~~powershell
npm ci
npm run db:local:bootstrap
npx wrangler@4.115.0 d1 migrations apply giacong-vn-catalog --local
npx wrangler@4.115.0 d1 migrations list giacong-vn-catalog --local

npm run test:admin
npm run test:contact
npm run test:catalog
npm run test:service
npm run test:commerce
npm run test:listing
npm run test:detail
npm run lint
npm run typecheck
npm run build
npm run check
~~~

Không chạy npm ci khi dev server/worker đang giữ native module. Không chạy
mutation remote nếu phase chưa ghi rõ staging gate.

### 5.2 Ma trận evidence

| Lớp | Bằng chứng tối thiểu | Khi nào bắt buộc |
| --- | --- | --- |
| Input/domain | Node test cho normalization, bounds, unsafe URL/text | mọi field/API mới |
| Auth/admission | host, Access, same-origin, fail-closed test | mọi admin route/write |
| Permission | role × capability × action matrix | mọi nút/route/batch |
| Persistence | D1 query/update, version, atomic audit | mọi write |
| Draft/publish | draft không rò public, preview đúng, publish đúng | mọi nội dung public |
| Concurrency | stale version và retry/idempotency | mọi update/batch/upload |
| Media | MIME/size/path/checksum/reference guard | mọi media change |
| Browser | desktop, mobile, keyboard, focus, error/loading/empty | mọi UI admin |
| Visual | screenshot public trước/sau và admin overlay | mọi storefront edit |
| Runtime | staging Access + D1/R2 + published read-back | trước promotion phase |
| Regression | full npm run check, diff/GitNexus review | trước commit/merge |

### 5.3 Test file dự kiến

Chỉ tạo các file này khi phase tương ứng bắt đầu; không tạo placeholder cho đẹp:

- scripts/admin-visual-mode.test.mjs — P1;
- scripts/admin-visual-regions.test.mts — P2;
- scripts/admin-visual-news-media.test.mjs — P3 contextual/browser contract slice;
- scripts/admin-news-write-contract.test.mts — P3 news persistence contract đã có;
- scripts/admin-product-import.test.mts — P5 product import persistence contract;
- scripts/admin-product-batch.test.mts — P5 product archive batch contract và mock D1;
- scripts/admin-audit.test.mts — P6 audit/history bounds, source merge và owner-only contract;
- scripts/admin-service-batch.test.mts — P5 service archive batch contract và mock D1;
- scripts/admin-visual-pages-navigation.test.mjs — P4;
- scripts/admin-visual-bulk.test.mts — P5;
- browser/staging harness — P1 trở đi, đặt cạnh harness hiện có và ghi vào file
  map khi tên chính thức được chốt.

## 6. Definition of Ready

Một lát chỉ được bắt đầu khi tất cả câu hỏi sau có câu trả lời trong issue/PR:

- [ ] User journey cụ thể là gì? Người mới sẽ bấm gì đầu tiên?
- [ ] Region/route/domain nào nằm trong scope? Cái gì không làm?
- [ ] Source-of-truth là file/field/table/API nào?
- [ ] Read, write và publish capability nào được dùng?
- [ ] Draft, preview, published, dirty và stale hiển thị thế nào?
- [ ] Input bounds, URL/media safety và error envelope đã rõ chưa?
- [ ] Có cần migration không? Có backup/rollback và staging plan chưa?
- [ ] Test sẽ fail trước khi code ở đâu? Browser acceptance nào chứng minh UX?
- [ ] Có đụng symbol dùng chung không? Nếu có đã chạy GitNexus impact chưa?

## 7. Definition of Done

Một phase chỉ được đánh dấu hoàn thành khi:

- [ ] Mọi acceptance criterion của phase đã được kiểm từng dòng.
- [ ] Code dùng shared renderer/primitives, không tạo admin stack song song.
- [ ] UI có loading, error, empty, success và stale state phù hợp.
- [ ] Server re-read và validate dữ liệu; client không quyết định quyền hay tiền.
- [ ] Mọi write có auth, capability, same-origin, audit và concurrency behavior.
- [ ] Draft chưa publish không xuất hiện ở public.
- [ ] Batch có giới hạn, kết quả theo item và không tạo side effect trùng khi retry.
- [ ] Test mới và test hồi quy pass.
- [ ] npm run lint, npm run typecheck, npm run build pass với exit code 0.
- [ ] npm run check pass sau khi không còn dev server gây nhiễu.
- [ ] Browser staging pass desktop/mobile/keyboard/focus/reduced motion.
- [ ] Screenshot/DOM evidence đã kiểm tra public không có admin control.
- [ ] git diff --check pass; GitNexus detect_changes không có scope bất ngờ.
- [ ] Không có production mutation; nếu có migration staging thì có post-condition.
- [ ] File map, current state và handoff được cập nhật nếu route/API/schema thay đổi.

## 8. Quy trình cho mỗi lát code

~~~
Chốt contract
→ viết RED test
→ GitNexus impact cho symbol sẽ sửa
→ implement lát nhỏ nhất
→ test focused
→ browser/contract verify
→ full check phù hợp
→ review correctness/security/architecture/UX
→ detect_changes
→ commit nhỏ, rollback được
→ cập nhật roadmap + file map
~~~

- Không sửa function/class/method dùng chung trước khi chạy impact upstream.
- Cảnh báo owner trước khi tiếp tục nếu impact là HIGH/CRITICAL.
- Không trộn cleanup/refactor không liên quan vào feature slice.
- Tương lai code work dùng branch/worktree cô lập; không push nếu chưa được yêu
  cầu.
- Nếu phát hiện dead code mới, ghi rõ bằng chứng và phạm vi; không xóa hàng loạt
  chỉ vì tên có vẻ cũ.

## 9. Rủi ro và điều kiện dừng

| Rủi ro | Cách giảm | Dừng khi |
| --- | --- | --- |
| Captured HTML không có field structure | region registry + adapter từng vùng | chưa xác định source-of-truth |
| Draft/public lệch giữa domain | chuẩn hóa publish contract | public đọc nhầm draft |
| Bulk làm sai nhiều bản ghi | bound, per-item result, idempotency, audit | không biết chính xác item nào đổi |
| Quyền chỉ được kiểm ở UI | server capability ở từng API | request trái quyền vẫn ghi được |
| Admin JS ảnh hưởng public | route/context lazy boundary | public tải hoặc gọi admin surface |
| Người mới bị ngợp bởi full power | progressive disclosure + task labels | phải biết thuật ngữ kỹ thuật mới thao tác được |
| Staging/production bị nhầm | hostname guard + runbook + acceptance gate | command không phân biệt môi trường |
| Tài liệu drift khỏi code | cập nhật file map cùng PR | route/API/migration mới không có owner |

## 10. Quy tắc kết luận trạng thái

- **Đã xác minh:** có file/lệnh/evidence cụ thể.
- **Đang triển khai:** đã chốt scope nhưng chưa đủ DoD.
- **Bị chặn:** thiếu quyền, dữ liệu, contract hoặc môi trường; ghi blocker cụ thể.
- **Không thuộc scope:** trái Lean V1 hoặc chưa có product decision.

Không dùng các câu gần xong, chắc là pass hoặc đã hoàn hảo thay cho output
test, browser evidence và acceptance checklist.
