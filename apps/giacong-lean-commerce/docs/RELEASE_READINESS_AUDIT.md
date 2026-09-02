# Audit sẵn sàng bàn giao — 2026-09-02

## Kết luận

Bản staging hiện **đủ điều kiện để tiếp tục nghiệm thu kỹ thuật**, nhưng chưa
đủ điều kiện để gọi là bàn giao production hoàn hảo. Staging đang chạy
`14a6e3c9-7a4f-46a2-b8a0-c6eaf827647c` ở 100%; production vẫn giữ nguyên và
đang **NO-GO** cho migration hoặc promotion.

Để bàn giao production an toàn, còn bốn nhóm gate phải đóng:

1. kiểm thử role × route × action bằng các identity Cloudflare Access thật;
2. write/read-back và audit consistency của từng domain admin trên staging;
3. duyệt và nhập dữ liệu/nội dung production có chủ ý, không copy demo staging;
4. export backup mới, restore-drill, migration `0009–0019`, promotion có rollback
   point và theo dõi observability 24 giờ.

## Bằng chứng hiện có

- `npm run check` đã xanh toàn bộ test, lint, typecheck và build; `npm audit`
  (cả production và đầy đủ dependency) báo `0 vulnerabilities`.
- Staging D1 đã apply đủ migration đến `0019`; public smoke 7/7 route, product
  API, cart canonical money và R2 media đều pass.
- Chrome với identity `qtu1053@gmail.com` đã đọc đúng `owner`/`Chủ sở hữu
  (toàn quyền)`, thấy luồng tạo admin, page builder và bulk product action.
  Chưa tạo identity/member thứ hai hoặc ghi dữ liệu mới khi chưa có chủ ý cụ
  thể.
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
