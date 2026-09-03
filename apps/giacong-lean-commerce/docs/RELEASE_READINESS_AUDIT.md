# Audit sẵn sàng bàn giao — 2026-09-03

## Kết luận

Bản staging hiện **đủ điều kiện để tiếp tục nghiệm thu kỹ thuật**, nhưng chưa
đủ điều kiện để gọi là bàn giao production hoàn hảo. Staging đang chạy
`b8b344ca-07c3-4449-bfca-d5acad685931` ở 100%, rollback point gần nhất là
`e50223de-208f-45d8-bd4f-27ecc32b37ea`; production vẫn giữ nguyên và đang
**NO-GO** cho migration hoặc promotion.

## Giảm burst prefetch admin — 2026-09-03

- Điều tra browser owner cho thấy các protected link trong `AdminShell` tự
  prefetch nhiều route admin ngay khi mở dashboard; đây là tín hiệu phù hợp
  với incident 1102 trong lượt điều hướng dồn.
- Commit `222ec6c4` thêm `prefetch={false}` cho sidebar protected và regression
  test tương ứng. Admin suite sau thay đổi đạt `216/216`; lint, typecheck và
  build OpenNext/static `27/27` vẫn pass.
- Commit đã deploy lên staging version
  `b8b344ca-07c3-4449-bfca-d5acad685931`. Owner dashboard tải dữ liệu thành
  công; `/api/admin/dashboard` trả `200`, tail ghi `outcome=ok`,
  `cpuTime=24 ms`, `wallTime=827 ms`, console browser rỗng.
- Đây là controlled recheck, chưa đóng performance/1102 gate; vẫn cần stress
  test có kiểm soát và observability trước khi xét production.

## Tái kiểm tra runtime resource-limit — 2026-09-02

- Một lượt điều hướng admin quá dồn trước đó đã hiện trang Cloudflare
  `Worker exceeded resource limits` tại `/admin/dich-vu`; đây là lỗi 1102 cần
  phân biệt giữa CPU và memory, không được coi là lỗi UI thông thường.
- Kiểm tra phân lớp sau đó không cho thấy D1 là nút thắt: staging có đủ bảng
  admin/service, đủ migration `0001–0019`, chỉ có 2 service; các truy vấn schema
  và count trực tiếp qua Wrangler đều hoàn tất với SQL duration dưới 1 ms.
- `wrangler check startup --env=staging` ghi nhận bundle `7706.51 KiB` (gzip
  `1521.96 KiB`) và local startup active `57.0 ms`. Tail public homepage của
  version `6162...` ghi nhận `cpuTime=514`, `wallTime=720` và outcome `ok`.
- Khi tải cô lập và điều hướng chậm, `/admin/dich-vu` đã đọc lại thành công
  với owner, 2 bản ghi, không console error; lượt audit → dịch vụ kế tiếp cũng
  không tái hiện 1102. Gate này vẫn **chưa đóng** cho tới khi có stress test
  có kiểm soát và observability production phân biệt rõ `exceededCpu`/
  `exceededMemory`.

Để bàn giao production an toàn, còn bốn nhóm gate phải đóng:

1. kiểm thử role × route × action bằng các identity Cloudflare Access thật;
2. write/read-back và audit consistency của từng domain admin trên staging;
3. duyệt và nhập dữ liệu/nội dung production có chủ ý, không copy demo staging;
4. export backup mới, restore-drill, migration `0009–0019`, promotion có rollback
   point và theo dõi observability 24 giờ.

## Controlled admin 1102 recheck — 2026-09-03

- Lượt smoke dồn trước đó đã từng hiện Cloudflare `Worker exceeded resource
  limits` tại `/admin/san-pham`; sự cố này được giữ lại như một incident cần
  theo dõi, không được hạ thành lỗi của harness chỉ vì reload sau đó thành công.
- Một tab owner Chrome mới đã mở riêng `/admin` và `/admin/san-pham`, rồi điều
  hướng thật qua `/admin/dich-vu`, `/admin/san-pham` và `/admin/yeu-cau`; các màn
  hình đều render đúng dữ liệu D1, không có 1102/5xx hoặc console error. API
  products trong lượt có kiểm soát trả `200` với thời gian khoảng `1,27 s`.
- Wrangler tail của version `a3d82449-4dee-4b3f-a001-0b97e70e21e4` ghi các
  invocation owner quan sát được là `outcome=ok`, CPU khoảng `10–522 ms`, wall
  time khoảng `253–679 ms`; D1 staging báo không còn migration pending và
  public smoke 5 route đều `200`, không có runtime error hay admin marker.
- Kết luận tạm thời: chưa có bằng chứng 1102 tái hiện độc lập từ truy vấn sản
  phẩm hoặc D1; khả năng cao liên quan đến burst navigation/prefetch hoặc sự
  cố runtime thoáng qua. Performance gate vẫn mở cho tới khi có stress test có
  kiểm soát và observability phân biệt rõ `exceededCpu`/`exceededMemory`.

## Public UX audit sau khi sửa false-negative menu — 2026-09-03

- Lượt audit đầu tiên báo fail hover desktop vì runner tìm text cố định
  `Mua hàng`, trong khi nhãn top-level hiện tại do D1 quản lý và staging đang
  render `Sản Phẩm`. Đây là lỗi của QA selector, không phải lỗi mega-menu.
- Đã thêm regression contract và đổi runner sang identity ổn định
  `#menu-item-1742`; không đổi dữ liệu navigation hay nội dung storefront.
  `test:commerce` sau thay đổi đạt `69/69`.
- Audit lại trên `https://staging.kienhieu.id.vn` đạt toàn bộ action ở 5 route
  (`12/12`), HTTP `200`, `0` console error, `0` HTTP 4xx/5xx, axe `0`
  serious/critical và không overflow. Evidence tái tạo nằm tại
  `.runtime/ux-audit-20260903-after-selector/audit.json`.
- Contact còn `1` console warning từ iframe Google Maps về `postMessage`
  cross-origin; đã phân loại là third-party warning, không phải lỗi ứng dụng.

## Staging role inventory read-only — 2026-09-03

- D1 staging hiện chỉ có `1` tài khoản active với role `owner`; bốn role
  `content_manager`, `catalog_manager`, `sales_manager`, `viewer` chưa có
  identity/member thật để kiểm thử.
- Wrangler metadata xác nhận `changed_db=false`, `rows_written=0`. Đây là
  bằng chứng giải thích blocker của role matrix, không phải lý do để tạo user
  giả hoặc đánh dấu gate đạt.

## Source gate sau khi bỏ preview mô phỏng — 2026-09-03

- Commit `655ff4f1` đã chuyển `Nội dung & thương hiệu` và `Thiết kế page` sang
  mô hình control plane + handoff tới storefront thật; không còn card preview
  tự dựng có thể lệch renderer production. Direct editor trên storefront vẫn là
  luồng chỉnh sửa theo vùng chính.
- Regression visual đạt `8/8`; full source gate đạt exit `0` với admin `200/200`,
  contact `104/104`, catalog `5/5`, purchase UI `1/1`, service `3/3`, commerce
  `68/68`, listing `4/4`, detail `29/29`, lint, typecheck và build `27/27`.
- Đây là source/local evidence độc lập; staging deploy/read-only smoke được ghi
  ngay bên dưới. Các gate Access nhiều identity, write/read-back, dữ liệu
  production và promotion vẫn giữ nguyên trạng thái mở.

## Staging deploy/read-only smoke — 2026-09-03

- Commit `655ff4f1` đã deploy qua `npm run cf:deploy:staging`; version staging
  mới là `430d41b1-a61c-46d1-ac9f-89eb8df74feb` ở 100%.
- Một 502 thoáng qua xuất hiện ngay sau deploy tại `/admin/audit`; reload đã
  khôi phục thành công. Owner sau đó chạy lại đủ 10 route admin canonical,
  đối chiếu đúng `h1` đạt `10/10`; hai nút handoff `Mở storefront thật`/`Mở page
  thật` hiện đúng, không có lỗi console.
- Storefront `/` đọc đúng heading/CTA public, không render admin control và
  console error/warning rỗng. Smoke này chỉ navigation/read-only, chưa submit
  form, publish, D1/R2 mutation hay thay đổi production.

## Deep QA staging recheck sau footer release — 2026-09-03

- Chạy lại `node scripts/qa-deep-staging.mjs` trên staging đang ở version
  `e50223de-208f-45d8-bd4f-27ecc32b37ea`; toàn bộ lượt read-only đạt `PASS`.
- Responsive smoke đạt cho 4 route (`/`, `/san-pham`, `/thue-gia-cong`,
  `/gui-yeu-cau`) ở mobile `390px`, tablet `768px` và desktop `1440px`: HTTP
  `200`, main rendered và không horizontal overflow.
- Catalog search/sort, detail mobile stacking, add-to-cart localStorage,
  request route và keyboard reachability đều pass. Runner không submit lead và
  không ghi D1/R2; cart chỉ ghi localStorage của browser test.
- Đây là bằng chứng runtime public mới nhất, không đóng các gate cần Access
  identity, write/read-back, production data hoặc promotion.

## Authenticated owner admin recheck và sửa false-positive QA — 2026-09-03

- Phiên owner staging trong Chrome đã đọc lại đủ `10/10` route admin canonical:
  heading đúng, marker vai trò `Chủ sở hữu` đúng, không horizontal overflow,
  không có các trạng thái lỗi runtime; console error/warning rỗng. `/admin/audit`
  đọc được `139` sự kiện.
- Lượt kiểm tra đầu tiên đánh dấu nhầm `/admin/thanh-vien` vì copy hợp lệ có câu
  “Cloudflare Access vẫn là lớp xác thực”. Đây là lỗi của matcher QA, không phải
  lỗi trang. Commit `0b1986bf` đã thu hẹp matcher để chỉ bắt màn hình Access bị
  chặn cụ thể và lỗi runtime; regression đạt `2/2`, full admin đạt `205/205`.
- Owner recheck này chỉ là bằng chứng của một identity có quyền cao nhất; chưa
  thay thế role matrix đủ năm identity, write/read-back mutation hoặc production
  acceptance. Không có mutation nào được thực hiện trong lượt recheck.
- Kiểm tra bổ sung trên cùng phiên owner với emulator tạm `390×844` và
  `prefers-reduced-motion: reduce` đạt heading đúng, không overflow và phím Tab
  tới button nhìn thấy; console vẫn rỗng. Emulator đã được trả về
  `no-preference` và viewport trình duyệt bình thường sau phép thử.
- `/admin/thanh-vien` đã mở đúng form tạo tài khoản: có Access subject, tên,
  email, trạng thái kích hoạt và combobox đủ năm role, gồm `Chủ sở hữu (toàn
  quyền)`. Bản ghi owner hiện tại hiển thị đúng và khóa tự đổi role/tự vô hiệu
  hóa. Form chỉ được mở để kiểm tra UI; không submit và không ghi D1.

## Bằng chứng hiện có

- Source head hiện tại là `0adb917a`; latest admin suite đạt `215/215`,
  focused bulk-import đạt `19/19`, full build isolated đạt `27/27`,
  lint/typecheck pass và `npm audit --omit=dev --audit-level=high` báo
  `0 vulnerabilities`. Các full-suite counts lịch sử vẫn được giữ ở các mục
  evidence tương ứng bên dưới. Commit hiện tại đã deploy lên staging; owner
  browser smoke sau deploy đang chờ Access re-auth.
- Staging D1 đã apply đủ migration đến `0019`; public smoke 7/7 route, product
  API, cart canonical money và R2 media đều pass.
- Chrome với identity `qtu1053@gmail.com` đã đọc đúng `owner`/`Chủ sở hữu
  (toàn quyền)`, thấy luồng tạo admin, page builder và bulk product action.
  Một lead QA staging đã được đổi status rồi khôi phục về trạng thái ban đầu;
  read-back trên inbox và hai audit event với revision `1 → 2`, `2 → 3` đã
  được xác nhận. Chưa tạo identity/member thứ hai hoặc ghi dữ liệu quyền hạn
  mới khi chưa có chủ ý cụ thể.
- Dashboard staging sau commit `8652130` đọc đúng `12` tổng sản phẩm, `10`
  active và `0` draft; test hồi quy dashboard nằm trong admin gate.
- Direct-edit slice trên homepage đã được kiểm tra với owner thật: 8/8 target
  selector nhận diện đúng DOM đang render; text đổi ngay tại chỗ, thanh action
  báo dirty, reload khôi phục published. Bảng nội dung có text/link/media,
  không còn draft preview mô phỏng; focused test `13/13`, full admin `192/192`,
  commerce `67/67`, build OpenNext/TypeScript pass. Public staging không có
  admin control và Chrome console không có error/warning.
- Owner Chrome đã đi qua đủ 10 route admin canonical trên hostname staging;
  deep QA staging pass mobile/tablet/desktop cho public route, catalog
  search/filter/sort, product detail/cart và keyboard reachability. Đây là
  bằng chứng điều hướng và public deep-QA, không phải role matrix hay
  write/read-back đầy đủ.
- CMS `brand_tagline` đã được owner kiểm tra draft isolation và publish
  round-trip. Sau commit `ca14e5f`, giá trị QA được lưu rồi phát hành, public DOM
  đọc đúng `data-site-setting="brand_tagline"` và hiển thị thực; sau đó owner
  đã khôi phục giá trị gốc và publish lại. Preview draft, các role khác và các
  setting khác vẫn chưa được suy diễn từ phép thử này.
- Navigation item `Home` cũng đã qua draft isolation/read-back có hoàn nguyên:
  nhãn QA không xuất hiện trên public, nhãn ban đầu được lưu lại và item trở
  lại `Published`. Publish-all, các mutation khác và role matrix vẫn mở.
- Sau đó đã kiểm thử publish từng mục thật: draft `Home [QA]` được lưu, nút
  `Phát hành` bật đúng sau khi draft đã nằm trên server, public homepage hiển
  thị `Home [QA]`, rồi được khôi phục về `Home`. Commit `7666d67` sửa state
  `localDirty`; commit `8ecd8ae` nối published navigation vào homepage
  captured fallback. D1 cuối `dirty = 0`, public và admin đều đọc `Home`.
- Publish runtime `brand_tagline` trên staging đã được kiểm chứng bằng browser:
  draft QA → publish → public đọc đúng text và computed visibility; sau đó
  restore/publish giá trị gốc. Staging version `c860a002-afcc-4c41-a329-b0390799d9bc`
  ở 100%, rollback point là `26884d0b-0092-43cd-bad2-df077de605eb`; audit hiện
  audit tại thời điểm đó đọc `123` sự kiện với bốn event tagline mới, revision
  `7 → 8 → 9 → 10 → 11`.
- Publish runtime bốn trường Hero CTA cũng đã được kiểm chứng bằng owner
  browser: primary/secondary label và URL đều draft → publish → public DOM đọc
  đúng text, href và visibility; sau đó restore/publish cả bốn giá trị gốc.
  Commit `173239e`, staging version `0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0` ở
  100%, rollback point là `c860a002-afcc-4c41-a329-b0390799d9bc`; audit hiện
  đọc `139` sự kiện.
- Homepage content renderer đã được đóng ở commit `732eba5`: adapter riêng nối
  `hero_description`, `about_title`, `about_description` vào đúng captured
  `section01/section02`, không làm rộng selector sang route khác. Staging
  version `81b2e573-dea9-4e6a-b7ce-9cddb9b5fc70` đã deploy 100%, rollback về
  `0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0`; Chrome public đọc lại đúng hero/about
  mặc định, CTA, navigation và gallery. Không có D1/R2 mutation trong probe.
- News owner staging đã tạo/đọc/xóa một bài nháp QA; public `/tin-tuc` vẫn
  empty trong suốt phép thử và danh sách admin trở lại `0 bài viết` sau khi
  dọn bản ghi. Đây chưa phải bằng chứng publish/cover-media đầy đủ.
- `/admin/audit` đọc lại `139 sự kiện`; event mới nhất của news/navigation/site
  setting có actor, action, revision và request ID tương ứng với các round-trip.
  Đây chưa phải consistency audit cho mọi domain.
- Export mới hiện có là `.runtime/production-d1-backup-20260902-pre-release.sql`,
  SHA-256 `583BE2FBFFC2C6D8F0C77E7D97C3786E838EDBFD228E024AD7A8F078A147ABFD`;
  local restore-drill đạt `integrity_check=ok` (19 bảng, 13 migration, 9
  product, 17 variant, 0 lead). Nếu dữ liệu thay đổi trước cửa sổ migration,
  phải export và drill lại.
- Read-only production audit ngày 2026-09-02 xác nhận pending chính xác
  `0009–0019`; không có production D1/R2 mutation hoặc production deploy trong
  đợt audit này.

## Migration preflight drill — 2026-09-03

- Fresh backup production đã được nạp vào SQLite memory và chạy lần lượt toàn
  bộ file migration `0009–0019` hiện có trong checkout.
- Kết quả: `integrity_check=ok`, foreign-key violations `0`, schema sau drill
  có 32 bảng. Không có lệnh nào ghi D1 remote; đây là preflight trên bản sao,
  không phải production apply.
- Production vẫn phải xử lý ledger legacy/current có 13 entry đã áp dụng,
  mở migration window, export/checksum lại ngay trước giờ chạy, apply qua
  Wrangler và verify post-condition từng nhóm trước promotion.

## Dependency revalidation — 2026-09-03

- `npm audit --audit-level=high` sau patch trả `found 0 vulnerabilities`.
- Lockfile commit `8a1bb1b3` chỉ nâng `@humanfs/node` lên `0.16.8`,
  `@humanfs/core` lên `0.19.2` và thêm `@humanfs/types`; không đổi runtime
  dependency.
- Full `npm run check` chạy bằng `cmd.exe` trả exit code `0` sau patch: 198
  admin, 104 contact, 5 catalog, 1 purchase UI, 3 service, 68 commerce, 4
  listing, 29 detail; lint, typecheck và build 27/27 route đều pass.

## Production infrastructure re-audit — 2026-09-03

- Wrangler read-only: Worker production `giacong-vn` vẫn ở version
  `1d8a2b41-6154-46d5-935b-8cb7fbc35688` @100%; D1 có 18 bảng/324 kB, 207
  read query và 0 write trong 24 giờ; đủ resource R2/queue production và
  staging tách biệt.
- Không có production upload, deploy, migration hay data mutation trong lượt
  audit. Vì Worker production chưa chứa release staging `eff0d7fa`, không được
  dùng smoke cũ để tuyên bố bản code hiện tại đã bàn giao production.

## Owner staging route smoke sau khi khởi động lại — 2026-09-03

- Phiên Chrome owner trên `admin-staging.kienhieu.id.vn` đã khôi phục và
  dashboard đọc đúng `Qtu1053 · owner`, nhãn `Chủ sở hữu`, cùng dữ liệu D1
  hiện hành.
- Fresh semantic traversal qua 10 route admin canonical (`/admin`, nội dung,
  thiết kế, sản phẩm, dịch vụ, tin tức, điều hướng, yêu cầu, thành viên và
  audit) đạt `10/10`: heading đúng, nhận diện owner, không có trạng thái lỗi
  tải dữ liệu/1102/502/503 được render.
- Đây là owner navigation/read-only evidence sau restart; không submit form,
  không publish, không tạo member và không ghi D1/R2. Role matrix nhiều
  identity, write/read-back đầy đủ và production gate vẫn mở.

## Authenticated admin staging QA runner — 2026-09-03

- Đã thêm `scripts/qa-admin-staging.mjs` và lệnh `npm run qa:admin-staging`.
  Runner nhận Playwright storage state sau Access login, chạy 10 route admin ở
  mobile/desktop, đợi heading render, kiểm tra role tùy chọn, lỗi Access/1102/
  5xx, overflow và console error/warning từ staging origin.
- Có thể truyền `QA_ADMIN_ROLE_STATES` là JSON map đúng đủ owner,
  content_manager, catalog_manager, sales_manager và viewer để chạy tuần tự
  từng identity và đối chiếu tập link sidebar theo role.
- Runner chỉ dùng navigation/read APIs; contract test khóa storage-state,
  bounded route list và không có thao tác click/fill/type/press hoặc HTTP
  mutation. Thiếu storage state sẽ dừng với trạng thái `ADMIN QA BLOCKED`,
  không giả vờ pass.
- Lát này mới cung cấp bằng chứng tự động hóa có thể tái chạy; không tự đóng
  role matrix nhiều identity hoặc write/read-back vì các gate đó cần storage
  state/identity thật được cấp phép riêng.

### A11y runner hardening — 2026-09-03

- Runner chạy mỗi viewport ở cả `no-preference` và `reduce`, kiểm tra
  `prefers-reduced-motion` đúng với context đã cấu hình.
- Sau mỗi route, runner gửi `Tab` và xác nhận `document.activeElement` là phần
  tử focusable, nhìn thấy; đây là kiểm tra keyboard reachability, không phải
  thao tác nghiệp vụ.
- Contract test đã vào `npm run test:admin`; suite hiện pass `201/201`.
- Khi không có storage state, runner vẫn fail closed với `ADMIN QA BLOCKED`;
  thay đổi này không biến bằng chứng local thành role-matrix runtime.

## Revalidation sau hardening — 2026-09-02

- Commit `e1936cfb` đã đóng race giữa publish news từng bài và publish hàng
  loạt, khóa color picker với role chỉ xem, thêm confirm khi xóa section,
  giảm query dashboard và làm mobile visual editor không che nội dung.
- Staging version `eff0d7fa-c5e2-4641-911b-b3b324ac0284` đã build/deploy 100%,
  startup 30 ms; không có D1/R2 mutation trong lượt QA.
- `npm run check` exit `0`: admin `198/198`, contact `104/104`, catalog
  `5/5`, purchase UI `1/1`, service `3/3`, commerce `68/68`, listing `4/4`,
  detail `29/29`, lint, typecheck và build đều pass.
- Deep QA read-only pass mobile/tablet/desktop: 4 route public HTTP 200,
  semantic render wait, không overflow; catalog, detail/cart và keyboard đều
  pass. Chrome owner staging xác nhận direct editor mở thật, Escape đóng và
  focus quay lại đúng target, không console error/warning.
- Production vẫn chỉ có read-only evidence; Wrangler xác nhận còn đúng 11
  migration `0009–0019`. Backup fresh và restore-drill local đã được xác minh
  bằng SHA-256 ở mục bằng chứng; các gate dữ liệu thật, nhiều Access identity,
  write/read-back toàn domain, migration/rollback window và observability 24 giờ
  vẫn mở.

## Audit skills.sh

Đã chạy `npx skills list --json` ở project và quét tìm kiếm trên skills.sh bằng
CLI cho các chủ đề Next.js, Cloudflare, Playwright và security audit. Project
chỉ có skill `clone-website` được cài cục bộ; các kết quả phù hợp nhất gồm
`cloudflare/skills@wrangler`, `cloudflare/skills@workers-best-practices`,
`cloudflare/skills@web-perf`, `microsoft/playwright-cli@playwright-cli` và
`cloudflare/security-audit-skill@security-audit`.

Không cài skill public mới chỉ vì có thứ hạng cao: skill marketplace cảnh báo
chất lượng/security không được bảo đảm tuyệt đối. Các skill repo/system hiện
đã có (`giacong-admin`, `cloudflare`, `wrangler`, `workers-best-practices`,
browser testing, TDD, code review và verification) bao phủ đúng stack này. API
search chính thức của skills.sh yêu cầu Vercel OIDC nên không dùng làm bằng
chứng thay cho kết quả CLI công khai.

## Dọn dẹp và nguyên tắc bàn giao

- Không xóa hoặc reset worktree frontend motion riêng
  `C:\Users\hieuk\Desktop\giacong-motion-fidelity`.
- Không stage các thay đổi người dùng đang có ở root `AGENTS.md`, `CLAUDE.md`
  và `docs/`; chúng không thuộc release source của app.
- `.runtime` giữ lại backup và restore-drill làm bằng chứng vận hành; không commit
  dữ liệu backup vào source control.
- Dữ liệu demo staging không được dùng làm seed production.

## Định nghĩa bàn giao hoàn hảo

Chỉ đánh dấu bàn giao hoàn tất khi checklist production acceptance và roadmap
đều có bằng chứng runtime tương ứng; build xanh hoặc một owner duy nhất đăng nhập
được chưa đủ. Người vận hành sau bàn giao phải có thể đăng nhập Access, chỉnh
catalog/CMS/news/page/media, xử lý batch theo quyền, đọc audit, khôi phục theo
runbook và quan sát request queue mà không cần thao tác kỹ thuật ngoài tài liệu.
