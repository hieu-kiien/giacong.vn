# Bản đồ file Giacong Visual Admin

**Trạng thái:** bản đồ ownership và source-of-truth
**Cập nhật:** 2026-09-01
**Roadmap:** ADMIN_VISUAL_ROADMAP.md

Mục tiêu của file này là trả lời nhanh bốn câu hỏi trước khi sửa code:

1. Nội dung đang được render ở đâu?
2. Dữ liệu canonical nằm ở đâu?
3. API/quyền/test nào bảo vệ nó?
4. Vùng đó đã editable hay chỉ là captured/static?

Không thêm file mới vào map chỉ vì đã nghĩ ra tên. File chỉ được đánh dấu “đã có”
khi tồn tại trong checkout; file “dự kiến” phải được tạo trong phase tương ứng.

**Checkpoint 2026-09-01:** P1 host-gated admin context, P2 settings write
contract (per-setting + bulk publish), contextual editor MVP, P3 contextual
news-detail hand-off, P4 managed-page hand-off, P5 product bulk import UI và
product/service/category bulk archive contract đã có trong `master`. Bản
storefront motion/menu đã được review và tích hợp từ worktree riêng; fallback
gallery đã chấp nhận asset WebP. `qa:ux` là runner tracked để lặp lại audit
staging. Staging đang phục vụ version
`902b3a6e-732f-4de6-a9fc-429b6478d833`; rollback point là
`a1f71e85-113e-4559-9377-ebedc22b92e7`; owner thật `qtu1053@gmail.com` đã được
bootstrap vào D1 staging với role `owner` cấp cao nhất. `/admin/thanh-vien` đã
được browser xác nhận hiển thị tài khoản hiện tại, khóa self-demotion/self-
deactivation và mở được luồng `Thêm thành viên`.

Full gate gần nhất: focused session/UI `17/17`, admin `165/165`, contact
`104/104`, catalog `5/5`, catalog purchase UI `1/1`, service `3/3`, commerce
`63/63`, listing `4/4`, detail `29/29`, kèm lint, typecheck và build. Public UX
audit năm route pass; browser identity role matrix đầy đủ, write/read-back từng
domain và production gate vẫn chưa đóng.
Wrapper PowerShell giữ process sau khi đã in xong output nên phải dừng thủ công;
không dùng điều đó để thay thế cửa sổ release có exit code sạch.

Commit `566489d` bổ sung contract navigation: single save/publish và bulk publish
dùng request UUID, revision guard, idempotent replay/conflict; bulk dùng D1 batch
atomic, giới hạn 100 mục, kết quả stale theo id và audit chuyên biệt. Migration
`0017_navigation_bulk_publish_contract.sql` đã được verify qua baseline + toàn
bộ migration trên D1 local tạm và đã apply/verify trên D1 staging; production
chưa apply migration này.

Commit `8c509c5` đã nâng Next.js `16.3.4`, OpenNext Cloudflare `1.20.5`,
Wrangler `4.125.0`, loại `shadcn` CLI khỏi runtime dependency graph và giữ
Tailwind extension cần thiết trong source. `npm audit --omit=dev` và full
`npm audit` đều báo `0 vulnerabilities`; staging build/deploy và live `qa:ux`
đã chạy lại thành công trên version `ecda5cee-8791-4290-8505-56acbd5f4d5f`.

Commit `650d10f` đã thay hướng dẫn kỹ thuật trên màn hình Access-blocked bằng
ngôn ngữ đời thường cho người ít chuyên môn, có regression test trong
`admin-ui-system.test.mjs`; không thay đổi admission boundary hay quyền server.

Commit `bbcbfba` áp dụng cùng nguyên tắc plain-language cho các trạng thái dùng
chung của admin: lỗi dữ liệu, độ sẵn sàng, ghi chú không có dữ liệu mẫu và
footer shell. Commit `60ac85e` bổ sung `memberId` vào admin session để UI nhận
diện current account đúng cả khi Access `sub` khác D1 `access_subject`; không
thay đổi quyền server hay schema. Public `qa:ux` sau deploy pass 5/5 route;
role matrix nhiều identity và admin write/read-back vẫn là gate riêng.

Repo chính không có GIF/video runtime bắt buộc: motion hiện dùng CSS/HTML và
asset WebP phù hợp. Worktree motion riêng vẫn được giữ nguyên, không reset hoặc
xóa các artifact người dùng đang làm.

**Catalog contract slice 2026-08-31:** product/variant single-row
create/update/soft-archive đã chuyển sang exact command envelope với
`requestId`, optimistic `revision`, idempotent replay, D1 batch coupling cho
meta/tier/audit và strict numeric types. Focused catalog test, full admin
regression `136/136`, SQLite chạy đủ migration `0001–0012`, lint và typecheck
đã pass; lát này đã được promote lên staging và public runtime smoke/deep QA
đều pass; runtime admin read-back bằng Access identity thật vẫn còn mở.
Tuy nhiên `admin-staging.kienhieu.id.vn` vẫn trả Cloudflare Access login khi
không có phiên hợp lệ, vì vậy admin read-back/browser evidence cho context thật
và frontend motion lúc đó còn ở worktree riêng; bản motion đã được review và
tích hợp vào `master` ở checkpoint 2026-09-01. Không coi local Next dev là bằng
chứng Access.
Commit `cf3856c` đã bổ sung stale-race regression cho service batch. Category
archive hiện dùng `GET /api/admin/categories/batch` để lấy snapshot revision và
`POST /api/admin/categories/batch` cho soft-deactivate atomic tối đa 100 item;
không còn hard-delete category. `AdminModal`
hiện có focus trap, restore focus và confirm message liên kết qua
`aria-describedby`; contract test đã pass, còn browser runtime evidence là gate
QA riêng. Commit `f7dcc52` bổ sung pause cho carousel khi hover/focus hoặc
reduced-motion. Repo chính không có GIF/video runtime; bản motion dùng CSS/HTML
và asset WebP, đã được review rồi tích hợp vào `master` ở checkpoint hiện tại.
Lát P6 đầu tiên đã thêm audit/history read-only owner-only ở `/admin/audit` và
`/api/admin/audit`, tổng hợp các audit table hiện có mà không trả metadata payload;
browser/admin staging read-back vẫn là gate riêng.

**Working-tree operations slice 2026-08-31:** members, leads và product/site media
đã có exact write command, UUID `requestId`, optimistic revision/CAS,
idempotent replay/conflict và audit chuyên biệt. Member write còn giữ guard
owner cuối cùng/tự khóa tài khoản; lead write ghi `lead_events` và marker
request chống stale batch; media write
ghép D1 audit với R2 compensation/reference guard. Migrations `0013–0016` đã
chạy thành công trên SQLite local; marker lead chống stale batch đã được kiểm
chứng; lát này sau đó đã được hợp nhất với motion và full gate hiện là
`162/162` admin, cùng các suite được ghi ở checkpoint hiện tại.
Migrations đã apply trên local và staging; version
`0d1e14c1-ec4d-47db-b0e2-4275f246f919` đã được promote 100%, public smoke/deep
QA sau promotion pass. Runtime write/read-back member/lead/media bằng Access
identity thật và browser admin vẫn là gate riêng; worktree frontend motion đã
được giữ nguyên và bản đã review đã tích hợp vào `master`.

**Checkpoint P3 2026-08-29:** contract backend news/media đã vào `master`: news
có snapshot `draft_*` và `published_*`, publish/unpublish riêng, batch status tối
đa 100 item, optimistic revision, request-id idempotency và audit D1; media
upload có bounded multipart, giới hạn file 8 MiB và kiểm tra magic bytes
JPEG/PNG/WebP. Storefront news detail hiện có contextual action chỉ qua
`AdminVisualMode` khi session ready và role owner/content_manager; action mở
`/admin/tin-tuc?edit=<id>`, còn admin page đọc lại bài qua API canonical. P3
chưa hoàn tất: admin browser desktop/mobile/keyboard, staging read-back và media
runtime acceptance còn mở.

## 1. Luật ownership

| Khu vực | Trách nhiệm | Không làm ở đây |
| --- | --- | --- |
| src/app/(storefront)/ | route public và shared storefront entry | không chứa business mutation riêng cho admin |
| src/components/site/ | renderer/storefront shell dùng chung | không nhân đôi component chỉ vì admin |
| src/components/admin/ | AdminShell, form, table, overlay, feedback | không bypass server contract |
| src/lib/ | domain model, normalization, auth, permissions, data adapter | không đọc secret ở client |
| src/app/api/admin/ | HTTP boundary và server admission | không tin capability từ request body |
| migrations/ | schema thay đổi có version | không tạo schema runtime |
| scripts/*.test.* | contract/regression test | không thay cho staging runtime QA |
| docs/ | decision, contract, map, runbook | không dùng lịch sử Bagisto làm scope mới |

## 2. Entry points và renderer

| Concern | File canonical hiện tại | Trạng thái | Phase đụng tới |
| --- | --- | --- | --- |
| Home route | src/app/(storefront)/page.tsx | đã có; đọc published settings/page rồi chọn managed blocks hoặc captured home | P1–P4 |
| Nested captured route | src/app/(storefront)/[...slug]/page.tsx | đã có; shared shell + managed page hoặc captured fallback; managed branch truyền pageKey cho contextual editor hand-off | P1–P4 |
| Storefront layout | src/app/(storefront)/layout.tsx | đã có; owner của boundary chung public/storefront | P1 |
| Captured home render | src/components/site/CapturedHomePage.tsx | đã có; HTML string + settings mapping giới hạn | P2, P4 |
| Captured page render | src/components/CapturedPage.tsx | đã có; captured markup fallback | P1–P4 |
| Header/footer shell | src/components/site/CapturedStorefrontShell.tsx | đã có; áp settings/navigation vào captured shell | P2, P4 |
| Safe block render | src/components/site/PageBlocks.tsx | đã có; renderer dùng chung với page builder preview; nhận pageKey tùy chọn để gắn action trên managed page | P4 |
| News frame | src/components/CapturedNewsFrame.tsx | đã có; cần adapter nếu inline news được bật | P3 |
| Request cart | src/components/request-cart/ | đã có; không đưa vào visual admin scope | không mở rộng |
| Public nav interactions | src/components/site/storefront-navigation.ts, src/components/storefront/ | đã có; public behavior phải giữ nguyên | P1–P4 |

### Quy tắc renderer

- src/components/site/ là canonical shared render path.
- Admin overlay/contextual control đặt ở lớp admin, không copy toàn bộ markup.
- Captured markup chỉ editable ở nơi region registry chứng minh được mapping.
- Nếu một section cần chỉnh thường xuyên nhưng không thể map an toàn, chuyển section
  đó sang PageBlocks/structured source trong phase riêng; không cho edit HTML tùy ý.

## 3. Domain model và source-of-truth

| Domain | Read model | Write/normalization | Published behavior | Capability chính | Test hiện có |
| --- | --- | --- | --- | --- | --- |
| Brand/contact/hero | src/lib/site-settings.ts, src/lib/site-markup.ts, src/lib/admin-request.ts | site settings API + bounded JSON + input validation | published_value và fallback default | content.read/write/publish | scripts/site-settings.test.mts, scripts/site-settings-write-contract.test.mts, scripts/admin-request.test.mts, scripts/site-markup-hero.test.mjs |
| Managed pages | src/lib/site-pages.ts, src/lib/page-builder.ts | page API + safe block parser | published blocks chỉ khi enabled/published | pages.read/write/publish | scripts/site-pages.test.mts |
| Primary/footer navigation | src/lib/site-navigation.ts | navigation API + trusted link normalization | published items; footer renderer cần xác minh riêng | navigation.read/write/publish | scripts/site-pages.test.mts có contract liên quan |
| News | src/lib/news-public.ts, src/lib/admin-news-input.ts, src/lib/admin-data.ts | news API + draft input + publish/batch contract | public chỉ đọc `published_*`; detail trả published id cho contextual hand-off; draft chỉnh riêng, publish explicit; contract P3 đã có trong master | news.read/write và content publish theo quyết định | scripts/admin-news.test.mts, scripts/admin-news-write-contract.test.mts, scripts/admin-visual-news-media.test.mjs |
| Media | src/lib/media-data.ts, src/lib/site-media-data.ts, src/lib/media-input.ts | media API/R2 guard + bounded multipart + signature validation; exact requestId/revision/CAS, replay/conflict và specialized audit | reference phải còn hợp lệ; JPEG/PNG/WebP tối đa 8 MiB; D1 audit đi cùng mutation và R2 có compensation | media.read/write | scripts/media-contract.test.mts, scripts/admin-media-write.test.mts |
| Product/category/variant | src/lib/admin-product-input.ts, src/lib/admin-product-command.ts, src/lib/admin-variant-input.ts, src/lib/admin-variant-command.ts, src/lib/admin-catalog-write.ts, src/lib/admin-product-batch.ts, src/lib/admin-category-batch.ts và catalog adapters | admin API + exact command parser + D1 canonical rules; single-row/bulk import/archive contract | product/service public read theo trạng thái; import luôn tạo draft/inactive; single-row và bulk archive là soft archive có revision, audit và idempotency; category archive bảo toàn dữ liệu và tăng revision | catalog.read/write/publish | scripts/admin-catalog-write.test.mts, scripts/admin-categories.test.mts, scripts/admin-category-batch.test.mts, scripts/admin-product-import.test.mts, scripts/admin-product-batch.test.mts, catalog/detail suites |
| Service | src/lib/admin-service-input.ts, src/lib/admin-service-batch.ts, service data adapters | service API + additive revision snapshot/batch contract + D1 | active/published service read | services.read/write | scripts/admin-service-input.test.mts, scripts/admin-service-batch.test.mts, scripts/service-contract.test.mts |
| Leads | src/lib/admin-data.ts, src/lib/admin-lead-command.ts, src/lib/admin-lead-write.ts, lead API | exact status command + revision/CAS, idempotent replay/conflict, `lead_events` và specialized audit; Google Sheet queue vẫn là adapter riêng | back office only | leads.read/write | contact/lead queue suites, scripts/admin-member-lead-write.test.mts |
| Admin members | src/lib/admin-members.ts, src/lib/admin-members-input.ts, src/lib/admin-member-command.ts, src/lib/admin-member-write.ts | owner-only exact command + D1 atomic write, revision/CAS, idempotency/audit; bảo vệ owner cuối cùng và self-account | internal control plane only | members.read/write | scripts/admin-members.test.mts, scripts/admin-member-lead-write.test.mts |

## 4. Admin UI hiện tại và vai trò tương lai

| Surface | File canonical | Vai trò hiện tại | Vai trò trong target |
| --- | --- | --- | --- |
| Admin shell | src/components/admin/AdminShell.tsx | sidebar/topbar, session, nav filter | giữ làm control plane; thêm đường vào storefront edit |
| Primitives | src/components/admin/AdminPrimitives.tsx | heading, state, table-level UI | dùng chung cho back office và drawer đặc biệt |
| Dialog/field/toast | src/components/admin/AdminDialog.tsx, AdminField.tsx, AdminToast.tsx | feedback, focus-trapped modal/confirm và form guard | tái sử dụng cho contextual editor; browser focus evidence còn mở |
| Media | AdminMediaPanel.tsx, AdminMediaPickerModal.tsx | media list/picker | mở từ storefront khi capability cho phép |
| Page builder | AdminPageBuilder.tsx | safe blocks, draft/preview/publish; chọn page theo query `?page=` từ contextual hand-off | vẫn là advanced editor/back office; inline là shortcut |
| Navigation | AdminNavigationManager.tsx | primary menu manager | giữ full editor; contextual edit gọi vào đúng item |
| Members | AdminMembersManager.tsx | owner quản lý admin roles | trang đặc biệt, không inline trên storefront |
| Audit/history | src/app/admin/audit/page.tsx, src/app/api/admin/audit/route.ts, src/lib/admin-audit.ts | owner-only timeline read-only, filter/pagination, revision/request id | trang đặc biệt P6; không có rollback nếu chưa được phê duyệt |
| Category/variant | AdminCategoryPanel.tsx, AdminVariantPanel.tsx | catalog sub-editors | dùng trong catalog/bulk flow, không nhồi hết vào homepage |
| Product bulk import/archive | AdminProductImportPanel.tsx, src/app/admin/san-pham/page.tsx, src/lib/admin-product-batch.ts | chọn CSV, preview lỗi, import atomic; chọn sản phẩm đang hiển thị, snapshot revision, xác nhận và soft-archive batch | giữ ở catalog control plane; viewer read-only; không biến thành inline editor |
| Storefront admin context | AdminVisualMode.tsx, AdminNewsContextualAction.tsx, AdminPageContextualAction.tsx, AdminNewsContextualAction.module.css | host/session gate, context role và contextual news/page actions; trạng thái loading/blocked/unavailable/ready | chỉ hiện action trên exact admin hostname sau session ready; public không fetch admin session và không render control |
| Contextual settings editor | AdminVisualEditor.tsx, AdminVisualEditor.module.css | toolbar nhỏ cho brand/hero, draft/preview/publish và role-aware feedback | MVP cho region đã map; preview hiện là draft card có nhãn rõ ràng; news/page hand-off dùng editor back office hiện có |
| Admin CSS | src/styles/admin.css | styling control plane | giữ token/brand language, không tạo dashboard stack mới |

### Visual layer: file đã có và file chưa cần tạo

Vertical slice hiện tại chứng minh chưa cần tách thành nhiều abstraction:

| File canonical | Trách nhiệm | Không được làm |
| --- | --- | --- |
| src/components/admin/AdminVisualMode.tsx | context/entry state cho admin storefront | không tự cấp quyền |
| src/components/admin/AdminVisualEditor.tsx | toolbar/drawer và flow brand/home settings | không ghi D1/R2 trực tiếp |
| src/components/admin/AdminVisualEditor.module.css | layout, focus, mobile và reduced-motion cho editor | không tạo token riêng ngoài hệ thống |
| src/components/admin/AdminNewsContextualAction.tsx, AdminPageContextualAction.tsx | link contextual theo session context tới editor canonical | không tự fetch session, không ghi dữ liệu, không hiện trên public context |
| src/lib/admin-visual-contract.ts | exact host gate và session-ready contract | không quyết định capability server |

Các file `AdminEditableRegion.tsx`, `AdminVisualActions.tsx` và
`admin-visual-regions.ts` chưa tồn tại và chưa được tạo: chỉ mở chúng khi có
use case thứ ba chứng minh editor hiện tại không còn đủ đơn giản.

## 5. API và server boundary

### Existing admin routes

| Nhóm | Routes canonical | Phase |
| --- | --- | --- |
| Session | /api/admin/session | P1 |
| Dashboard | /api/admin/dashboard | P5 |
| Settings | /api/admin/site-settings, /api/admin/site-settings/publish, /api/admin/site-settings/publish-all, /api/admin/site-settings/media | P2; per-setting và bulk publish có requestId, stale, idempotency và audit batch; contextual editor đã tích hợp, staging/admin read-back còn mở |
| Pages | /api/admin/pages, /api/admin/pages/[pageKey], /api/admin/pages/[pageKey]/publish | P4; contextual hand-off đã nối tới page builder, API contract không đổi |
| Navigation | /api/admin/navigation, /api/admin/navigation/[id], /publish, /publish-all | P4; single save/publish có exact requestId + revision/CAS + idempotent audit; bulk tối đa 100, D1 atomic, stale theo item và replay; migration `0017` đã có trong master và staging, browser write/read-back còn mở |
| News | /api/admin/news, /api/admin/news/[id], /api/admin/news/[id]/publish, /api/admin/news/batch | P3; draft save, explicit publish/unpublish, batch status và contextual deep-link đã có; browser/admin staging read-back còn mở |
| Media | /api/admin/media, /api/admin/media/[id], /api/admin/media/cleanup | P3/P5; upload/alt/delete đã exact requestId + revision/CAS + audit/R2 guard; cleanup vẫn là recovery path bounded riêng |
| Catalog | /api/admin/categories, /api/admin/categories/[id], /api/admin/categories/batch, /products, /products/[id], /products/batch, /products/[id]/variants, /products/[id]/variants/[variantId], /api/admin/products/import | P5; bulk import tối đa 50 dòng, product/category archive tối đa 100 item; single-row product/variant create/update/archive và bulk contract đều revision-aware/atomic/idempotent/audited; category/product/variant action là soft archive, không hard-delete; contract đã có trong master và staging, còn browser/admin Access read-back |
| Services | /api/admin/services, /api/admin/services/[id], /api/admin/services/batch | P5; batch archive có snapshot revision riêng, tối đa 100 item, stale skip, atomic audit/idempotency; browser/staging còn mở |
| Leads | /api/admin/leads, /api/admin/leads/[id] | P5, special page; status mutation dùng exact requestId/revision/CAS/idempotency/audit |
| Members | /api/admin/members, /api/admin/members/[id] | P5, special page; create/update dùng exact requestId/revision/CAS/idempotency/audit và owner safety |
| Audit | /api/admin/audit | P6; owner-only, GET read-only, bounded filter/pagination, gom audit table tùy theo migration đã có |

### API rule for new visual actions

Ưu tiên gọi API canonical hiện có. Chỉ mở route mới khi action không thể biểu đạt
bằng contract hiện tại; route mới phải có:

- exact host/admission và same-origin mutation;
- capability rõ ràng;
- body/collection limit;
- server re-read + validation;
- version/stale behavior;
- audit/idempotency;
- focused contract test và staging evidence.

Không tạo API visual admin riêng chỉ để bọc lại một API đã có, trừ khi nó thực
sự giải quyết orchestration mà client không nên làm.

## 6. Migration và Cloudflare files

| File/khu vực | Vai trò | Rule |
| --- | --- | --- |
| migrations/0001_admin_operations.sql | admin operations/lead foundation | current schema foundation |
| migrations/0004_admin_foundation.sql | revisions/audit foundation | không sửa ngược migration đã apply |
| migrations/0004_site_settings.sql | settings draft/published | dùng cho P2 |
| migrations/0007_news_posts.sql | news storage | P3 cần đánh giá semantics |
| migrations/0009_admin_control_plane.sql | pages/navigation/member revision | P4/P5 |
| migrations/0010_site_settings_write_contract.sql | settings request id, audit coupling và `last_request_id` | P2; phải apply local/staging trước runtime write |
| migrations/0011_site_settings_bulk_publish.sql | bulk publish audit envelope và liên kết audit từng setting | P2; phải apply local/staging trước bulk write |
| migrations/0012_news_draft_publish_contract.sql | news draft/published snapshots, news audit và bulk audit | P3; phải apply local/staging trước news write |
| migrations/0013_admin_member_write_contract.sql | member request idempotency và specialized audit | P5; phải apply local/staging trước member write |
| migrations/0014_admin_lead_write_contract.sql | lead revision và specialized audit | P5; phải apply local/staging trước lead status write |
| migrations/0015_media_write_contract.sql | media/site-media revision, request idempotency và specialized audit | P3/P5; phải apply local/staging trước media write |
| migrations/0016_admin_lead_request_marker.sql | lead request marker để audit/event stale-safe trong D1 batch | P5; phải apply local/staging trước lead status write |
| migrations/0017_navigation_bulk_publish_contract.sql | navigation last-request marker, single-item audit và bulk publish envelope | P4/P5; đã verify local và staging, production gate riêng |
| wrangler.jsonc | Worker/env/routes/D1/R2 | staging trước, production gate |
| custom-worker.ts, open-next.config.ts | Cloudflare/OpenNext runtime | không đổi chỉ để shortcut local |
| .env.example, .nvmrc, package-lock.json | local reproducibility | không commit secret |

Migration mới (ví dụ cho unified news draft/publish) chỉ được đặt tên sau khi
schema gap đã được chứng minh bằng test/contract. Không tự tạo một migration
admin_visual tổng hợp tất cả domain.

## 7. Region registry dự kiến

Đây là bản đồ sản phẩm, không phải danh sách cho phép edit vô điều kiện.

| regionKey | Visible surface | Canonical source | Quyền | Trạng thái hiện tại | Mục tiêu |
| --- | --- | --- | --- | --- | --- |
| global.brand | logo, brand name | site settings + captured shell | content write/publish | partial mapping | P2 |
| global.contact | phone, email, Zalo, Messenger | site settings + markup adapter | content write/publish | partial mapping | P2 |
| home.hero | eyebrow, title, desc, image, CTA | site settings/captured home | content write/publish | partial mapping | P2 |
| home.about | about title/description | site settings + captured home | content write/publish | partial mapping | P2/P4 |
| home.services | service cards/links | services/catalog source hoặc page blocks | services/catalog/pages | source cần chốt | P4/P5 |
| home.benefits | benefit cards | captured/static hiện tại | chưa gán | chưa editable | P4 nếu migrate |
| home.testimonials | testimonial content | captured/static hiện tại | chưa gán | chưa editable | ngoài MVP nếu chưa có source |
| global.primaryNavigation | desktop/mobile menu | site navigation | navigation write/publish | supported | P4 |
| global.footer | footer links/copy | site settings/navigation/captured footer | content/navigation | model/render cần audit | P4 |
| news.list | cards/listing | news posts | news write + publish contract | structured public/admin | P3 |
| news.detail | title/excerpt/body/cover + contextual edit action trên admin host | news posts; published id cho hand-off | news write + publish contract | structured public/admin; hand-off code đã có, runtime evidence còn mở | P3 |
| catalog.product | product card/detail data | D1 catalog | catalog write/publish | structured | P5 |
| service.detail | service copy/media | D1 services/R2 | services write | structured | P5 |
| page.blocks | managed sections + contextual edit action trên admin host | site pages/PageBlocks | pages write/publish | safe builder và deep-link hand-off đã có, browser evidence còn mở | P4 |
| ops.leads | request inbox | D1 + Sheet queue | leads read/write | back office only | P5 |
| ops.members | internal admin accounts/roles | D1 admin_members | owner only | back office only | P5 |
| ops.audit | change history | audit/revision tables | owner/approved read | special page only if needed | P6 |

### Điều kiện để chuyển một region sang editable

Region phải có:

1. stable key;
2. source-of-truth duy nhất hoặc quy tắc ưu tiên rõ;
3. editor input type và validation;
4. capability read/write/publish;
5. server endpoint canonical;
6. draft/public test;
7. browser acceptance và screenshot;
8. fallback an toàn khi row/asset không tồn tại.

## 8. Trang đặc biệt và back office

Không tạo trang đặc biệt theo cảm tính. Chỉ dùng khi task cần bảng, workflow hoặc
khối lượng mà contextual UI làm khó hiểu.

| Trang | Vì sao cần | Có thể giữ/điều chỉnh |
| --- | --- | --- |
| /admin | dashboard và health/data readiness | giữ, đổi tên/nhóm cho dễ hiểu |
| /admin/san-pham | catalog, variants, batch | giữ, bổ sung bulk theo contract |
| /admin/dich-vu | service catalog/media | giữ |
| /admin/tin-tuc | viết, lọc, publish nhiều bài | giữ, chuẩn hóa draft/publish |
| /admin/yeu-cau | inbox/status/lead workflow | bắt buộc back office |
| /admin/noi-dung | global settings/brand/SEO | giữ làm advanced editor |
| /admin/thiet-ke | blocks/sections/page preview | giữ làm advanced editor |
| /admin/dieu-huong | menu reorder/publish | giữ |
| /admin/thanh-vien | internal roles/members | owner-only, không phải customer account |
| Audit/rollback | chỉ tạo nếu history workflow cần UI | P6, không tự thêm sớm |

## 9. Test ownership map

| Test file hiện có | Bảo vệ |
| --- | --- |
| scripts/admin-access.test.mts | admission boundary |
| scripts/admin-access-source-contract.test.mjs | source contract không lệch |
| scripts/admin-session.test.mts | session/role/error mapping |
| scripts/admin-ui-system.test.mjs | dialog/field/toast/AdminShell contract |
| scripts/site-settings.test.mts | settings draft/publish/version/role |
| scripts/site-pages.test.mts | page blocks/publish/navigation contract |
| scripts/admin-news.test.mts | news payload/public constraints |
| scripts/admin-news-write-contract.test.mts | news migration, draft/public isolation, revision, idempotency, publish/batch audit |
| scripts/admin-product-import.test.mts | product import parser, bounds, role guard, raw retry fingerprint và D1 atomic batch/audit |
| scripts/admin-product-batch.test.mts | product archive parser, D1 atomic batch, per-item stale skip, audit/replay, race rollback và role-aware UI guard |
| scripts/admin-audit.test.mts | audit query bounds, optional table merge, safe normalized entries và owner-only route/page contract |
| scripts/media-contract.test.mts | media references/deletion/credentials, bounded upload và magic bytes |
| scripts/admin-members.test.mts | internal role/member guard |
| scripts/admin-member-lead-write.test.mts | member/lead exact command, CAS, idempotent replay/conflict, audit và owner-safety write contract |
| scripts/admin-media-write.test.mts | media/site-media D1/R2 atomicity, replay/conflict, revision, audit và compensation |
| scripts/admin-categories.test.mts | category admin contract |
| scripts/admin-category-batch.test.mts | category snapshot/archive parser, D1 atomic soft-deactivate, stale/replay/idempotency và UI guard |
| scripts/admin-service-input.test.mts | service input safety |
| scripts/admin-visual-mode.test.mjs | P1 admin storefront context and public isolation |
| scripts/admin-product-import-ui.test.mjs | bulk import picker, preview, atomic result guard và retry request ID |
| scripts/admin-service-batch.test.mts | service batch parser, D1 atomic archive mock, per-item skip, audit/replay và UI guard |
| scripts/site-settings-write-contract.test.mts | settings idempotency, stale writes, publish isolation và UI request IDs |
| scripts/admin-request.test.mts | bounded JSON body cho toàn bộ admin JSON writes, content type, UUID request ID, exact-key checks và hard bound collection reads |
| scripts/site-settings-bulk-contract.test.mts | bulk publish batch, per-setting audit, stale skip, replay và route/migration contract |
| scripts/site-navigation-bulk-contract.test.mts | navigation single/bulk exact envelope, 100-item bound, stale result, atomic audit và replay |
| scripts/storefront-visual-contract.test.mjs | public visual/source boundaries |
| scripts/captured-route-runtime.test.mjs | captured asset/runtime path |
| scripts/development-port.test.mjs | reserved-port and local runner rules |
| scripts/qa-deep-staging.test.mjs | harness chờ streamed storefront content trước detail/keyboard assertions |

Test file mới chỉ được thêm cho gap thật, ưu tiên mở rộng test canonical trước khi
tạo test wrapper mới.

## 10. Cleanup ledger

### Đã dọn

- Xóa `src/components/admin/AdminCategoryPanel.tsx` ở workspace root sau khi
  xác minh root không có package/build entry point, không có caller và app đã có
  bản canonical tại `apps/giacong-lean-commerce/src/components/admin/AdminCategoryPanel.tsx`.
- Sửa README/SETUP dùng npm từ app directory thay vì pnpm --filter không có
  root workspace.
- Chuẩn hóa `apps/giacong-lean-commerce/package-lock.json` bằng npm 11 để tên
  package trong lock khớp `package.json`; không đổi phiên bản dependency.
- Thêm link tới roadmap và file map vào các index README.

### Không xóa

- apps/giacong-lean-commerce/node_modules/, .next/, .wrangler/,
  public/captured-pages/, next-env.d.ts, tsconfig.tsbuildinfo: generated/local
  và có thể tái tạo.
- .env, .env.local: cấu hình local; không đọc/ghi secret vào Git.
- .runtime/: có thể chứa backup/audit artifact; phải giữ trừ khi có lệnh xóa
  chính xác và đã kiểm kê.
- .gitnexus/: index phục vụ phân tích call graph và safety.
- design/, docs/research/, Bagisto-era docs: historical/reference; không dùng
  làm runtime nhưng cũng không xóa mù.

## 11. Khi nào phải cập nhật file map

Cập nhật file này trong cùng PR/commit khi có một trong các thay đổi:

- thêm/đổi route public hoặc admin;
- thêm API hoặc đổi response shape;
- thêm capability/role;
- thêm migration hoặc đổi source-of-truth;
- chuyển region từ captured/static sang editable;
- thêm test harness/browser evidence;
- xóa hoặc thay thế component canonical.

Nếu code và map không khớp, map phải được coi là stale và phase không được đánh
dấu hoàn thành cho tới khi sửa lại.
