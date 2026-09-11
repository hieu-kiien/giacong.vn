# Astra audit handoff — Giacong.vn

> **Cửa vào mới ngày 2026-09-07:**
> [ADMIN_COMMERCE_RECOVERY_HANDOFF.md](./ADMIN_COMMERCE_RECOVERY_HANDOFF.md).
> Tài liệu này giữ bằng chứng audit lịch sử; không tự mở lại audit toàn repo,
> ưu tiên homepage hoặc yêu cầu năm role từ các mục cũ.

> Snapshot ngày 2026-09-06. Đây là index bàn giao cho một evaluator mới, không
> thay thế nguồn quyết định hay log runtime. Mọi kết luận phải trỏ về file,
> route, test, command hoặc staging evidence cụ thể.

Chạy `npm run qa:astra-preflight` trước khi bắt đầu. Lệnh này chỉ đọc repo,
không đọc giá trị secret, không mutation D1/R2, không deploy và không tự xóa
artifact. Có thể dùng `node scripts/astra-audit-preflight.mjs --json` để lấy
report JSON máy đọc được.

## 1. Cách bắt đầu

Đọc theo thứ tự này:

1. [CLOUDFLARE_NATIVE_V1_PLAN.md](./CLOUDFLARE_NATIVE_V1_PLAN.md) — nguồn
   quyết định sản phẩm/kiến trúc hiện hành.
2. [CLOUDFLARE_CURRENT_STATE.md](./CLOUDFLARE_CURRENT_STATE.md) — bằng chứng
   runtime, staging, binding và các gate còn mở.
3. [CLOUDFLARE_ADMIN_WRITE_CONTRACT.md](./CLOUDFLARE_ADMIN_WRITE_CONTRACT.md) —
   auth, capability, validation, revision, idempotency, audit và D1/R2.
4. [AI_ADMIN_SKILL_GUIDE.md](./AI_ADMIN_SKILL_GUIDE.md) — cách kiểm duyệt
   admin theo Lean V1.
5. [ADMIN_VISUAL_FILE_MAP.md](./ADMIN_VISUAL_FILE_MAP.md) và
   [ADMIN_VISUAL_ROADMAP.md](./ADMIN_VISUAL_ROADMAP.md) — ownership, route,
   vùng editable, phase và Definition of Done.
6. [RELEASE_READINESS_AUDIT.md](./RELEASE_READINESS_AUDIT.md) và
   [PRODUCTION_ACCEPTANCE_CHECKLIST.md](./PRODUCTION_ACCEPTANCE_CHECKLIST.md) —
   evidence release, staging và production NO-GO/GO.
7. [SUBAGENT_TEAM_OPERATING_MODEL.md](./SUBAGENT_TEAM_OPERATING_MODEL.md) —
   quy tắc phân vai, worktree, review và handoff.

`COMMERCE_PLATFORM_MASTER_PLAN.md`, `research/`, `design-references/` và
`handoff-references/` là lịch sử/tham khảo; không dùng chúng để suy ra scope
hoặc runtime hiện tại. Workspace root không phải npm workspace; lệnh ứng dụng
chạy trong `apps/giacong-lean-commerce/`.

## 2. Bản đồ hệ thống tối thiểu

| Vùng | Entrypoint/đường dẫn chính | Cần kiểm tra |
| --- | --- | --- |
| Storefront | `src/app/(storefront)/**`, `src/components/site/**`, `src/lib/captured-*.ts` | captured markup, navigation, published settings, mobile/desktop, public không thấy draft/admin |
| Catalog | `src/lib/cloudflare-catalog.ts`, `src/lib/product-*.ts`, `src/app/san-pham/**`, `src/app/api/catalog/**` | D1 canonical, variant/MOQ/tier, request-only purchase, demo fallback bị giới hạn |
| Request intake | `src/lib/contact-webhook.ts`, `src/lib/request-cart*.ts`, `src/app/api/contact/**`, `docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md` | server re-read/validate, giá/tổng canonical, queue/retry, PII và formula safety |
| Admin shell/auth | `src/components/admin/AdminShell.tsx`, `src/lib/admin-access*`, `src/lib/admin-guard*`, `src/lib/admin-permissions.ts`, `src/app/api/admin/**` | Access/JWT/hostname/origin, role × route × action, errors an toàn, không public mutation |
| Admin domains | `src/app/admin/**`, `src/components/admin/**`, `src/lib/admin-*.ts` | loading/error/empty/stale, draft/publish, capability server-side, UX và keyboard |
| D1/R2 writes | `migrations/**`, `src/lib/*write*.ts`, admin route handlers, media adapters | transaction/batch, revision CAS, idempotency, audit/postcondition, R2 reference không orphan |
| Release/QA | `scripts/`, `wrangler.jsonc`, `open-next.config.ts`, `custom-worker.ts`, `docs/CLOUDFLARE_DEPLOYMENT.md` | local → staging → acceptance → production gate, browser/console/network, rollback/observability |

Các bề mặt bị khóa ngoài Lean V1: customer account, checkout, payment, order,
shipping, review/rating/favorite, Bagisto runtime và arbitrary HTML/CSS/JS page
builder.

### 2.1 Route inventory tại snapshot

Inventory dưới đây được lấy từ `src/app/**` hiện tại. Nó chỉ cho biết bề mặt
file/route; evaluator phải đọc handler để xác nhận HTTP method, capability,
role, guard và read/write semantics, không suy luận quyền từ tên route.

| Lớp | Route patterns quan sát được |
| --- | --- |
| Storefront pages | `/`, `/[...slug]`, `/gui-yeu-cau`, `/san-pham`, `/san-pham/[slug]`, `/san-pham/[...path]`, `/thue-gia-cong`, `/thue-gia-cong/[family]`, `/tin-tuc`, `/tin-tuc/[slug]` |
| Admin pages | `/admin`, `/admin/audit`, `/admin/dich-vu`, `/admin/dieu-huong`, `/admin/noi-dung`, `/admin/san-pham`, `/admin/thanh-vien`, `/admin/thiet-ke`, `/admin/tin-tuc`, `/admin/yeu-cau` |
| Admin API — audit/dashboard/session | `/api/admin/audit`, `/api/admin/dashboard`, `/api/admin/session` |
| Admin API — categories/leads | `/api/admin/categories`, `/api/admin/categories/[id]`, `/api/admin/categories/batch`; `/api/admin/leads`, `/api/admin/leads/[id]` |
| Admin API — media/members | `/api/admin/media`, `/api/admin/media/[id]`, `/api/admin/media/cleanup`; `/api/admin/members`, `/api/admin/members/[id]` |
| Admin API — navigation/news | `/api/admin/navigation`, `/api/admin/navigation/[id]`, `/api/admin/navigation/[id]/publish`, `/api/admin/navigation/publish-all`; `/api/admin/news`, `/api/admin/news/[id]`, `/api/admin/news/[id]/publish`, `/api/admin/news/batch` |
| Admin API — pages/products | `/api/admin/pages`, `/api/admin/pages/[pageKey]`, `/api/admin/pages/[pageKey]/publish`; `/api/admin/products`, `/api/admin/products/[id]`, `/api/admin/products/batch`, `/api/admin/products/import`, `/api/admin/products/[id]/variants`, `/api/admin/products/[id]/variants/[variantId]` |
| Admin API — services/settings | `/api/admin/services`, `/api/admin/services/[id]`, `/api/admin/services/batch`; `/api/admin/site-settings`, `/api/admin/site-settings/media`, `/api/admin/site-settings/publish`, `/api/admin/site-settings/publish-all` |
| Public/support API | `/api/catalog/products/[slug]`, `/api/contact`, `/api/gui-yeu-cau/xác-thực`, `/media/[...path]` |

Các nhóm cần trace end-to-end trước release là admin categories, leads,
media, members, navigation, news, pages, products/variants/import, services,
site-settings và contact. Mỗi nhóm phải có bằng chứng request → guard →
validation → D1/R2/queue → audit/postcondition → response → public read-back;
route tồn tại hoặc test unit pass không thay thế được browser/staging evidence.

### 2.3 Inline storefront editor evidence — 2026-09-06

`AdminVisualEditor` hiện cung cấp chỉnh trực tiếp có giới hạn trên storefront:
hero/about, brand tagline/logo, CTA label/link và hero image. Draft/publish,
revision conflict, idempotency retry, multipart image validation, media picker,
dirty navigation và khôi phục ảnh đã đăng đã được kiểm thử trên fixture cục bộ
18/18 ca. OpenNext preview `3ea32ef4-ee73-4bb4-9e4d-2a59de72e5e7` đạt smoke test
homepage, catalog, product detail, cart và service; version đó đã được chuyển
100% vào staging. Public read-back xác nhận draft không rò ra storefront trước
publish; sau publish ảnh đổi đúng; dữ liệu thử nghiệm sau đó đã được khôi phục.
Kết quả 2026-09-07: staging `83384ce2-c68a-43a9-b15c-ec784ec13158`, rollback
`3ea32ef4-ee73-4bb4-9e4d-2a59de72e5e7`; 561 test + 17 admin + 18 inline
browser đạt, owner thật đọc 10 route × desktop/mobile và dùng popover inline.
Chi tiết mới nhất ở `ADMIN_QUALITY_REVIEW.md` và `CLOUDFLARE_CURRENT_STATE.md`.

Quyết định mới 2026-09-07 thay thế mọi yêu cầu năm role trong hồ sơ lịch sử:
chỉ giữ **Admin toàn quyền**, khóa lưu trữ `owner`; role cũ bị từ chối và không
tự nâng quyền. Staging có đúng một owner, không cần migration tài khoản. Gate
hiện hành là owner Access runtime cùng test từ chối quyền cũ.

Fixture là memory-only, không chứa credential và không thay thế kiểm chứng Access
Access thật.

### 2.2 Tài nguyên evidence và reference

| Tài nguyên | Dùng để | Giới hạn |
| --- | --- | --- |
| `.runtime/expert-review/` | Screenshot desktop/mobile của storefront, catalog, detail, contact, request và admin | Evidence local đã tạo; không coi là runtime mới nếu chưa có timestamp/URL |
| `.runtime/ux-audit-20260903/` và `.runtime/ux-audit-20260903-after-selector/` | `audit.json` và screenshot responsive trước/sau selector | Dùng để so sánh UX, không thay thế browser QA hiện tại |
| `docs/handoff-references/references/approved/` | Asset/reference đã duyệt cho visual comparison | Không biến asset lịch sử thành claim runtime |
| `docs/design-references/` và `design/ai-handoff/` | Nguồn tham khảo thiết kế, content và route map | Chỉ là design input; Lean V1 plan/code thắng khi có xung đột |
| `.runtime/production-d1-backup-20260902-pre-release.sql` | Recovery evidence nhạy cảm | Không đọc/in/upload hoặc dùng làm fixture; giữ nguyên và chỉ owner vận hành backup |
| `QA_ADMIN_STORAGE_STATE` | Cookie/session state staging cho `qa:admin-history` | Chỉ truyền qua biến môi trường ngoài repo; không commit, log hoặc chia sẻ file state |

Astra có thể mở screenshot local khi cần, nhưng mọi finding về behavior phải
được tái hiện bằng source/test/browser evidence mới. Không cần tạo thêm thư mục
scratch trong repo.

## 3. Snapshot môi trường và evidence local

| Hạng mục | Kết quả đã quan sát | Diễn giải |
| --- | --- | --- |
| Git | Branch `hardening/captured-script-strip`, HEAD `426ee6ad`; số file dirty/staged/untracked phải lấy từ preflight ngay trước review | Đây là dirty worktree có thay đổi của chủ dự án và các vòng audit trước; Astra phải phân loại ownership trước khi sửa, không reset/clean hoặc gán toàn bộ diff cho audit |
| Runtime | Node `v24.14.0`, npm `11.9.0`, pnpm `11.6.0` | Khớp engine `>=24` trong `package.json` |
| Framework/tooling | Next `16.3.4`, Wrangler `4.125.0`, OpenNext Cloudflare `1.20.5`, TypeScript `5.9.3`, ESLint `9.39.4`, Playwright `1.61.1`; `node_modules` tồn tại | Toolchain hiện tại đã được xác nhận bằng package/runtime inspection |
| Env | Chỉ xác nhận tên `.env`, `.env.local`, `.env.example`; không đọc giá trị | Cần kiểm tra binding/secret ở môi trường đích bằng quy trình an toàn |
| Dependency tree | `npm ls --depth=0` báo extraneous `@emnapi/runtime@1.11.3` và `@img/sharp-wasm32@0.35.4` | Không tự xóa trong dirty worktree; xác nhận lại từ clean install |
| Test | `npm run test:admin` hiện đạt `339/339`; các track storefront/contact cần Astra chạy lại đầy đủ nếu thay đổi chạm vào chúng | Đây là evidence của code hiện tại, không phải baseline sạch |
| Admin browser QA | `npm run qa:admin-history` với storage state staging đạt `9/9`: sidebar, SVG child, Back/Forward single-flight, query/hash, remount, nested variant/media và telemetry | Đây là staging evidence read-only; storage state không nằm trong repo và không được in/commit |
| Lint/typecheck | `npm run lint` exit `0`; `node_modules/.bin/tsc.cmd --noEmit --pretty false` exit `0` | Đã chạy độc lập bằng process wrapper có bắt exit code |
| Build | `npm run cf:build:staging` đã pass trên candidate cùng source guard; cần Astra chạy lại sau mọi source change | Chỉ chứng minh build local hiện tại; chưa chứng minh deploy/staging/production acceptance |
| Git diff check | Không thấy whitespace error; chỉ có warning LF → CRLF | Giữ ý thức line-ending khi stage/commit |
| GitNexus | `detect_changes(scope=all)` trên dirty worktree trả risk `low`, nhưng thấy toàn bộ diff hiện có; không có affected process trong report | Không coi kết quả này là chứng minh source sạch. Trước mỗi source symbol edit phải chạy `impact` upstream; trước commit chạy `detect_changes(scope=staged)` |
| Staging candidate | `0c4ee5bb-594f-45da-8744-4fa6ae8cf477`; admin history guard đã deploy staging-only, `ADMIN_PUBLIC=false`, không mutation D1/R2/production trong QA | Candidate chỉ là evidence để kiểm tra, không tự động là production release |
| D1 migrations | Có 20 migration files; `0004_admin_foundation.sql` và `0004_site_settings.sql` trùng numeric prefix. `wrangler d1 migrations list` local và staging remote đều báo không có migration pending | Đây là rủi ro tên/thứ tự cần reconcile trước migration mới; không tự ý đổi tên file đã apply |
| Routing/deployment | `wrangler.jsonc` hiện cấu hình cả production routes (`kienhieu.id.vn`, `admin.kienhieu.id.vn`) và staging routes (`staging.kienhieu.id.vn`, `admin-staging.kienhieu.id.vn`) | Có cấu hình route không đồng nghĩa đã deploy/được phép promote; production vẫn phải qua gate trong plan |
| Staging origin | Workflow deep-QA hiện dùng `https://staging.kienhieu.id.vn`; một số workflow one-time lịch sử vẫn dùng `giacong-vn-staging.qtu1053.workers.dev` | Phải phân loại workflow active/historical và chỉ định origin chuẩn để evaluator không kiểm tra nhầm môi trường |
| Contact abuse control | `CLOUDFLARE_DEPLOYMENT.md` ghi Turnstile chưa nối vào form; rate limiter hiện có fallback fail-open và test cố ý kiểm tra hành vi này | Không được tuyên bố chống abuse/5 requests per minute là production-enforced nếu chưa có runtime evidence và quyết định fail-open/fail-closed |

Lưu ý về provenance: số file dirty thay đổi theo từng vòng làm việc. Hãy lấy
con số hiện tại bằng preflight, không copy số liệu lịch sử vào báo cáo mới.
Các thay đổi guard admin trong vòng gần nhất đã được đưa vào workspace chính;
mọi file Muse khác vẫn phải được Astra phân loại ownership trước khi sửa hoặc
revert.

Test contact có log cảnh báo có chủ đích về rate limiter fail-open. Evaluator
phải xác nhận đây là fallback được chấp nhận ở production hay chỉ là test
fixture, đồng thời kiểm tra log không làm lộ nội bộ.

## 4. Checklist khảo sát Astra

- [ ] Chốt baseline: tách dirty diff khỏi audit hoặc commit checkpoint được chủ dự án xác nhận.
- [ ] Đọc source-of-truth và lập bảng mọi mâu thuẫn giữa plan, current-state, release audit, code và docs.
- [ ] Lập route × capability × role cho toàn bộ `/api/admin/**` và `/admin/**`; xác nhận guard ở server.
- [ ] Theo dõi một write end-to-end cho từng domain có mutation: request → validation → D1/R2 → audit/postcondition → response → public read-back.
- [ ] Kiểm tra stale revision, request-id replay, duplicate payload, rollback và missing `RETURNING` rows.
- [ ] Kiểm tra public/staging/production hostname, Access identity, origin, cookie/JWT và secrets mà không in giá trị.
- [ ] Chạy test track, lint, typecheck, build với exit code độc lập; phân loại mọi warning.
- [ ] Browser QA trên staging: desktop/mobile, keyboard/focus, reduced motion, loading/empty/error/stale, console/network, overflow và screenshot.
- [ ] Kiểm tra deployment/worker/D1/R2/migration/backup/restore/rollback/observability; production vẫn NO-GO nếu checklist chưa đóng.
- [ ] Duyệt cleanup queue bên dưới; không xóa lịch sử hoặc generated artifact đang được process dùng.

### 4.1 Protocol thực thi cho Astra

1. Chạy preflight và chụp lại report; xác định rõ dirty diff nào có trước vòng
   Astra. Không xem `git status` dirty là lỗi tự động.
2. Review read-only theo nhóm: admission/auth → route/capability → write
   contract → public read-back → browser UX. Mỗi finding phải có bằng chứng
   file/line, reproduction hoặc test, severity và owner.
3. Với lỗi có thể sửa, làm một lát nhỏ theo RED → GREEN → lint/typecheck →
   browser/regression. Trước khi sửa symbol chạy `impact` upstream; trước khi
   commit chạy `detect_changes(scope=staged)`.
4. Chỉ dùng staging cho mutation có fixture/rollback rõ ràng. Không đọc/in
   secret, không dùng storage state ngoài máy, không mutation production.
5. Kết thúc bằng báo cáo có bốn nhóm: `Đã xác minh`, `Critical/Required`,
   `Optional/Nit`, `Ngoài phạm vi`; kèm lệnh đã chạy, số pass/fail và verdict
   release (`GO`, `CONDITIONAL` hoặc `NO-GO`).

Lệnh tối thiểu:

```text
npm run qa:astra-preflight
npm run test:admin
npm run lint
npm run typecheck
npm run cf:build:staging
# Chỉ khi có storage state staging hợp lệ, không commit state:
npm run qa:admin-history
```

## 5. Cleanup queue — không tự xóa mù

| Phân loại | Đối tượng | Hành động |
| --- | --- | --- |
| Build output có thể tái tạo | `.next/`, `.open-next/` | Đã xác nhận không có process `next`/OpenNext/preview; cleanup filesystem bị policy môi trường chặn nên hai thư mục hiện vẫn được giữ, có thể dọn thủ công rồi tạo lại bằng `npm run build` hoặc `npm run cf:build:staging` |
| Evidence/backup cần giữ | `.runtime/` | Có production D1 backup và screenshot/audit evidence; không xóa mù dù thư mục bị ignore |
| Local binding state cần giữ | `.wrangler/` | Có thể chứa D1 local state; chỉ dọn khi đã có bootstrap/export và Astra không chạy local preview |
| Runtime assets cần giữ | `public/captured-pages/` | Bị ignore nhưng là input của storefront; tạo lại bằng `npm run prepare:captured-assets`, không xem là rác |
| Worktree cần giữ | `.worktrees/` và các linked worktree trong `git worktree list` | Có thể đang chứa nhánh/đầu việc khác; chỉ prune sau khi owner xác nhận |
| Cần kiểm tra trước | `node_modules/` và hai package extraneous | Tạo clean worktree/install rồi so sánh `npm ls`; không mutate install của dirty worktree |
| Giữ làm lịch sử | `COMMERCE_PLATFORM_MASTER_PLAN.md`, `research/`, `design-references/`, `handoff-references/`, `design/`, `reference/` | Không xóa; chỉ sửa index/nhãn nếu link hoặc status gây hiểu nhầm |
| Bắt buộc giữ | plan, current-state, write contract, deployment, acceptance/release audit, AI guide, file map, roadmap, migrations, tests và QA scripts | Đây là evidence/decision/guard, không phải rác |
| Chưa đủ dữ kiện | mọi file modified/untracked hiện tại | Đội review phải gắn từng file với change card trước khi đề xuất xóa hoặc revert |

Không giữ scratch report riêng trong workspace. `.runtime/`, `.wrangler/`,
captured assets và linked worktree được bảo toàn vì có thể chứa evidence, dữ
liệu local hoặc đầu vào runtime. `.next/` và `.open-next/` đã được xác định là
artifact tái tạo nhưng chưa bị xóa do policy filesystem của môi trường.

## 6. Brief giao cho Astra

> Đọc `docs/ASTRA_AUDIT_HANDOFF.md` trước, sau đó ở **pha 1** kiểm chứng từng
> claim bằng source/test/command/staging evidence mà không sửa code. Phân tách
> rõ `Đã xác minh`, `Thiếu/lỗi` theo Critical/Required/Optional/Nit, `Đề xuất`
> và `Ngoài phạm vi`. Khi đã lập findings, Astra có thể chuyển sang **pha 2**
> để hoàn thiện: mỗi source fix phải chạy GitNexus `impact` upstream trước,
> RED → GREEN → lint/typecheck → browser/regression; nếu HIGH/CRITICAL phải
> dừng và báo owner. Không mutation D1/R2 nếu chưa có fixture/rollback, không
> deploy production và không đọc/in secret. Kết quả cuối phải có system map,
> route/capability matrix, contract matrix, risk register, cleanup queue,
> test/QA matrix, evidence paths và quyết định production readiness.

## 7. Second-pass review của controller

Đây là các điểm cần evaluator xác nhận trên dirty diff hiện tại. Vòng mới đã
đối chiếu trực tiếp source/parser/config và test output; chưa tự sửa source vì
các file đó là thay đổi người dùng:

1. `package.json` mở rộng `test:admin` bằng nhiều test mới; các test/source
   untracked phải được đưa đủ vào change card/commit. Preflight chỉ đếm và
   báo ownership, không tự stage hay commit thay owner.
2. Đã giải quyết trong snapshot hiện tại: sample CSV ở
   `src/components/admin/AdminProductImportPanel.tsx:27` có cùng số cột với
   header; `scripts/admin-product-import-sample-data.test.mjs` kiểm tra cả
   shape và chạy qua parser. Astra vẫn phải giữ regression này khi refactor.
3. Đã giải quyết trong snapshot hiện tại: `confirmSelectPage` tại
   `src/components/admin/AdminPageBuilder.tsx:135-139` reset `pendingPage`;
   `scripts/admin-page-publish-guard.test.mjs` giữ contract source-level.
4. `src/lib/site-markup.ts:4` có khoảng trắng thừa trong `let   result` — không
   đổi hành vi nhưng nên dọn trong cùng change card nếu chủ dự án xác nhận.
5. `src/lib/captured-markup.ts:48` mới loại `<script>`; các capture tương lai
   lấy từ nguồn không tin cậy vẫn cần bảo đảm không có event-handler inline,
   `javascript:` URL hoặc CSS nguy hiểm trước khi đi vào các điểm
   `dangerouslySetInnerHTML` ở `src/components/CapturedPage.tsx:29`.
6. `replaceContactInfo` trong `src/lib/site-markup.ts` bám vào chuỗi legacy
   cụ thể. Nếu capture đổi dấu câu/nội dung, setting có thể không cập nhật mà
   không báo lỗi; nên có selector ổn định hoặc fixture/contract phát hiện drift.
7. `src/lib/contact-webhook.ts:333` ghi raw `Error` khi rate limiter fail-open;
   limiter lỗi vẫn cho request đi tiếp. Cần quyết định fail-open/fail-closed,
   mã hóa log an toàn, và chứng minh Turnstile nếu muốn nhận abuse control là
   production-ready.
8. Phạm vi đang mâu thuẫn: master plan giữ request queue ở Google Sheet và
   yêu cầu quyết định riêng trước D1 inbox (`CLOUDFLARE_NATIVE_V1_PLAN.md:72-84,105`),
   nhưng file map/code đã có D1 lead inbox và `/admin/yeu-cau`
   (`ADMIN_VISUAL_FILE_MAP.md:480,508`). Cần owner chốt scope trước khi Astra
   chấm contract hoặc production readiness.
9. Hai migration cùng prefix `0004` là rủi ro thứ tự/đánh giá tính determinism.
   Local và staging remote chưa có pending migration theo Wrangler, nhưng
   không được rename migration đã apply chỉ để làm đẹp lịch sử.
10. Workflow deep-QA đã chuyển sang custom staging origin, trong khi các
    workflow one-time còn workers.dev. Phải đánh dấu workflow lịch sử hoặc
    đồng bộ origin trước khi dùng làm evidence.
11. `wrangler.jsonc` khai báo production route/binding trong khi plan vẫn nói
    defer production activation. Evaluator phải kiểm tra deployed version,
    Access boundary và route thực tế; không suy ra production đã an toàn từ
    file config.
12. CSV UI đã được ghi nhận trong `CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`; Astra
    vẫn phải kiểm tra parity giữa CSV parser, JSON boundary và browser UX.
13. Turnstile hiện được ghi nhất quán là helper/binding tồn tại nhưng form
    chưa gửi token trong `CLOUDFLARE_CURRENT_STATE.md` và
    `CLOUDFLARE_DEPLOYMENT.md`; không tuyên bố abuse control production-ready
    nếu chưa có wiring/runtime evidence.
14. `npm ls --depth=0` vẫn báo hai package extraneous; xác minh lại bằng clean
    install trước khi xoá hoặc sửa lockfile.
15. Đã có browser evidence staging cho admin history/nested unsaved guard
    (`9/9`, read-only), nhưng chưa có evidence đầy đủ cho role/storage-state
    matrix, mọi domain D1/R2 read-back, backup/restore, rollback hoặc
    production promotion. Verdict vẫn là `NO-GO` cho release/production và
    `CONDITIONAL` cho việc bàn giao Astra.
16. History runtime case giữ khoảng chờ `250ms` giữa hai `pushState` cùng trang
    để React/Next kịp settle. Khi cố tình gọi hai `pushState` liên tiếp không
    chờ, Next có thể ghi đè entry sau; đây là caveat cần Astra tái hiện/đánh
    giá nếu có flow programmatic navigation nhanh, không được coi là đã đóng
    bằng test click thông thường.

`git diff --check` không phát hiện whitespace error. Vòng chuẩn bị này chỉ bổ
sung preflight, cập nhật handoff/index và bảo toàn các source change guard đã
được kiểm thử; các lỗi còn lại là queue để owner/evaluator xử lý.

Trước khi commit bất kỳ source fix nào, phải chạy GitNexus `impact` upstream
trên từng symbol; trước commit phải chạy `detect_changes()` và kiểm tra scope.

Không có mục nào ở trên là giấy phép tự revert/xóa thay đổi hiện tại. Mỗi mục
phải có owner, bằng chứng và quyết định giữ/sửa/bỏ trong change card.

## 8. Staging release và browser evidence — 2026-09-08

### Đã xác minh trong release này

- Đã build và deploy đúng environment staging bằng `npm run cf:build:staging`
  và `npm run cf:deploy:staging`; Worker là `giacong-vn-staging`, version hiện
  tại `182` (`53ab71f4-d211-4e24-a8c4-981172bd095b`), rollback point gần nhất
  là version `181` (`5b61db25-0d31-4cda-a0cc-dcb47365935b`). Không deploy
  production.
- Fix dropdown desktop đã lên staging tại
  `https://staging.kienhieu.id.vn/`: cả `Sản phẩm` (`#menu-item-1742`) và
  `Dịch vụ` (`#menu-item-5166`) mở được khi hover; `Escape` khi con trỏ vẫn ở
  trigger đặt `data-dropdown-dismissed="true"` và computed style là
  `opacity: 0`, `visibility: hidden`, `pointer-events: none`; re-entry bằng
  pointer xoá marker và mở lại menu.
- Mobile viewport `390×844` vẫn mở/đóng được menu (`clone-menu-open`,
  `clone-menu-backdrop-open`), accessibility tree chuyển `Menu` sang
  `expanded` và trở lại bình thường khi đóng.
- Sau reload staging storefront, browser console `warn/error` là `[]`; admin
  staging cũng không có `warn/error`. Network có 872 event, không có HTTP
  response từ 400 trở lên; có một Next router prefetch bị browser huỷ với
  `net::ERR_ABORTED` (request `GET /gui-yeu-cau?_rsc=...`, `canceled: true`),
  không phải response failure.
- Local regression vẫn giữ: commerce `82 pass / 0 fail`, admin `344 pass`,
  ESLint exit `0`, build compile + TypeScript + static pages `27/27`, và
  `git diff --check` exit `0`.

### Chưa kiểm / điều kiện release

- Browser staging pass này chỉ đọc và kiểm UI; chưa thực hiện save/write,
  read-back D1/R2, failure/retry, role matrix hoặc Access owner handoff.
- Chưa có drill backup/restore, rollback runtime, production route/Access
  promotion; Turnstile token wiring và hai package extraneous vẫn cần clean
  install/owner xác nhận.
- Verdict: **staging acceptance = CONDITIONAL**; **production = NO-GO** cho
  đến khi các mục trên có evidence, owner và rollback plan tương ứng.

## 9. Conditional closure audit — 2026-09-09

### Cloudflare release identity và binding evidence

- Nguồn Cloudflare `wrangler versions view` xác nhận version staging `182` có
  UUID đầy đủ `53ab71f4-d211-4e24-a8c4-981172bd095b`, được tạo lúc
  `2026-09-08T14:15:10.35475Z`, có handler `fetch` và `queue`.
- `wrangler deployments list --env=staging --name=giacong-vn-staging --json`
  xác nhận deployment `191664d8-b07d-4e1c-a425-a24bd0972c77` đang route `100%`
  tới version 182. Rollback point thực tế ngay trước đó là deployment
  `48b54975-cb76-4520-8c86-9a60f65de11f`, version UUID đầy đủ
  `5b61db25-0d31-4cda-a0cc-dcb47365935b`, cũng từng ở `100%`.
- Version view xác nhận bindings staging: D1 `GIACONG_VN_CATALOG` với database
  `981b5d5e-bba9-4f7e-9e1e-a15e379cd095`, R2 product media/cache staging,
  queue `giacong-vn-leads-staging`, rate-limit namespaces `2001/2002`,
  `ADMIN_PUBLIC=false` và Access audience/team domain staging. `wrangler d1
  migrations list giacong-vn-catalog-staging --env=staging --remote` trả
  `No migrations to apply!`.
- Có một drift cần owner xử lý trước production: version đã deploy còn binding
  plain-text `ADMIN_PUBLIC_SUBJECT=public-demo`, trong khi `ADMIN_PUBLIC=false`
  và biến này không còn trong `wrangler.jsonc`. Drift hiện không bypass Access
  vì nhánh public bị tắt, nhưng phải được dọn hoặc ghi nhận chấp thuận rõ ràng;
  không suy ra production-safe từ cờ `false` alone.
- Live host smoke đã pass cho storefront staging và Access login boundary của
  admin. Account-level route inventory qua API chưa được truy xuất trong lượt
  này; đây là giới hạn riêng của evidence, không phải claim route coverage đầy
  đủ.

### Write/read-back evidence trên staging fixture

- Trước lượt kiểm tra, fixture `brand_tagline` được đọc và ghi lại về trạng
  thái sạch từ D1 staging: `draft_value = published_value = "Giải pháp gia
  công toàn diện"`, `version = 14`, `dirty_count = 0`, `changes = 0` và
  `rows_written = 0`. Sau khi phiên Access hết hạn, không tạo hoặc retry thêm
  fixture nào.
- Với marker staging-only `QA-LUNA-STAGING-20260908-DRAFT`, UI đã save draft
  và reload đọc lại đúng marker ở version 13; marker không được publish ra
  storefront. Giá trị gốc sau đó được lưu lại qua UI, reload đọc đúng giá trị
  gốc ở version 14 và không còn dirty draft.
- Input text dài 1001 ký tự bị API từ chối với thông báo giới hạn nội dung; số
  version không tăng. Hai click gần như đồng thời lên `Lưu nháp` tạo đúng một
  `PATCH` và một response `200`. Replay cùng payload/request ID qua same-origin
  browser request trả `200` idempotent; cùng request ID với payload khác trả
  `409 IDEMPOTENCY_CONFLICT`; audit/read-back không tạo bản ghi mutation thứ
  hai. Không đọc hoặc trích xuất cookie/token.
- Replay trên đây là kiểm tra contract cho thao tác `Lưu nháp`, không né một
  confirmation dialog của thao tác publish. Mọi thao tác fixture chính đều đi
  qua UI; chỉ request replay được chạy trong cùng browser origin để kiểm tra
  đúng semantics của retry/idempotency.

### Bảng nghiệm thu hiện tại

| Tiêu chí | Trạng thái | Bằng chứng | Giới hạn / việc còn lại |
| --- | --- | --- | --- |
| Version/rollback identity staging | **PASS** | Cloudflare `versions view` + `deployments list`, UUID và deployment 100% ở trên | Chưa thực hiện rollback live trong lượt này |
| Binding D1/R2/queue/rate-limit staging | **PASS** | Cloudflare version resources, D1 migrations không pending | Account-level route inventory chưa lấy qua API |
| Drift cấu hình `ADMIN_PUBLIC_SUBJECT` | **FAIL / REVIEW** | Có trong version deployed, vắng trong `wrangler.jsonc`; `ADMIN_PUBLIC=false` | Owner phải dọn hoặc phê duyệt explicit trước production |
| Desktop/mobile storefront menu | **PASS** | Hover/Escape/re-entry, mobile 390×844, console/network sạch | Không thay thế full storefront acceptance |
| Draft/save/read-back fixture | **PASS** | Marker QA, reload read-back, restore exact original, D1 dirty count 0 | Fixture dùng setting QA staging hiện hữu, không phải row mới riêng |
| Invalid input | **PASS** | 1001-char text nhận validation error, không tăng version | Chưa lập matrix validation mọi domain |
| Saving guard / retry / idempotency | **PASS** | Double-click chỉ một PATCH; replay 200; conflict 409; audit không nhân đôi | Chưa fault-inject 5xx/timeout qua live network |
| Access owner identity | **PASS** | Owner UI hiển thị `qtu1053@gmail.com`, `Admin toàn quyền`; self-disable bị khóa | Chỉ có một owner staging |
| Unauthenticated admin boundary | **PASS** | Tab mới vào màn hình Cloudflare Access, không vào admin payload | Chưa kiểm mọi edge/preview hostname |
| Nhiều role/identity | **NOT TESTED** | D1 inventory chỉ có một active owner | Không tự tạo tài khoản/quyền mới; cần owner cung cấp identity nếu muốn test |
| Backup/export + local restore drill | **PASS** | Artifact production đã checksum/restore-drill; local sandbox export/import 31 bảng, `integrity_check=ok`, foreign-key check 0 | Không restore production remote |
| Current-version rollback smoke | **NOT TESTED** | Rollback point thực đã xác định; lịch sử có drill staging trước đó | Không rollback live chỉ để demo; cần cửa sổ owner phê duyệt |
| Production data/migrations/promotion | **FAIL / NO-GO** | Production data approval, migrations `0009–0019`, promotion chưa được owner duyệt | Production Worker/D1/R2 giữ nguyên |
| Observability 24h / DLQ | **NOT TESTED** | Observability binding tồn tại | Cần cửa sổ vận hành và owner xác nhận |

### Runbook an toàn cho bước còn lại

1. Trước mọi staging write, đọc đúng row bằng D1 remote read-only; chỉ tiếp tục
   nếu `draft = published`, version và marker khớp expected. Dùng marker có
   prefix QA và không publish marker.
2. Save qua UI, reload/read-back, kiểm tra audit/request ID và post-condition;
   với retry chỉ replay cùng request ID/payload, không tạo request mới ngầm.
   Restore đúng giá trị gốc qua UI và xác nhận `dirty_count = 0` trước khi kết
   thúc.
3. Nếu có incident Worker staging, owner phê duyệt trước khi chạy
   `npx wrangler rollback 53ab71f4-d211-4e24-a8c4-981172bd095b --env=staging
   --name=giacong-vn-staging -y`; sau đó smoke public/admin, đọc lại D1
   migrations, rồi mới phân loại có cần đưa version 182 trở lại 100% hay không.
   Không dùng rollback live làm bài demo.
4. Với data recovery, export production ngay trước migration window vào artifact
   được owner quản lý; restore chỉ trên bản sao cô lập, chạy
   `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, kiểm migration và
   row counts. Không chạy `d1 execute --remote --file` cho production khi
   chưa có approval, cửa sổ rollback và backup hash mới.

### Verdict

- **Staging technical evidence: PASS có giới hạn**; fixture đã hoàn nguyên và
  không còn dirty state.
- **Release handoff: CONDITIONAL** vì config drift, account-level route
  inventory, live rollback smoke, nhiều identity và observability 24h còn mở.
- **Production: NO-GO**. Không có production deploy, migration, D1/R2 restore
  hoặc data mutation trong lượt này.

## 10. Route inventory follow-up — 2026-09-09

- Read-only Cloudflare API `GET /zones/{zone_id}/workers/routes` trên zone
  `kienhieu.id.vn` (`46dacfca94df32f628b04d77515620d7`) trả đúng bốn route:
  `kienhieu.id.vn/*` và `admin.kienhieu.id.vn/*` → `giacong-vn`;
  `staging.kienhieu.id.vn/*` và `admin-staging.kienhieu.id.vn/*` →
  `giacong-vn-staging`. Không có route dư trong zone ở thời điểm kiểm tra.
- Bốn route runtime khớp chính xác với hai danh sách `routes` production/staging
  trong `wrangler.jsonc`. Bằng chứng này thay thế giới hạn “chưa lấy
  account-level route inventory qua API” ở mục 9; không phải thay đổi route.
- Test boundary admin chạy lại: `7 pass / 0 fail` cho hostname/origin,
  public-mode fail-closed, same-origin mutation và Access JWT admission.
- `ADMIN_PUBLIC_SUBJECT=public-demo` vẫn là **FAIL / REVIEW**: binding còn
  trong version 182 nhưng vắng khỏi config; `ADMIN_PUBLIC=false` làm nhánh này
  dormant, không chứng minh việc giữ biến là cấu hình chấp thuận. Cần owner
  quyết định dọn binding hoặc ghi nhận phê duyệt trước production; lượt này
  không sửa Access/Worker variable từ xa.

### Cập nhật verdict

- **Route inventory staging/production: PASS** ở thời điểm truy vấn; route
  production chỉ được kiểm kê, không được deploy hay mutate.
- **Release handoff: CONDITIONAL** vẫn giữ nguyên do config drift, live
  rollback smoke, nhiều identity và observability 24h còn mở.
- **Production: NO-GO**. Không có production deploy, migration, route change,
  hoặc data mutation trong lượt follow-up này.

## 11. Browser evidence artifact follow-up — 2026-09-09

### Artifact và phạm vi

- Browser session đã xác minh trực tiếp version staging `182`
  (`53ab71f4-d211-4e24-a8c4-981172bd095b`) trên public host và admin host.
  Bằng chứng máy đọc được nằm trong
  [`browser-evidence.json`](handoff-references/staging-v182-2026-09-09/browser-evidence.json);
  transcript đã lọc nằm trong
  [`browser-evidence.md`](handoff-references/staging-v182-2026-09-09/browser-evidence.md).
- Hai observation card SVG là ảnh tổng hợp từ DOM/computed-style samples:
  [`menu-escape-observation.svg`](handoff-references/staging-v182-2026-09-09/menu-escape-observation.svg)
  và [`r1-guard-observation.svg`](handoff-references/staging-v182-2026-09-09/r1-guard-observation.svg).
  CUA đã hiển thị screenshot live trong lúc capture; raw raster không được
  export ra workspace để tránh nhầm observation card với screenshot gốc.
- Không có save/write, upload, cookie/token/storage export, deployment hoặc
  production mutation trong lượt này.

### Kết quả runtime đã lọc

- **Public menu Escape/re-entry: PASS giới hạn**. Cả `Sản phẩm` và `Dịch vụ`
  đều đặt marker dismissal, tắt pointer-events trong transition và về
  `opacity=0 / visibility=hidden`; pointer exit rồi re-entry xoá marker và
  mở lại. Transition edge đã được lấy mẫu ở `t+50ms` và `t+400ms`, không tái
  hiện lỗi “chỉ visibility mà opacity không chạy”.
- **R1 sidebar/back/forward: PASS**. Dialog hiện đúng, URL editor giữ nguyên
  khi chọn `Ở lại`, và `Bỏ thay đổi` unmount editor về danh sách tin tức.
- **Nested variant/media: PASS** cho parent cancel guard và discard; không
  lưu synthetic draft.
- **Query/hash: LIMITATION**. Guard và `Ở lại` đúng; sau `Bỏ thay đổi`, URL về
  `?tab=a#alpha` nhưng editor cùng trang vẫn còn `Chưa lưu` và synthetic value.
  Không gọi case này là acceptance pass; cần follow-up riêng.
- **Public runtime: PASS có giới hạn** — 0 console warn/error, không có HTTP
  response `>=400`; có một Fetch bị browser huỷ `net::ERR_ABORTED`.
- **Admin runtime: NOT CLEAN / REVIEW** — không có HTTP response `>=400`, có
  hai Fetch bị huỷ và một console error đã lọc là `AbortError: Transition was
  skipped` trong chuỗi reload/navigation. Không sửa code trong lượt artifact-only.

### Cập nhật phân loại

- `ADMIN_PUBLIC_SUBJECT` khi `ADMIN_PUBLIC=false` là **config hygiene / owner
  review**, không phải functional staging blocker.
- Staging handoff vẫn **CONDITIONAL** vì query/hash limitation, admin runtime
  signal, rollback smoke, identity thứ hai và observability 24h.
- Production vẫn **NO-GO**; không có production deploy hoặc mutation.

## 12. Same-route history discard fix — 2026-09-09

### Nguyên nhân và thay đổi

- Gap query/hash đã được xác nhận là bug theo hợp đồng “Bỏ thay đổi phải bỏ
  mọi draft đang hiển thị”: `AdminShell` chỉ cho `history.go()` tiếp tục khi
  discard, trong khi cùng pathname không làm page con unmount; state draft
  local vì thế còn nguyên.
- Regression test đã được thêm vào
  `scripts/qa-admin-history-runtime.mjs` cho query/hash discard và contract
  test trong `scripts/admin-shell-unsaved-guard.test.mjs`.
- Sửa tối thiểu trong `src/components/admin/AdminShell.tsx`: đánh dấu pop
  được xác nhận là discard; nếu pathname nguồn/đích giống nhau thì tăng
  `Fragment key` để remount children. “Ở lại” và discard khác-route không đổi
  semantics.

### Kiểm tra và staging

- RED trước sửa: focused guard test `12 pass / 1 fail` đúng tại case same-route
  discard.
- GREEN sau sửa: `node --test scripts/admin-shell-unsaved-guard.test.mjs`
  `13 pass / 0 fail`; ESLint các file chạm không có diagnostic; TypeScript
  compiler trả `TSC_EXIT:0`; `git diff --check` trả `0`.
- Đã deploy **chỉ staging** `giacong-vn-staging`, version UUID
  `a55905f0-a544-4fde-bdf8-afcba3d3739d`, deployment hoàn tất 100%. Rollback
  point đã biết là version trước `53ab71f4-d211-4e24-a8c4-981172bd095b`.
- CUA approved Chrome sau deploy đã xác minh route-level dirty guard vẫn hiện
  đúng; `Bỏ thay đổi` từ `/admin/noi-dung` về `/admin/tin-tuc` unmount page và
  không lưu draft. Không có backend write, upload hoặc credential export.

### Giới hạn live còn lại

- Ca query/hash stay/discard chưa được tái chạy live trên version mới: browser
  bridge không expose `window.history`, còn harness Playwright yêu cầu
  `QA_ADMIN_STORAGE_STATE`. Không dùng `goto` reload để thay thế ca này vì sẽ
  làm mất draft trước khi guard chạy.
- Vì vậy staging verdict sau fix là **CONDITIONAL / live same-route pending**;
  production vẫn **NO-GO**.

## 13. Admin confirm modal readability fix — 2026-09-09

### Nguyên nhân và thay đổi

- `AdminConfirmDialog` được render sibling với `.admin-app`, trong khi design
  tokens và các style nút destructive/quiet đều scope dưới `.admin-app`. Vì
  vậy panel nhận `var(--admin-surface)` không resolve và hiển thị translucent,
  khó đọc.
- `src/components/admin/AdminDialog.tsx` giờ gắn `admin-app` lên chính
  `admin-modal-overlay`, khôi phục token, font, focus ring và button scope cho
  mọi modal dùng chung primitive. Không đổi API, nội dung hoặc z-index.

### Kiểm tra và staging

- RED: contract test mới trong `scripts/admin-ui-system.test.mjs` fail `14
  pass / 1 fail`; GREEN: `15 pass / 0 fail`.
- TypeScript `TSC_EXIT:0`, ESLint không có lỗi, `git diff --check` trả `0`.
- Đã deploy **chỉ staging** `giacong-vn-staging`, version UUID
  `ae07fbb3-7a59-4681-b453-89c0eb012723`; rollback point là version trước
  `a55905f0-a544-4fde-bdf8-afcba3d3739d`.
- Không thể chụp live modal sau deploy vì phiên Cloudflare Access đã hết hạn;
  không nhập email/OTP. Browser QA live cần owner mở lại SSO session.

Staging verdict vẫn **CONDITIONAL** (live modal/query-hash còn chờ phiên
Access); production vẫn **NO-GO**.

## 14. Nested navigation hard-bound và staging runtime — 2026-09-10

- Gate đầy đủ bắt một regression thật sau khi thêm nested reader: danh sách
  admin đã bỏ hard bound. Sửa tối thiểu giữ `LIMIT 100` cho list thường và
  đọc kết quả bulk theo đúng các ID đã audit (tối đa 100), đồng thời kiểm tra
  parent draft/published trong postcondition.
- Regression focused sau sửa: `42/42` pass cho request bound, persistence
  atomicity/rollback, bulk 101-row boundary, nested graph, API contract và
  reader/render contract. `npm run lint` và `npm run typecheck` pass; build
  tạo đủ 27/27 route. Lần chạy `npm run check` trước sửa đã chứng minh lỗi
  `admin collection read models enforce an explicit hard bound`; lần chạy
  sau sửa đi qua toàn bộ test suite và build output, nhưng process Windows
  không tự thoát sau build nên không ghi nhận exit code cuối.
- Staging chỉ: migration `0021_navigation_nested_items.sql` đã apply, không
  còn migration pending. Worker `giacong-vn-staging` version hiện hành
  `bda9eb54-7cb0-41ee-9a70-fe9862f3d670` (100% traffic), rollback point là
  `40fddaba-9880-4efd-b7f6-066a6aaa2206`.
- Public QA sau deploy: captured `3/3`, catalog `2/2`, cart `1/1`, và
  `DEEP QA PASSED` cho responsive/status/overflow/search/sort/filter/detail/
  localStorage cart/request/keyboard. Admin Chrome owner thật đã xác nhận
  selector parent cùng menu và publish tạm child dưới `Sản Phẩm`; storefront
  render đúng child, sau đó child được lưu/publish khôi phục inactive.
- D1 sau restore: hai fixture nested vẫn `draft_parent_id =
  published_parent_id` đúng parent và `draft_is_active = published_is_active
  = 0`; bản product ở version `13`, service ở version `5`. Console admin sau
  round-trip không có `warn/error`.

Staging vẫn **CONDITIONAL** cho các cổng production còn lại (query/hash live
unsaved-flow, identity thứ hai, rollback drill có chủ đích và observability
24h); production vẫn **NO-GO**.

## 15. Product/news owner E2E round-trip — 2026-09-10

- Dùng đúng hai fixture staging đã có, không tạo record mới và không chạm
  production: product `id=14`, slug `mon-thu-cua-toi-qa-sua-0904` (archived,
  revision `3` trước phép thử) và news `id=2`, slug `bai-thu-0409` (draft,
  revision `3` trước phép thử).
- Product UI thật trên Chrome owner: mở form → sửa mô tả ngắn bằng marker QA →
  lưu draft → reload admin và đọc lại marker → bật `Đã xuất bản` + hiển thị →
  đọc lại storefront tại slug canonical → đổi lại mô tả/trạng thái gốc qua UI.
  D1 sau hoàn nguyên: product `is_active=0`, `status=archived`, nội dung gốc,
  revision `7`; audit giữ đủ các chuyển tiếp `3→4→5→6→7`.
- News UI thật trên Chrome owner: sửa title/excerpt/content bằng marker QA →
  lưu draft → reload admin → `Phát hành` → đọc lại storefront tại
  `/tin-tuc/bai-thu-0409` → sửa lại draft gốc → publish một lần để đồng bộ
  `published_*` gốc → `Ẩn khỏi web`. D1 sau hoàn nguyên: `is_published=0`,
  draft và published fields đều về nguyên bản, revision `10`; audit có các
  operation `draft`, `publish`, `unpublish` với revision liên tục. Metadata
  `published_at` giữ timestamp của lần publish QA gần nhất vì UI không có
  thao tác khôi phục timestamp; không dùng raw D1 để sửa lịch sử.
- HTTP read-back sau hoàn nguyên: product endpoint trả `200` nhưng không còn
  marker; news detail trả `404`; `/tin-tuc` trả `200` và không còn marker.
  Không còn QA content công khai.
- **Validation gate chưa đạt bằng chứng sạch**: thao tác submit với title/name
  rỗng không cho thấy field-level error ổn định; request vẫn tạo revision nhưng
  giữ nội dung cũ. Cần tách regression nhỏ cho client/server validation trước
  production, không coi đây là PASS.

Staging vẫn **CONDITIONAL**; production vẫn **NO-GO**. Các revision/audit tăng
là lịch sử hợp lệ của phép thử staging; content/state hiện tại đã hoàn nguyên,
nhưng `published_at` của news là metadata QA còn lưu.
