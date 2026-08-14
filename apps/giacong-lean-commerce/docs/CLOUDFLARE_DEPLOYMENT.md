# Cloudflare production deployment — Lean V1

Tài liệu này khóa kiến trúc triển khai production cho Lean V1. Khi có mâu thuẫn về nền tảng triển khai giữa tài liệu cũ và tài liệu này, quyết định Cloudflare trong tài liệu này được ưu tiên cho tới khi `COMMERCE_PLATFORM_MASTER_PLAN.md` được đồng bộ lại.

## Quyết định đã khóa

- Nền tảng public production: **Cloudflare**.
- Storefront Next.js chạy trên **Cloudflare Workers** thông qua **OpenNext for Cloudflare**.
- **Vercel không thuộc đường production** và không được dùng làm tiêu chí hoàn thành deployment.
- Website giữ **một public origin**. Storefront sở hữu `/`; các đường `/admin`, `/api/b2b`, `/storage`, `/themes/admin` và asset Bagisto tiếp tục đi tới Bagisto origin theo kiến trúc single-origin.
- Bagisto/Laravel không chạy trong Workers. Bagisto dùng runtime PHP/container riêng và ở Pha hạ tầng kế tiếp sẽ được đặt phía sau Cloudflare bằng private origin/Tunnel hoặc cơ chế tương đương đã được duyệt.
- Google Apps Script + Google Sheet tiếp tục là intake/hàng đợi vận hành của Lean V1 theo Master Plan hiện hành.
- Không mở rộng scope sang checkout, payment, customer account, order, quote engine hay CRM bắt buộc trong pha deployment.

## Kiến trúc đích

```text
Internet
  |
Cloudflare DNS / TLS / WAF / CDN
  |
Cloudflare Worker (Next.js via OpenNext)
  |-- /, /san-pham, /gui-yeu-cau, /lien-he, Next BFF
  |-- /api/contact ------------------------> Google Apps Script -> Google Sheet
  |
  `-- /admin, /api/b2b, /storage, /themes/admin
          |
          `--------------------------------> Bagisto private origin
```

## Trạng thái Giai đoạn 1

**Đã khóa ở mức repository:** Cloudflare là production target duy nhất; Vercel chỉ còn metadata lịch sử nếu còn xuất hiện trên GitHub.

Các việc account-side chưa thuộc Giai đoạn 1:

- gắn zone/domain production;
- tạo Cloudflare Worker thật trong account;
- cấu hình production secrets/vars;
- thiết lập Bagisto private origin/Tunnel.

## Giai đoạn 2 — Next.js trên Cloudflare Workers

Repository đã có các file nền tảng:

- `open-next.config.ts` — cấu hình OpenNext mặc định;
- `wrangler.jsonc` — Worker entry `.open-next/worker.js`, static assets `.open-next/assets`, `nodejs_compat`, observability;
- `public/_headers` — cache immutable cho `/_next/static/*`;
- npm scripts `cf:build`, `cf:preview`, `cf:deploy`, `cf:upload`, `cf:typegen`.

Phiên bản tool được ghim trong scripts để việc bootstrap không làm lệch `package-lock.json` trước khi CI/CD workspace được sửa ở giai đoạn riêng:

- `@opennextjs/cloudflare@1.20.2`
- `wrangler@4.115.0`

### Lệnh kiểm tra

Chạy trong `apps/giacong-lean-commerce`:

```bash
npm ci
npm run check
npm run cf:build
```

Preview production build trên runtime Cloudflare:

```bash
npm run cf:preview
```

Deploy khi tài khoản Cloudflare đã được kết nối và production vars/secrets đã sẵn sàng:

```bash
npm run cf:deploy
```

## Biến môi trường production bắt buộc

Không commit giá trị thật vào Git.

- `BAGISTO_API_URL` — origin mà Worker có thể gọi tới Bagisto API.
- `BAGISTO_PROXY_ORIGIN` — origin dùng cho các route proxy Bagisto.
- `BAGISTO_API_TIMEOUT_MS` — timeout BFF, mặc định ứng dụng 5000 ms.
- `GOOGLE_SHEETS_WEBHOOK_URL` — Apps Script webhook HTTPS.
- `GOOGLE_SHEETS_WEBHOOK_SECRET` — shared secret server-to-server nếu bật.

Không dùng `127.0.0.1` cho `BAGISTO_*` trong Cloudflare production. Giá trị production chỉ được chốt sau khi Bagisto private origin/Tunnel của Giai đoạn 3 có endpoint phù hợp.

## Điều kiện hoàn thành Giai đoạn 2

Giai đoạn 2 chỉ được đánh dấu **hoàn thành production** khi có bằng chứng account-side:

1. OpenNext build thành công.
2. Worker được deploy thành công vào Cloudflare account mục tiêu.
3. Các route độc lập Bagisto render đúng trên Worker.
4. Production variables/secrets không nằm trong repository.
5. Sau khi Bagisto origin sẵn sàng, `/san-pham`, product detail và cart validation gọi được canonical Bagisto API trên runtime Cloudflare.

Nếu chưa có quyền/tài khoản Cloudflare hoặc chưa có Bagisto production origin, repository có thể ở trạng thái **Cloudflare-ready**, nhưng chưa được gọi là **production deployed**.
