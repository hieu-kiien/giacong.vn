# Mô hình team subagent cho Giacong.vn

> Trạng thái: operating model đề xuất, dùng cùng [ADMIN_VISUAL_ROADMAP.md](./ADMIN_VISUAL_ROADMAP.md) và [ADMIN_VISUAL_FILE_MAP.md](./ADMIN_VISUAL_FILE_MAP.md).
>
> Mục đích: tổ chức nhiều agent như một đội phát triển chuyên nghiệp để hoàn thành Lean V1 và Visual Admin theo từng lát nhỏ, có ownership, bàn giao, review và bằng chứng chấp nhận rõ ràng.

## 1. Kết luận điều hành

Đây không phải dự án xanh hoàn toàn. Nền tảng hiện tại đã có storefront, catalog,
request cart, admin control plane, Cloudflare Access, D1/R2, draft/publish, host-
gated visual context, contextual settings editor, product bulk import và
product/service archive batch. Phần còn thiếu là staging/admin evidence, visual
renderer parity, các batch domain còn lại và hardening/release.

Mô hình phù hợp nhất là:

```text
Product owner / người quyết định cuối
                |
       Control Tower / Tech Lead agent
                |
  +-------------+-------------+-------------+
  |                           |             |
Product & UX             Platform/Data   Experience
  |                       & Security      (storefront/admin)
  +-------------+-------------+-------------+
                |
          Quality & Release
                |
          Review board độc lập
```

Không vận hành theo kiểu mọi agent cùng mở và sửa một worktree. Mỗi lát có một owner chịu trách nhiệm đến cùng; các agent khác nghiên cứu song song hoặc review độc lập, sau đó bàn giao qua artifact và gate.

### Mục tiêu vận hành

- Mỗi quyết định đều truy ngược được về plan, contract, file map hoặc bằng chứng runtime.
- Backend contract và test được khóa trước khi frontend gọi API.
- Admin thân thiện với người ít chuyên môn nhưng vẫn có quyền sâu, bulk action và trang đặc biệt khi thật sự cần.
- Public storefront không bị rò quyền, dữ liệu draft hoặc control admin.
- Không merge một lát nếu chưa có test, review, `detect_changes()` và bằng chứng staging tương ứng.
- Không mở rộng sang Bagisto, customer account, checkout, payment, order hoặc page builder arbitrary HTML/CSS/JS.

## 2. Nghiên cứu đã dùng để lập mô hình

### 2.1 Nguồn quyết định theo thứ tự ưu tiên

1. `docs/CLOUDFLARE_NATIVE_V1_PLAN.md` — nguồn quyết định sản phẩm và kiến trúc hiện hành.
2. `docs/CLOUDFLARE_CURRENT_STATE.md` — bằng chứng runtime, staging, binding và các việc còn mở.
3. `docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md` — security, validation, version, idempotency, audit, media và UI gate.
4. `docs/ADMIN_VISUAL_FILE_MAP.md` — ownership file, route, domain, region và test.
5. `docs/ADMIN_VISUAL_ROADMAP.md` — thứ tự MVP, gate và Definition of Done.
6. Source code, test scripts, CI và GitNexus — cách hệ thống thật sự chạy.
7. Các branch lịch sử — chỉ là nguồn để harvest work, không được xem là source of truth thay cho `master`.

Nếu hai tài liệu hoặc branch mâu thuẫn, Control Tower phải dừng lát đang làm, ghi quyết định, hỏi người quyết định sản phẩm khi cần và cập nhật nguồn hiện hành trước khi code tiếp.

### 2.2 Bức tranh kỹ thuật đã xác minh

GitNexus hiện lập chỉ mục repo `giacong.vn` với khoảng 532 file, 3.630 symbol,
9.209 quan hệ và 257 execution flow; index phải được refresh sau mỗi lát merge.
Đây là codebase đủ lớn để cần phân vai và call-graph review, nhưng chưa lớn đến
mức cần một bộ máy nhiều tầng nặng nề.

Các trục chính:

| Trục | Hiện trạng | Ý nghĩa tổ chức |
| --- | --- | --- |
| Public storefront | captured route, shared shell, settings/navigation adapter, catalog/service/news render | Experience team phải bảo vệ public behavior và visual fidelity |
| Admin boundary | `AdminShell`, session, Access/JWT, role/capability, API guard | Security/Platform owner duyệt mọi thay đổi quyền hoặc boundary |
| Data/runtime | D1 canonical catalog/content, R2 media, migrations, audit/revision | Backend/Data phải khóa invariant và rollback trước UI |
| Admin UI | CRUD cho catalog, service, news, media, pages, navigation, members, leads | Có thể tái dùng primitive hiện tại; không dựng lại dashboard từ đầu |
| Visual admin | host/session context và editor MVP cho brand/hero đã vào `master`; chưa phải renderer parity đầy đủ | Mở thêm region chỉ khi có source, capability và browser evidence |
| Bulk | product import, product archive và service archive batch đã vào `master`, mỗi lát atomic/idempotent/audited, giới hạn riêng 50/100 item | Batch domain khác chỉ mở sau contract riêng; không tạo generic bulk framework sớm |
| Quality/release | test scripts, lint, typecheck, build, Wrangler/OpenNext và staging workflows đã có | QA/Release dùng pipeline hiện tại, không tự tạo pipeline song song |

### 2.3 Các hub rủi ro cao cần được bảo vệ

- `requireAdmin` và `admin-access-runtime` có fan-out tới nhiều route admin; sửa ở đây phải impact analysis và security review.
- `AdminShell`, `AdminPrimitives`, `fetchAdmin` là dependency chung của nhiều trang; không cho hai agent sửa đồng thời.
- `CapturedStorefrontShell`, captured home/page và markup adapter ảnh hưởng nhiều route public; mọi thay đổi phải có visual/runtime regression.
- Site settings, navigation, pages publish, audit và migration có tính liên kết; không tách “UI trước, data sau”.
- Route map có chỗ không nhận diện được consumer do fetch động; `consumers: []` không được dùng làm bằng chứng rằng route bị bỏ mồ côi.

### 2.4 Workstream tiềm ẩn trong các branch

Lát `codex/bulk-product-import` đã được harvest thành các commit nhỏ trên
`master`, sau khi kiểm tra capability, giới hạn body, request id/idempotency và
all-or-none semantics. Phần cần tiếp tục là browser/admin staging evidence và
batch cho domain khác; không merge nguyên branch cũ.

Các branch hardening, self-hosted staging gates và performance có giá trị tham khảo nhưng phân kỳ lớn với `master`. Team phải “harvest theo change card, rebase trên baseline hiện tại, test lại”, không merge nguyên branch theo cảm tính.

## 3. Cấu trúc đội đề xuất

### 3.1 Control Tower — bộ điều phối trung tâm

Đây là một vai trò điều phối, không phải một agent viết tất cả code.

**Chịu trách nhiệm:**

- giữ scope Lean V1 và thứ tự P0–P6;
- tạo task packet, chọn owner, xác định dependency và WIP limit;
- duy trì `ADMIN_VISUAL_FILE_MAP.md`, roadmap và decision log;
- quyết định khi nào được tách task, khi nào phải nối tiếp;
- gọi GitNexus query/context/impact trước khi cho phép sửa code;
- tổng hợp review, evidence và quyết định release;
- báo cáo rõ `verified`, `missing/bug`, `proposal`, `out of scope`.

**Không làm:** tự bỏ qua contract, tự hạ mức rủi ro, gộp các branch lớn mà không rebase/review, hoặc tuyên bố “đã xong” chỉ vì build pass.

### 3.2 Product & UX cell

| Vai trò | Ownership | Đầu ra bắt buộc |
| --- | --- | --- |
| Product/Scope agent | user journey, scope, acceptance, ưu tiên MVP | brief tiếng Việt, user story, acceptance theo hành vi |
| Information architecture agent | nav admin, tên menu, bulk flow, trang đặc biệt | IA map, label glossary, empty/error/help copy |
| Visual UX agent | storefront context, region affordance, responsive, accessibility | wire/interaction spec, trạng thái hover/focus/loading/stale |

Cell này không tự quyết thêm domain ngoài plan. Với admin, quy tắc là: nút contextual là primary; toolbar nhỏ chỉ dùng cho action toàn cục; bảng/back-office mới là nơi chứa filter, bulk và workflow phức tạp.

### 3.3 Platform, Backend & Data cell

| Vai trò | Ownership | File/domain chính |
| --- | --- | --- |
| Architecture/Contract agent | API envelope, auth, capability, version, idempotency, audit | `src/lib/admin-*.ts`, write contract, route contract |
| Cloudflare backend agent | route handler, D1/R2 adapter, server mutation | `src/app/api/admin/**`, `src/lib/**`, `custom-worker.ts` |
| Data/Migration agent | migration, index, seed, invariant, rollback | `migrations/**`, D1 scripts, data evidence |
| Security/Access agent | hostname, Access JWT, origin, public isolation, secret boundary | `admin-access*`, `admin-guard*`, deployment/access config |

Backend/Data là gate bắt buộc trước UI. Mỗi mutation phải trả lời được: actor nào được làm, payload nào hợp lệ, revision nào được dùng, retry ra sao, audit gì được ghi, và lỗi nào người dùng nhìn thấy.

### 3.4 Experience cell

| Vai trò | Ownership | File/domain chính |
| --- | --- | --- |
| Storefront renderer agent | shared renderer, captured fallback, published/draft/preview isolation | `src/app/(storefront)/**`, `src/components/site/**`, captured components |
| Admin UX agent | Admin mode, contextual controls, region editor, admin shell/page UI | `src/components/admin/**`, admin routes, visual layer dự kiến |
| Domain UI agent | product/service/news/media/page/nav/member/lead screens | component tương ứng trong file map |
| Interaction/accessibility agent | keyboard, focus, mobile, labels, non-color state, loading/error/stale | shared primitives và browser evidence |

Experience cell chỉ sửa sau khi contract card chuyển sang `UI_READY`. Không cho UI giả lập thành công bằng state cục bộ nếu server contract chưa tồn tại.

### 3.5 Quality & Release cell

| Vai trò | Ownership | Evidence |
| --- | --- | --- |
| Test/contract QA agent | RED tests, route contract, data/security regression | test script output, failure reproduction |
| Browser/visual QA agent | real browser, staging, responsive, console/network, screenshot diff | URL, viewport, screenshot, console/network result |
| Performance/accessibility agent | CWV và accessibility theo risk của lát | measurement, finding, threshold/status |
| Release/Cloudflare agent | local → staging → acceptance → production gate | build/upload/preview/deploy log, rollback note |
| Independent code reviewer | correctness, maintainability, security, scope | review report with severity and file/line |
| Simplicity reviewer | over-engineering, duplicate abstraction, unused flexibility | cut/keep recommendations |

Reviewers phải độc lập với agent vừa viết lát đó. Một reviewer không được tự chấm “pass” cho thay đổi của chính mình.

## 4. Phân bổ agent và WIP policy

### 4.1 Quy mô hoạt động khuyến nghị

Không cần chạy 15 agent liên tục. Với codebase này, cấu hình hiệu quả là tối đa
4 task/agent hoạt động đồng thời:

- 1 Control Tower luôn giữ context và quyết định;
- 1 agent Product/Architecture cho mỗi lát đang chuẩn bị;
- 1 implementer chính cho một lát đang code;
- 1 QA/reviewer độc lập sau implement;
- 1 Release agent chỉ mở khi đã có staging evidence (có thể thay QA/reviewer);
- không mở thêm agent nếu task không độc lập hoặc đang có worktree người dùng sửa.

Chỉ **một write lane cho một dependency chain**. Các task mới phải dùng chế độ
thường, không ưu tiên nhanh; nếu tạo agent thì dùng gpt-5.6-luna và chọn
reasoning theo độ khó, không tự đổi model.

### 4.2 Gợi ý model tier

Policy hiện hành khi Control Tower tạo agent:

| Công việc | Model | Reasoning |
| --- | --- | --- |
| Architecture, security, migration, release decision | gpt-5.6-luna | high |
| Backend/renderer integration | gpt-5.6-luna | medium hoặc high |
| UI mechanical work, inventory, test harness nhỏ | gpt-5.6-luna | low hoặc medium |
| Independent review | gpt-5.6-luna | medium/high, ưu tiên task độc lập |

Service tier luôn là chế độ thường; không dùng fast/priority cho agent. Không
chọn reasoning thấp cho scope, auth boundary, migration hoặc production gate chỉ
vì task trông ngắn.

### 4.3 Quy tắc worktree và file lock

- Mỗi code task độc lập chạy trong branch/worktree riêng sau khi baseline sạch và đã có commit nền.
- Một file shared chỉ có một owner đang sửa tại một thời điểm.
- Không cho parallel write vào `admin-access*`, `admin-guard*`, `admin-permissions.ts`, `AdminShell`, `CapturedStorefrontShell`, migration đang mở, `package.json` hoặc workflow cùng lúc.
- Docs-only có thể làm trong shared workspace nếu không đụng code; trước khi mở implementation phải chốt baseline/worktree.
- Không merge branch divergent nguyên khối. Tách thành change card nhỏ, rebase và kiểm tra lại trên `master` hiện tại.

## 5. Quy trình một lát phát triển

Mỗi feature phải là một vertical slice có thể chứng minh từ UI hoặc API đến D1/R2 và public result.

### Bước 0 — Intake

Control Tower tạo task packet với:

- mục tiêu người dùng;
- phase/MVP và out-of-scope;
- region/route/domain trong file map;
- owner, reviewer, dependency;
- acceptance criteria và risk hypothesis.

Task chưa có các trường này ở trạng thái `BACKLOG`, chưa được code.

### Bước 1 — Discovery read-only

Explorer agent phải đọc source quyết định, file map, route map và test liên quan; dùng GitNexus `query` để tìm flow, `context` cho symbol chính. Đầu ra là:

- execution flow hiện tại;
- file/symbol sẽ đụng;
- test hiện có;
- khoảng trống hoặc mismatch;
- câu hỏi cần quyết định.

### Bước 2 — Impact gate

Trước khi sửa bất kỳ function/class/method nào:

1. chạy GitNexus `impact({ target, direction: "upstream" })`;
2. đọc direct callers, processes và modules bị ảnh hưởng;
3. nếu HIGH/CRITICAL, báo Control Tower và người quyết định trước khi tiếp tục;
4. cập nhật risk trong task packet.

Không dùng grep thay cho impact khi thay đổi symbol. Không rename bằng find-and-replace.

### Bước 3 — Contract gate

Architecture/Backend ghi contract trước UI:

- route và method;
- request/response envelope;
- capability/role;
- validation và body limit;
- revision/stale semantics;
- idempotency;
- D1 transaction/batch và audit;
- R2 compensation/reference safety nếu có media;
- public/draft/preview behavior.

Task chuyển `CONTRACT_READY` chỉ khi các câu hỏi trên có câu trả lời hoặc được đánh dấu rõ là không áp dụng.

### Bước 4 — RED test

Test agent thêm test thất bại mô tả hành vi cần có. Test phải bao phủ cả success và failure quan trọng: unauthorized/forbidden, invalid input, stale write, duplicate/idempotency, audit và public isolation khi liên quan.

### Bước 5 — Implement backend/data

Backend/Data làm mutation, adapter, migration và route; chạy test domain. UI không được tự tạo contract khác với server.

### Bước 6 — Implement experience

Admin UX/renderer làm UI theo contract đã khóa:

- dùng primitive hiện tại;
- label tiếng Việt đời thường;
- phân biệt draft/published/preview;
- hiển thị dirty, saving, saved, stale, error và success;
- không để raw exception/code là thông báo chính;
- mobile/keyboard/focus được thiết kế từ đầu.

### Bước 7 — Integration

Chạy test track liên quan, lint, typecheck, build. Kiểm tra migration local và source-of-truth; không chỉ kiểm tra screenshot.

### Bước 8 — Browser/staging evidence

Browser QA kiểm tra URL thật trên staging, role thật, viewport chính, console/network, public isolation và visual regression. Nếu có write, phải chứng minh database/storage/audit và kết quả public sau publish.

### Bước 9 — Review và change detection

Hai review độc lập:

- quality/security review;
- simplicity/scope review.

Trước commit phải chạy GitNexus `detect_changes()` và xác nhận affected symbols/flows đúng với task. Mọi diff ngoài scope là `BLOCKED` cho tới khi giải thích hoặc loại bỏ.

### Bước 10 — Handoff

Handoff phải có:

- summary thay đổi;
- file/route/symbol;
- commands đã chạy và kết quả;
- screenshot/URL/evidence;
- migration/deploy note;
- known risks và rollback;
- việc còn lại, nếu có.

## 6. State machine và Definition of Ready/Done

### 6.1 Trạng thái task

```text
BACKLOG -> READY -> IN_PROGRESS -> REVIEW -> STAGING -> ACCEPTED -> MERGE_READY -> DONE
                         |             |          |
                         +---------- BLOCKED <----+
```

`DONE_WITH_CONCERNS` chỉ dùng khi behavior đã đạt acceptance nhưng có concern được người quyết định chấp nhận bằng văn bản. `BLOCKED` phải ghi rõ blocker, owner và điều kiện mở khóa; không dùng để che việc chưa nghiên cứu.

### 6.2 Definition of Ready

- scope và out-of-scope rõ;
- source quyết định đã đọc;
- file map/route/domain đã xác định;
- dependency và owner/reviewer đã chọn;
- impact đã chạy cho symbol có thể sửa;
- contract và role/capability đã rõ;
- test plan và acceptance có thể kiểm chứng;
- không có conflict với production safety.

### 6.3 Definition of Done

- code/test/docs nằm đúng ownership;
- server contract, validation, auth, stale/idempotency/audit đạt mức áp dụng;
- test RED đã chuyển GREEN và regression liên quan pass;
- lint, typecheck, build pass;
- browser/staging evidence đạt nếu task có UI/runtime;
- public không thấy draft/admin control ngoài ý muốn;
- labels, focus, keyboard, loading, empty, error, stale và success thân thiện;
- `detect_changes()` không có ảnh hưởng ngoài scope;
- reviewer không còn finding blocker/high chưa xử lý;
- handoff và rollback rõ;
- chưa được gọi là production-ready nếu chưa qua production gate trong checklist hiện hành.

## 7. Lộ trình nhân sự theo P0–P6

| Phase | Lát chính | Lead | Hỗ trợ | Điều kiện chuyển phase |
| --- | --- | --- | --- | --- |
| P0 | dọn baseline, docs, local D1, map | Control Tower + Release | Explorer, QA | baseline và tài liệu truy được; hiện đã hoàn thành về mặt tài liệu/local setup, còn commit gate phải làm trước implementation |
| P1 / MVP-0 | admin mode shell, contextual affordance, chưa write | Experience | Architecture, Accessibility, Browser | public/admin context tách; role nav đúng; keyboard/responsive; không có mutation |
| P2 / MVP-1 | brand/contact/hero một lát end-to-end | Backend/Contract | Renderer, Admin UX, QA | save draft → preview → publish → public; Access/role/stale/audit và visual pass |
| P3 / MVP-2 | news + media | Backend/Data | Admin UX, R2/Security, Browser | upload/reference-safe delete; news draft/publish semantics rõ; public listing/detail đúng |
| P4 / MVP-3 | pages, safe blocks, sections, navigation | Renderer/Content | Backend, IA, UX, QA | PageBlocks dùng chung; publish-all/revision; không arbitrary HTML/CSS/JS |
| P5 / MVP-4 | full control plane, dashboard, leads/members, bulk | Platform/Operations | Domain UI, Data, Security | role/capability đầy đủ; bulk all-or-none/idempotent; special pages chỉ có nơi cần |
| P6 | hardening, audit/rollback nếu justified, performance, production | Release/Security | toàn đội | staging acceptance, browser/deep QA, data/rollback, production checklist đều xanh |

### Quy tắc chọn trang đặc biệt

Không tạo trang chỉ để “đủ menu”. Một vấn đề dùng bảng/filter/bulk hoặc workflow nhiều bước thì đưa vào back-office riêng; một chỉnh sửa copy/hình/CTA có context trực tiếp thì giữ trên storefront. Audit/rollback chỉ thêm khi workflow lịch sử thực sự cần UI và đã có data model/evidence.

## 8. Phân luồng song song an toàn

### Được chạy song song

- inventory route/file/test và branch archaeology (read-only);
- UX wire/label và backend contract draft, miễn chưa commit code phụ thuộc nhau;
- test matrix và visual baseline;
- audit CI/staging hiện có và đánh giá performance;
- review độc lập sau khi implementer bàn giao commit.

### Phải chạy nối tiếp

- auth/capability → server contract → RED test → backend → UI → browser → release;
- migration model → adapter/query → API → admin UI;
- renderer boundary → region registry → contextual action → editor;
- bulk semantics → D1 atomic behavior → preview UI → browser large/invalid input test.

### Không được song song

- hai agent cùng sửa shared admin shell hoặc auth boundary;
- một agent sửa migration trong khi agent khác viết route dựa trên schema chưa chốt;
- UI gọi endpoint “tạm” rồi để backend đuổi theo;
- merge nhánh bulk/hardening/performance lớn trong lúc chưa có integration card;
- deploy production để “thử” khi staging gate chưa xanh.

## 9. Bản đồ trách nhiệm theo artifact

| Artifact | Owner | Reviewer | Khi cập nhật |
| --- | --- | --- | --- |
| `CLOUDFLARE_NATIVE_V1_PLAN.md` | Product + Architecture | người quyết định | khi đổi scope/kiến trúc |
| `CLOUDFLARE_ADMIN_WRITE_CONTRACT.md` | Architecture + Security | Backend + QA | trước mọi API mutation mới |
| `ADMIN_VISUAL_FILE_MAP.md` | Control Tower + Experience | Architecture | khi thêm route/domain/region/file ownership |
| `ADMIN_VISUAL_ROADMAP.md` | Control Tower + Product | Release | khi đổi phase/gate/acceptance |
| test scripts | Test/QA owner của domain | independent reviewer | cùng change làm thay đổi behavior |
| migrations | Data owner | Backend + Release | trước khi route/UI dùng schema mới |
| CI/staging/deploy | Release | Security + Control Tower | khi đổi gate/binding/hostname |
| task packet/handoff | task owner | Control Tower | đầu và cuối mỗi lát |

Các artifact generated hoặc snapshot phải ghi cách regenerate; không coi log tạm là tài liệu quyết định.

## 10. Giao thức review bắt buộc

### Review 1 — Contract/security

Reviewer trả lời:

- actor không có quyền có bị chặn ở server không;
- public/preview/workers.dev có thể write không;
- body, origin, hostname và content type có bị giới hạn không;
- revision/stale/idempotency/audit có nhất quán không;
- lỗi có an toàn và dùng được cho UI không;
- D1/R2 có đường rollback/compensation hợp lý không.

### Review 2 — UX/visual

Reviewer trả lời:

- người ít chuyên môn có biết đang sửa vùng nào, trạng thái nào và bước tiếp theo là gì không;
- contextual action có dễ tìm nhưng không làm rối public không;
- bulk action có preview, count, validation và kết quả từng dòng không;
- mobile, keyboard, focus, labels, non-color state và error copy có đạt không;
- visual fidelity có giữ captured/public behavior không.

### Review 3 — Simplicity/scope

Reviewer tìm thứ cần bỏ:

- abstraction trùng với primitive/adaptor hiện có;
- dependency mới không cần thiết;
- generic builder/bulk framework chưa có use case;
- route hoặc page đặc biệt có thể gộp vào flow hiện tại;
- logic client có thể dùng contract/helper server hiện hành.

## 11. Cách xử lý branch và phát hiện mới

Mỗi branch ngoài `master` phải qua pipeline sau:

1. ghi branch inventory: mục đích, base/độ phân kỳ, file thay đổi;
2. đọc commit và test để tạo `candidate change card`;
3. đối chiếu với plan, current state và write contract;
4. rebase/cherry-pick lát nhỏ trên baseline sạch;
5. chạy impact, test, lint/typecheck/build và staging evidence;
6. chỉ sau đó mới đưa vào roadmap như deliverable chính thức.

Đặc biệt với bulk import: coi đó là một feature candidate cho P5, không coi branch hiện tại là bằng chứng đã hoàn thành. Cần thống nhất trước payload size exception, quyền `content_manager`, stable request id và all-or-none semantics.

## 12. Tiêu chuẩn báo cáo của Control Tower

Mỗi lần báo cáo phải có bốn phần, không trộn lẫn:

1. **Đã xác minh** — command, file, route, test hoặc staging evidence cụ thể.
2. **Thiếu/lỗi** — behavior còn sai hoặc chưa có bằng chứng.
3. **Đề xuất** — lựa chọn sản phẩm/kỹ thuật mới, cần người quyết định nếu đổi scope.
4. **Ngoài phạm vi** — điều chưa làm vì Lean V1 hoặc production safety.

Một phase chỉ được đánh dấu đạt khi có bảng evidence, không dựa vào cảm giác “giao diện nhìn ổn”.

## 13. Kế hoạch kích hoạt thực tế tiếp theo

Các lát P1, P2, contextual news hand-off của P3, managed-page hand-off của P4,
product import và service archive batch của P5, cùng accessibility hardening cho
dialog dùng chung của P6 đã được thực hiện trên `master`. Từ checkpoint này,
Control Tower chỉ mở agent khi có đầu ra độc lập rõ ràng; tối đa 4 task đồng
thời, chế độ thường, và tuyệt đối không đụng worktree frontend motion đang dirty
của người dùng.

Trình tự còn lại:

1. Release/QA chạy lại lint, typecheck, build và full check sau khi dừng các dev
   server; lưu output/exit code thật.
2. Browser QA chạy staging public/admin bằng Cloudflare Access: public không có
   control, admin owner/content manager có context/editor, role khác bị giới
   hạn; chụp evidence desktop/mobile/keyboard/focus.
3. Backend/Data áp migration staging nếu thiếu và read-back draft → publish,
   product import atomic/replay, audit và stale behavior; không gọi mutation
   production.
4. Experience owner xử lý worktree motion riêng, commit/rebase trên baseline
   hiện tại rồi mới tạo change card để review; Control Tower không tự stage hay
   cherry-pick file dirty đó.
5. Sau khi các gate trên xanh, mở P3/P4/P5 còn thiếu theo từng vertical slice:
   admin news/media runtime acceptance, footer/navigation evidence và batch domain
   khác; service archive batch đã có code/contract nhưng chưa đóng phase vì thiếu
   browser Access read-back. Contextual news/page hand-off cũng chưa đóng phase vì
   cùng blocker. Mỗi slice cập nhật file map/roadmap/evidence trước khi chuyển tiếp.
6. Chỉ khi staging acceptance, rollback note, production checklist và người
   quyết định nội dung đã duyệt thì mới xem xét production promotion.

Đây là mô hình ưu tiên kết quả nhưng vẫn kiểm soát ngữ cảnh: agent chỉ nhận lát
nhỏ, độc lập, có artifact bàn giao; dependency chain luôn có một owner, một
contract và một chuỗi review rõ ràng.
