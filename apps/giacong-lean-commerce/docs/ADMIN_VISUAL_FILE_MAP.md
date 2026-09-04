# Bản đồ file Giacong Visual Admin

**Trạng thái:** bản đồ ownership và source-of-truth
**Cập nhật:** 2026-09-04
**Roadmap:** ADMIN_VISUAL_ROADMAP.md

Mục tiêu của file này là trả lời nhanh bốn câu hỏi trước khi sửa code:

1. Nội dung đang được render ở đâu?
2. Dữ liệu canonical nằm ở đâu?
3. API/quyền/test nào bảo vệ nó?
4. Vùng đó đã editable hay chỉ là captured/static?

Không thêm file mới vào map chỉ vì đã nghĩ ra tên. File chỉ được đánh dấu “đã có”
khi tồn tại trong checkout; file “dự kiến” phải được tạo trong phase tương ứng.

**Current release checkpoint — 2026-09-04:** Checkout head `1002dc50` đã qua
admin `284/284`, các suite storefront/contact, lint, typecheck và build
`27/27`; staging đang chạy version
`6c5789e8-0b84-401e-b3c4-6fc3cff5bcf4` ở 100% và D1 staging không còn migration
  pending. Các write path admin đã xác nhận postcondition thật trong cùng batch,
  rollback khi thiếu marker/audit và không phụ thuộc batch result rows. Owner
  browser smoke sau deploy đã đọc đủ 10/10 route canonical ở desktop, heading
  đúng, không render lỗi/1102/5xx, không overflow và console error/warning rỗng.
  Runner `qa:admin-stress` vẫn là read-only/test-only và chưa chạy vì chưa có
  Access storage state; production chưa deploy/migrate.

**Checkpoint 2026-09-03:** checkout hiện ở commit `222ec6c4` (đã giảm burst
prefetch protected admin sidebar; QA selector menu
đã dùng identity ổn định; code behavior staging vẫn ở version đã ghi bên dưới). P1 host-gated admin context, P2 settings write
contract (per-setting + bulk publish), contextual editor MVP, P3 contextual
news-detail hand-off, P4 managed-page hand-off, P5 product bulk import UI và
product/service/category bulk archive contract đã có trong `master`. Bản
storefront motion/menu đã được review và tích hợp từ worktree riêng; fallback
gallery đã chấp nhận asset WebP. `qa:ux` là runner tracked để lặp lại audit
staging. Public staging `https://staging.kienhieu.id.vn` vừa pass deep QA responsive và functional
route. Staging đang phục vụ version
`b8b344ca-07c3-4449-bfca-d5acad685931`; rollback point gần nhất là
`e50223de-208f-45d8-bd4f-27ecc32b37ea`; owner thật `qtu1053@gmail.com` đã được
bootstrap vào D1 staging với role `owner` cấp cao nhất. `/admin/thanh-vien` đã
được browser xác nhận hiển thị tài khoản hiện tại, khóa self-demotion/self-
deactivation và mở được luồng `Thêm tài khoản quản trị`.

**Checkpoint QA mới nhất — 2026-09-03:** Checkout head `222ec6c4`; bản sửa
prefetch protected sidebar có regression contract; QA-only
commit `0b1986bf` sửa false-positive của admin matcher, sau đó role-matrix
runner được harden để yêu cầu đủ năm storage state phân biệt. Staging runtime
`b8b344ca-07c3-4449-bfca-d5acad685931` đang ở 100%, rollback point gần nhất là
`e50223de-208f-45d8-bd4f-27ecc32b37ea`. Full admin tại source hiện hành đạt
`216/216`, build
isolated đạt `27/27`, lint/typecheck pass; production chưa bị mutate và còn 11
migration pending `0009–0019`.

Source gate hiện hành sau bulk-import hardening, role-matrix QA, sửa selector
menu và giảm burst prefetch admin đạt admin `216/216`, contact `104/104`, catalog `5/5`, purchase UI `1/1`, service `3/3`,
commerce `69/69`, listing `4/4`, detail `29/29`, lint, typecheck và build
`27/27`; focused bulk-import đạt `19/19`. Commit này đã deploy staging;
owner smoke sau deploy đã đọc lại được, còn role matrix vẫn cần bốn identity
thật ngoài owner.

Full gate gần nhất có admin `216/216`; các suite contact/catalog/purchase/service/
commerce/listing/detail, lint, typecheck và build đều đã có evidence pass ở các
lượt revalidation tương ứng. Public deep QA pass; browser role matrix đủ năm
identity, write/read-back từng domain và production gate vẫn chưa đóng.
Wrapper PowerShell giữ process sau khi đã in xong output nên phải dừng thủ công;
không dùng điều đó để thay thế cửa sổ release có exit code sạch.

**Runtime recovery update 2026-09-03:** Sau khi các phiên subagent bị dừng,
checkpoint source và staging vẫn nguyên vẹn. Phiên Chrome owner đã đọc lại
10/10 route admin canonical; owner/heading đúng và không có trạng thái lỗi
tải dữ liệu/1102/502/503 được render. Đây là bằng chứng read-only sau restart;
role matrix nhiều identity, write/read-back đầy đủ và production gate vẫn mở.

**Controlled 1102 recheck update 2026-09-03:** Một lượt điều hướng dồn trước đó
đã từng hiện Cloudflare `Worker exceeded resource limits` tại `/admin/san-pham`.
Tab owner mới mở riêng rồi điều hướng chậm qua các route liên quan đều render
đúng; API products trả `200`, Wrangler tail quan sát được các invocation
`outcome=ok` với CPU `10–522 ms` và wall time `253–679 ms`. Incident đã được
ghi trong audit nhưng performance gate vẫn mở cho tới stress test có kiểm soát.

**Admin prefetch hardening update 2026-09-03:** Commit `222ec6c4` tắt prefetch
cho protected sidebar route để tránh burst RSC request lúc mở dashboard. Staging
version `b8b344ca-07c3-4449-bfca-d5acad685931` đã được owner kiểm tra lại:
dashboard có dữ liệu, API trả `200`, tail `outcome=ok`, CPU `24 ms`, wall
`827 ms`, console rỗng. Đây là evidence controlled, chưa đóng performance gate.

**Live storefront handoff update 2026-09-03:** `AdminContentPage` và
`AdminPageBuilder` không còn dựng card preview bằng JSX/CSS riêng. Hai màn hình
giữ vai trò control plane cho draft/publish nhưng chỉ đưa người vận hành sang
route storefront thật để kiểm tra renderer, layout, menu, ảnh và animation; bản
nháp chưa publish được ghi rõ là chưa xuất hiện ở tab storefront.

**Footer navigation renderer update 2026-09-03:** commit `f66eb2b9` bổ sung
`applyFooterNavigationToMarkup` cho homepage và shared captured shell. Mục
`footer` mới có thể tạo từ admin, chỉ các mục đã publish và đang active mới
xuất hiện trong khu vực “Liên kết website”; các cột footer captured legacy không
bị ghi đè. Local contract/full check đã pass; staging deploy, Access
write/read-back và visual footer desktop/mobile vẫn là gate runtime riêng.

**Footer staging deploy/read-only smoke 2026-09-03:** commit `eef99fd9` đã
lên `giacong-vn-staging` version
`e50223de-208f-45d8-bd4f-27ecc32b37ea` ở 100%; homepage public đọc đúng,
không overflow/admin control/console error. Staging chưa có footer item active
nên managed list không hiện; không tạo dữ liệu thử vì create không có delete
thật. Active-footer write/read-back và visual desktop/mobile vẫn mở.

**Staging deploy/read-only smoke 2026-09-03:** Commit `655ff4f1` đã lên
`giacong-vn-staging` version `430d41b1-a61c-46d1-ac9f-89eb8df74feb` ở 100%.
Sau propagation, owner chạy lại đủ 10 route admin canonical đạt `10/10` theo
đúng heading `h1`, đồng thời đọc storefront `/`; handoff tới route thật hiện
đúng, public không có admin control, console error/warning rỗng. Một 502 thoáng
qua ngay sau deploy đã được reload và xác minh hồi phục; chưa có mutation dữ liệu.

Rollback drill staging 2026-09-01 đã pass: chuyển 100% traffic về
`a1f71e85-113e-4559-9377-ebedc22b92e7`, smoke public pass, sau đó khôi phục
100% về `902b3a6e-732f-4de6-a9fc-429b6478d833`; sau đó version
`eb921d4e-2250-460c-913a-071499e52c59` được promotion cho contract create. Đây
chỉ là bằng chứng rollback runtime staging; backup/restore production và
production gate vẫn mở.

Commit `566489d` bổ sung contract navigation single/bulk; commit `d654f2e` bổ sung
create contract. Cả create/single save/publish và bulk publish dùng request UUID,
revision guard, idempotent replay/conflict; mutation được ghép D1 batch atomic với
audit chuyên biệt, bulk giới hạn 100 mục và trả kết quả stale theo id. Các migration
`0017_navigation_bulk_publish_contract.sql`
và `0018_navigation_create_contract.sql` cùng
`0019_admin_site_page_write_contract.sql` đã được verify qua baseline + toàn bộ
migration trên D1 local tạm và đã apply/verify trên D1 staging; production chưa
apply các migration này. Browser đã đọc lại form create nhưng chưa submit để
không tạo dữ liệu staging ngoài yêu cầu.

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

Commit `d14d4e4` chốt wording và field-error UX cho control plane thành viên;
commit `f4707b4` thêm trạng thái `Đang kiểm tra quyền…` để không hiển thị nhầm
`Chỉ xem` trong thời gian session đang tải. Owner có thể tạo admin, cấp/sửa
role và active state; server vẫn bảo vệ owner khỏi tự hạ quyền/vô hiệu hóa.
Chrome staging đã quan sát được cả trạng thái đang tải và quyền owner sau khi
session hoàn tất.

Commit `d63c7ec` bổ sung retry-safe cho News/Services/CMS bulk actions: khóa
double-click, giữ request ID và payload item/revision khi gặp network/5xx,
chỉ reset marker ở success hoặc 4xx. Contract focused `18/18`, full gate đã
in pass cho toàn bộ test/lint/typecheck/build; version staging mới là
`379d20d7-44d2-40ee-a603-2890ba7515fb`, rollback về
`278030a5-c21b-423f-b443-7f2ad4834b76`.

Commit `8652130` sửa metric dashboard “Sản phẩm bản nháp” để đếm đúng trạng
thái `draft/review` trong `product_admin_meta`; focused regression đã được thêm
vào `scripts/admin-dashboard.test.mts`. Version staging
`d1d270a8-52d5-4a8b-a988-daa21e8fdfa3` đã promote 100% và Chrome owner đọc lại
`12` tổng sản phẩm, `10` active, `0` draft. Lead QA staging cũng đã trải qua
round-trip status có kiểm soát và audit read-back; đây chưa phải bằng chứng
đóng write/read-back cho mọi domain.

Chrome owner sau đó đã đi qua đủ 10 route admin canonical trên hostname staging;
`node scripts/qa-deep-staging.mjs` cũng pass mobile/tablet/desktop cho public
route, catalog, product detail/cart và keyboard. Đây là evidence navigation và
public deep-QA bổ sung, không thay thế role matrix nhiều identity hoặc
write/read-back từng domain.

CMS owner staging đã có một draft round-trip có kiểm soát trên `brand_tagline`:
giá trị QA chỉ xuất hiện trong trạng thái draft, public vẫn giữ bản published,
sau đó giá trị ban đầu được lưu lại và UI trở về `Published/Đã đồng bộ`. Không
đánh dấu đây là publish/preview đầy đủ hay bằng chứng cho role khác.

**Runtime update 2026-09-02 (direct editing trên DOM thật):**
`AdminVisualEditor.tsx` không còn render `DraftPreview`; khi session là owner hoặc
content manager, editor gắn `admin-visual-targets.ts` vào 8 selector homepage
đã xác định. Click/keyboard mở popover ngay cạnh nội dung thật và cập nhật DOM
ngay lập tức; thanh cố định giữ `Bảng nội dung`, `Lưu draft`, `Xuất bản`. Bảng
nội dung vẫn là đường xử lý URL/media và các field đầy đủ. Chrome staging đã
kiểm tra 8/8 selector, temporary edit + reload restore, public staging 0 admin
control; focused 13/13, full admin 192/192, commerce 67/67. Version hiện tại
`6162fa96-38fb-46df-adba-beb1e2d99001` ở 100%, rollback point
`dabb547e-1475-4815-b9e9-03be91064105`.

Navigation owner staging cũng đã kiểm tra mục `Home`: draft label QA không rò
ra public, sau đó nhãn `Home` được khôi phục và item trở lại `Published`. Đây
chưa phải publish-all hoặc write/read-back đầy đủ cho navigation.

News owner staging đã tạo một bài nháp QA, đọc lại đúng trong admin, xác nhận
`/tin-tuc` public vẫn empty, rồi xóa bản ghi QA qua confirm dialog; danh sách
trở về `0 bài viết`. Không để lại dữ liệu thử và chưa suy diễn publish/media.

Navigation publish round-trip đã được xác minh trên staging owner: commit
`7666d67` sửa `localDirty` để draft đã lưu bật đúng nút publish từng mục, còn
local edit chưa lưu không thể publish; commit `8ecd8ae` sửa `CapturedHomePage`
để homepage áp dụng published navigation. Browser đã chạy `Home [QA]` save →
single-item publish → public read-back, sau đó restore/publish `Home`; D1 cuối
`draft = published = Home`, `dirty = 0`, version `7`. `/admin/audit` đọc lại
`107` events; deep QA staging sau deploy pass. `CapturedHomePage.tsx` hiện là
HTML captured + site settings + published navigation mapping, còn fallback hero
gallery vẫn ở cùng page boundary.

**Runtime update 2026-09-02 (CMS brand tagline publish mapping):** commit
`ca14e5f` bổ sung adapter `brand_tagline` vào shared `site-markup` renderer và
regression test HTML-escape. Owner staging đã chạy draft QA → publish → public
DOM read-back có `data-site-setting="brand_tagline"` và element hiển thị; sau
đó restore/publish giá trị gốc. Staging version trong phép thử
`c860a002-afcc-4c41-a329-b0390799d9bc`, rollback point
`26884d0b-0092-43cd-bad2-df077de605eb`; audit tại thời điểm đó `123` event, revision tagline
`7 → 8 → 9 → 10 → 11`. `global.brand` hiện đã map brand name/tagline vào
captured shell; logo URL vẫn có fallback capture an toàn. Role matrix nhiều
identity, các domain write/read-back còn lại và production gate vẫn mở.

**Runtime update 2026-09-02 (homepage content mapping):** commit `732eba5`
thêm `applyHomepageSiteSettingsToMarkup` để nối `hero_description`,
`about_title` và `about_description` vào đúng captured `section01/section02`;
selector được giới hạn ở page boundary homepage, nội dung multiline được
escape an toàn. Full commerce gate sau thay đổi đạt `67/67`; full check,
staging deploy và Chrome public DOM read-back đều pass. Worker staging hiện là
`81b2e573-dea9-4e6a-b7ce-9cddb9b5fc70`, rollback point là
`0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0`; audit giữ `139` events, không có
mutation D1/R2 trong probe. `home.hero` hiện map đủ text hero/about, CTA,
image và brand fields; preview draft, role matrix nhiều identity, các domain
write/read-back còn lại và production gate vẫn mở.

**Runtime update 2026-09-02 (Hero CTA publish mapping):** commit `173239e`
bổ sung adapter cho `hero_primary/secondary_cta_label/url` và regression test
escape. Owner staging đã draft → publish cả bốn setting; public DOM đọc đúng
label, href và visibility của hai CTA, sau đó restore/publish về giá trị gốc.
Staging version hiện tại `0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0`, rollback point
`c860a002-afcc-4c41-a329-b0390799d9bc`; audit hiện `139` event. `home.hero`
hiện map eyebrow/title/description/image/CTA; preview draft, role matrix nhiều
identity, các domain write/read-back còn lại và production gate vẫn mở.

`/admin/audit` đọc lại `139 sự kiện` sau các round-trip; các event mới nhất của
news/navigation/site setting có actor, action, revision và request ID. Đây là
evidence audit của các phép thử có kiểm soát, không phải full-domain consistency.

Repo chính không có GIF/video runtime bắt buộc: motion hiện dùng CSS/HTML và
asset WebP phù hợp. Worktree motion riêng vẫn được giữ nguyên, không reset hoặc
xóa các artifact người dùng đang làm.

**Runtime update 2026-09-02 (managed page write):** commit `7d6b75b` và migration
`0019_admin_site_page_write_contract.sql` đã chốt create/draft/publish page với
request ID, optimistic version, replay/conflict và audit D1 atomic. Staging
version `14a6e3c9-7a4f-46a2-b8a0-c6eaf827647c` đang ở 100%; active smoke 7/7
public route, product/cart/R2 invariants đều pass. Release workflow commit
`fa3bdc6` không còn phụ thuộc tổng variant staging cứng; nó kiểm tra số variant
khả dụng và SKU chuẩn. Role matrix nhiều Access identity, authenticated
write/read-back đầy đủ và production gate vẫn là phần chưa đóng.

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
| Captured home render | src/components/site/CapturedHomePage.tsx | đã có; HTML captured + site settings + published navigation mapping và fallback hero gallery | P2, P4 |
| Captured page render | src/components/CapturedPage.tsx | đã có; captured markup fallback | P1–P4 |
| Header/footer shell | src/components/site/CapturedStorefrontShell.tsx | đã có; áp settings/navigation vào captured shell | P2, P4 |
| Safe block render | src/components/site/PageBlocks.tsx | đã có; renderer dùng chung với managed page thật; nhận pageKey tùy chọn để gắn action trên managed page | P4 |
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
| Brand/contact/hero | src/lib/site-settings.ts, src/lib/site-markup.ts, src/lib/admin-request.ts | site settings API + bounded JSON + input validation | published_value và fallback default; brand tagline được escape và render cạnh captured logo | content.read/write/publish | scripts/site-settings.test.mts, scripts/site-settings-write-contract.test.mts, scripts/admin-request.test.mts, scripts/site-markup-hero.test.mjs |
| Managed pages | src/lib/site-pages.ts, src/lib/page-builder.ts | page API + safe block parser | published blocks chỉ khi enabled/published | pages.read/write/publish | scripts/site-pages.test.mts |
| Primary/footer navigation | src/lib/site-navigation.ts | navigation API + trusted link normalization | published items; footer managed-links renderer đã có, giữ nguyên cột captured legacy | navigation.read/write/publish | scripts/site-pages.test.mts, scripts/storefront-visual-contract.test.mjs |
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
| Page builder | AdminPageBuilder.tsx | safe blocks, draft/publish; chọn page theo query `?page=` và mở route storefront thật để kiểm tra | vẫn là advanced editor/back office; inline là shortcut |
| Navigation | AdminNavigationManager.tsx | primary/footer menu manager; tạo được mục ở đúng vị trí và publish riêng/bulk | giữ full editor; contextual edit gọi vào đúng item |
| Members | AdminMembersManager.tsx | owner quản lý admin roles | trang đặc biệt, không inline trên storefront |
| Audit/history | src/app/admin/audit/page.tsx, src/app/api/admin/audit/route.ts, src/lib/admin-audit.ts | owner-only timeline read-only, filter/pagination, revision/request id | trang đặc biệt P6; không có rollback nếu chưa được phê duyệt |
| Category/variant | AdminCategoryPanel.tsx, AdminVariantPanel.tsx | catalog sub-editors | dùng trong catalog/bulk flow, không nhồi hết vào homepage |
| Product bulk import/archive | AdminProductImportPanel.tsx, src/app/admin/san-pham/page.tsx, src/lib/admin-product-batch.ts | chọn CSV, preview lỗi, import atomic; chọn sản phẩm đang hiển thị, snapshot revision, xác nhận và soft-archive batch | giữ ở catalog control plane; viewer read-only; không biến thành inline editor |
| Storefront admin context | AdminVisualMode.tsx, AdminNewsContextualAction.tsx, AdminPageContextualAction.tsx, AdminNewsContextualAction.module.css | host/session gate, context role và contextual news/page actions; trạng thái loading/blocked/unavailable/ready | chỉ hiện action trên exact admin hostname sau session ready; public không fetch admin session và không render control |
| Contextual settings editor | AdminVisualEditor.tsx, AdminVisualEditor.module.css, admin-visual-targets.ts | direct edit trên DOM storefront thật cho 8 homepage target, drawer field đầy đủ, draft/publish và role-aware feedback | MVP cho region đã map; không mô phỏng preview; URL/media và field phức tạp đi qua bảng nội dung |
| Admin CSS | src/styles/admin.css | styling control plane | giữ token/brand language, không tạo dashboard stack mới |

### Visual layer: file đã có và file chưa cần tạo

Vertical slice hiện tại chứng minh chưa cần tách thành nhiều abstraction:

| File canonical | Trách nhiệm | Không được làm |
| --- | --- | --- |
| src/components/admin/AdminVisualMode.tsx | context/entry state cho admin storefront | không tự cấp quyền |
| src/components/admin/AdminVisualEditor.tsx | toolbar/drawer và flow brand/home settings | không ghi D1/R2 trực tiếp |
| src/components/admin/AdminVisualEditor.module.css | layout, focus, mobile và reduced-motion cho editor | không tạo token riêng ngoài hệ thống |
| src/components/admin/admin-visual-targets.ts | registry selector/input type cho homepage direct edit | không scan HTML tùy ý hoặc mở rộng sang route chưa map |
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
| Navigation | /api/admin/navigation, /api/admin/navigation/[id], /publish, /publish-all | P4; create/save/publish có exact requestId + revision/CAS + idempotent audit; bulk tối đa 100, D1 atomic, stale theo item và replay; migrations `0017–0018` đã có trong master và staging; owner staging đã verify single-item save → publish → public read-back, còn publish-all, role matrix và full-domain acceptance mở |
| News | /api/admin/news, /api/admin/news/[id], /api/admin/news/[id]/publish, /api/admin/news/batch | P3; draft save, explicit publish/unpublish, batch status và contextual deep-link đã có; owner staging đã verify create/read/delete QA draft, publish/media acceptance còn mở |
| Media | /api/admin/media, /api/admin/media/[id], /api/admin/media/cleanup | P3/P5; upload/alt/delete đã exact requestId + revision/CAS + audit/R2 guard; owner staging đã verify alt write/read-back và `MEDIA_IN_USE` reference guard; fresh upload/full-domain acceptance còn mở; cleanup vẫn là recovery path bounded riêng |
| Catalog | /api/admin/categories, /api/admin/categories/[id], /api/admin/categories/batch, /products, /products/[id], /products/batch, /products/[id]/variants, /products/[id]/variants/[variantId], /api/admin/products/import | P5; bulk import tối đa 50 dòng, product/category archive tối đa 100 item; single-row product/variant create/update/archive và bulk contract đều revision-aware/atomic/idempotent/audited; category/product/variant action là soft archive, không hard-delete; contract đã có trong master và staging, còn browser/admin Access read-back |
| Services | /api/admin/services, /api/admin/services/[id], /api/admin/services/batch | P5; batch archive có snapshot revision riêng, tối đa 100 item, stale skip, atomic audit/idempotency; owner staging đã verify service QA write/read-back và khôi phục, batch/full-domain acceptance còn mở |
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
| migrations/0017_navigation_bulk_publish_contract.sql, migrations/0018_navigation_create_contract.sql | navigation last-request marker, single-item audit, bulk publish envelope và create audit | P4/P5; đã verify local và staging, production gate riêng |
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
| global.brand | logo, brand name, brand tagline | site settings + captured shell + site-markup adapter | content write/publish | brand name/tagline mapped; logo fallback/custom URL | P2 |
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
| /admin/thiet-ke | blocks/sections + mở page storefront thật | giữ làm advanced editor; không dựng preview riêng |
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
| scripts/admin-route-capability-matrix.test.mts | route handler discovery, read/write/publish capability guard và owner-only boundary cho toàn bộ admin API |
| scripts/storefront-visual-contract.test.mjs | public visual/source boundaries |
| scripts/captured-route-runtime.test.mjs | captured asset/runtime path |
| scripts/development-port.test.mjs | reserved-port and local runner rules |
| scripts/qa-deep-staging.test.mjs | harness chờ streamed storefront content trước detail/keyboard assertions |
| scripts/qa-admin-staging-contract.test.mjs | authenticated admin staging runner, single-identity/role-matrix storage-state boundary và read-only/no-mutation contract |
| scripts/qa-admin-staging-a11y-contract.test.mjs | admin staging runner kiểm tra default/reduced-motion, keyboard focus reachability và giữ boundary read-only |

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
