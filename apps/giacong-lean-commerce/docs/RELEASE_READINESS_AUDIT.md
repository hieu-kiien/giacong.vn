# Audit sẵn sàng bàn giao — 2026-09-02

## Kết luận

Bản staging hiện **đủ điều kiện để tiếp tục nghiệm thu kỹ thuật**, nhưng chưa
đủ điều kiện để gọi là bàn giao production hoàn hảo. Staging đang chạy
`81b2e573-dea9-4e6a-b7ce-9cddb9b5fc70` ở 100%, rollback point gần nhất là
`0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0`; production vẫn giữ nguyên và
đang **NO-GO** cho migration hoặc promotion.

Để bàn giao production an toàn, còn bốn nhóm gate phải đóng:

1. kiểm thử role × route × action bằng các identity Cloudflare Access thật;
2. write/read-back và audit consistency của từng domain admin trên staging;
3. duyệt và nhập dữ liệu/nội dung production có chủ ý, không copy demo staging;
4. export backup mới, restore-drill, migration `0009–0019`, promotion có rollback
   point và theo dõi observability 24 giờ.

## Bằng chứng hiện có

- `npm run check` đã xanh toàn bộ test, lint, typecheck và build: admin `190/190`,
  contact `104/104`, catalog `5/5`, purchase UI `1/1`, service `3/3`, commerce
  `67/67`, listing `4/4`, detail `29/29`; `npm audit` (cả production và đầy đủ
  dependency) báo `0 vulnerabilities`.
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
