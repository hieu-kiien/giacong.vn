# Bản đồ file Giacong Visual Admin

**Trạng thái:** bản đồ ownership và source-of-truth
**Cập nhật:** 2026-08-28
**Roadmap:** ADMIN_VISUAL_ROADMAP.md

Mục tiêu của file này là trả lời nhanh bốn câu hỏi trước khi sửa code:

1. Nội dung đang được render ở đâu?
2. Dữ liệu canonical nằm ở đâu?
3. API/quyền/test nào bảo vệ nó?
4. Vùng đó đã editable hay chỉ là captured/static?

Không thêm file mới vào map chỉ vì đã nghĩ ra tên. File chỉ được đánh dấu “đã có”
khi tồn tại trong checkout; file “dự kiến” phải được tạo trong phase tương ứng.

**Checkpoint 2026-08-28:** P1 host-gated admin context và P2 settings write
contract (per-setting + bulk publish) đã có trong `master` sau khi merge lane
bulk. P2 vẫn chưa đạt đầy đủ cho tới khi có contextual editor và
browser/staging evidence.

**Checkpoint P3 2026-08-28:** lane news/media đã khóa contract backend trong
worktree cô lập: news có snapshot `draft_*` và `published_*`, publish/unpublish
riêng, batch status tối đa 100 item, optimistic revision, request-id
idempotency và audit D1; media upload có bounded multipart, giới hạn file 8 MiB
và kiểm tra magic bytes JPEG/PNG/WebP. Đây chưa phải P3 hoàn tất: contextual
storefront adapter, browser evidence và staging runtime acceptance còn mở.

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
| Nested captured route | src/app/(storefront)/[...slug]/page.tsx | đã có; shared shell + managed page hoặc captured fallback | P1–P4 |
| Storefront layout | src/app/(storefront)/layout.tsx | đã có; owner của boundary chung public/storefront | P1 |
| Captured home render | src/components/site/CapturedHomePage.tsx | đã có; HTML string + settings mapping giới hạn | P2, P4 |
| Captured page render | src/components/CapturedPage.tsx | đã có; captured markup fallback | P1–P4 |
| Header/footer shell | src/components/site/CapturedStorefrontShell.tsx | đã có; áp settings/navigation vào captured shell | P2, P4 |
| Safe block render | src/components/site/PageBlocks.tsx | đã có; renderer dùng chung với page builder preview | P4 |
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
| News | src/lib/news-public.ts, src/lib/admin-news-input.ts, src/lib/admin-data.ts | news API + draft input + publish/batch contract | public chỉ đọc `published_*`; draft chỉnh riêng, publish explicit; contract P3 đã có trong lane | news.read/write và content publish theo quyết định | scripts/admin-news.test.mts, scripts/admin-news-write-contract.test.mts |
| Media | src/lib/media-data.ts, src/lib/site-media-data.ts, src/lib/media-input.ts | media API/R2 guard + bounded multipart + signature validation | reference phải còn hợp lệ; JPEG/PNG/WebP tối đa 8 MiB | media.read/write | scripts/media-contract.test.mts |
| Product/category/variant | src/lib/admin-product-input.ts, src/lib/admin-category-input.ts, src/lib/admin-variant-input.ts và catalog adapters | admin API + D1 canonical rules; bulk import contract | product/service public read theo trạng thái; import luôn tạo draft/inactive | catalog.read/write/publish | scripts/admin-categories.test.mts, scripts/admin-product-import.test.mts, catalog/detail suites |
| Service | src/lib/admin-service-input.ts, service data adapters | service API + D1 | active/published service read | services.read/write | scripts/admin-service-input.test.mts, scripts/service-contract.test.mts |
| Leads | src/lib/admin-data.ts, lead API | status transition + Google Sheet queue contract | back office only | leads.read/write | contact/lead queue suites |
| Admin members | src/lib/admin-members.ts, src/lib/admin-members-input.ts | owner-only API + D1 | internal control plane only | members.read/write | scripts/admin-members.test.mts |

## 4. Admin UI hiện tại và vai trò tương lai

| Surface | File canonical | Vai trò hiện tại | Vai trò trong target |
| --- | --- | --- | --- |
| Admin shell | src/components/admin/AdminShell.tsx | sidebar/topbar, session, nav filter | giữ làm control plane; thêm đường vào storefront edit |
| Primitives | src/components/admin/AdminPrimitives.tsx | heading, state, table-level UI | dùng chung cho back office và drawer đặc biệt |
| Dialog/field/toast | src/components/admin/AdminDialog.tsx, AdminField.tsx, AdminToast.tsx | feedback và form guard | tái sử dụng cho contextual editor |
| Media | AdminMediaPanel.tsx, AdminMediaPickerModal.tsx | media list/picker | mở từ storefront khi capability cho phép |
| Page builder | AdminPageBuilder.tsx | safe blocks, draft/preview/publish | vẫn là advanced editor/back office; inline là shortcut |
| Navigation | AdminNavigationManager.tsx | primary menu manager | giữ full editor; contextual edit gọi vào đúng item |
| Members | AdminMembersManager.tsx | owner quản lý admin roles | trang đặc biệt, không inline trên storefront |
| Category/variant | AdminCategoryPanel.tsx, AdminVariantPanel.tsx | catalog sub-editors | dùng trong catalog/bulk flow, không nhồi hết vào homepage |
| Admin CSS | src/styles/admin.css | styling control plane | giữ token/brand language, không tạo dashboard stack mới |

### File dự kiến cho visual layer

Chỉ tạo khi P1/P2 bắt đầu và sau khi contract được chốt:

| File dự kiến | Trách nhiệm | Không được làm |
| --- | --- | --- |
| src/components/admin/AdminVisualMode.tsx | context/entry state cho admin storefront | không tự cấp quyền |
| src/components/admin/AdminEditableRegion.tsx | outline, contextual action, keyboard/focus | không tự ghi D1/R2 |
| src/components/admin/AdminVisualActions.tsx | nút Sửa, Xem trước, Lưu nháp, Phát hành | không chứa domain validation lặp lại |
| src/lib/admin-visual-regions.ts | registry region → source/capability/editor | không map node HTML mơ hồ |
| src/lib/admin-visual-contract.ts | type/response/state contract nếu thật sự cần | không tạo abstraction trước use case thứ ba |

Tên trên là map dự kiến, không phải cam kết tạo đủ năm file. Nếu một file không
còn cần sau khi vertical slice chứng minh được design đơn giản hơn, xóa khỏi map.

## 5. API và server boundary

### Existing admin routes

| Nhóm | Routes canonical | Phase |
| --- | --- | --- |
| Session | /api/admin/session | P1 |
| Dashboard | /api/admin/dashboard | P5 |
| Settings | /api/admin/site-settings, /api/admin/site-settings/publish, /api/admin/site-settings/publish-all, /api/admin/site-settings/media | P2; per-setting và bulk publish đã có requestId, stale, idempotency và audit batch; contextual/browser/staging còn mở |
| Pages | /api/admin/pages, /api/admin/pages/[pageKey], /api/admin/pages/[pageKey]/publish | P4 |
| Navigation | /api/admin/navigation, /api/admin/navigation/[id], /publish, /publish-all | P4 |
| News | /api/admin/news, /api/admin/news/[id], /api/admin/news/[id]/publish, /api/admin/news/batch | P3; draft save, explicit publish/unpublish và batch status đã có; contextual/browser/staging còn mở |
| Media | /api/admin/media, /api/admin/media/[id], /api/admin/media/cleanup | P3/P5 |
| Catalog | /api/admin/categories, /products, /products/[id], variants routes, /api/admin/products/import | P5; bulk import backend tối đa 50 dòng, atomic/idempotent/audited đã có; UI/browser/staging còn mở |
| Services | /api/admin/services, /api/admin/services/[id] | P5 |
| Leads | /api/admin/leads, /api/admin/leads/[id] | P5, special page |
| Members | /api/admin/members, /api/admin/members/[id] | P5, special page |

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
| news.detail | title/excerpt/body/cover | news posts | news write + publish contract | structured public/admin | P3 |
| catalog.product | product card/detail data | D1 catalog | catalog write/publish | structured | P5 |
| service.detail | service copy/media | D1 services/R2 | services write | structured | P5 |
| page.blocks | managed sections | site pages/PageBlocks | pages write/publish | safe builder exists | P4 |
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
| scripts/media-contract.test.mts | media references/deletion/credentials, bounded upload và magic bytes |
| scripts/admin-members.test.mts | internal role/member guard |
| scripts/admin-categories.test.mts | category admin contract |
| scripts/admin-service-input.test.mts | service input safety |
| scripts/admin-visual-mode.test.mjs | P1 admin storefront context and public isolation |
| scripts/site-settings-write-contract.test.mts | settings idempotency, stale writes, publish isolation và UI request IDs |
| scripts/admin-request.test.mts | bounded JSON body, content type, UUID request ID và exact-key checks |
| scripts/site-settings-bulk-contract.test.mts | bulk publish batch, per-setting audit, stale skip, replay và route/migration contract |
| scripts/storefront-visual-contract.test.mjs | public visual/source boundaries |
| scripts/captured-route-runtime.test.mjs | captured asset/runtime path |
| scripts/development-port.test.mjs | reserved-port and local runner rules |

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
