# Cloudflare production deployment — Lean V1

Tài liệu này khóa kiến trúc triển khai production cho Lean V1. Khi có mâu thuẫn về nền tảng triển khai giữa tài liệu cũ và tài liệu này, quyết định Cloudflare trong tài liệu này được ưu tiên cho tới khi `COMMERCE_PLATFORM_MASTER_PLAN.md` được đồng bộ lại.

## Quyết định đã khóa

- Nền tảng public production: **Cloudflare**.
- Hostname production: **`https://kienhieu.id.vn`**.
- Storefront Next.js chạy trên **Cloudflare Workers** thông qua **OpenNext for Cloudflare**.
- Worker production hiện hữu: **`giacong-vn`**.
- Worker staging hiện hữu: **`giacong-vn-staging`**.
- Mọi deployment ứng dụng mới phải vào **staging trước**. Không deploy trực tiếp production trong giai đoạn tích hợp hiện tại.
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
Cloudflare Worker
  |-- staging:    giacong-vn-staging
  `-- production: giacong-vn -> https://kienhieu.id.vn
          |
          +-- /, /san-pham, /gui-yeu-cau, /lien-he, Next BFF
          +-- /api/contact ----------------------> Google Apps Script -> Google Sheet
          `-- /admin, /api/b2b, /storage, /themes/admin
                    |
                    `----------------------------> Bagisto private origin
```

## Trạng thái Giai đoạn 1

**Hoàn thành ở mức repository:** Cloudflare là production target duy nhất; `kienhieu.id.vn` là hostname production; Vercel chỉ còn metadata lịch sử nếu còn xuất hiện trên GitHub.

Từ dashboard Cloudflare hiện tại đã xác nhận bằng kiểm tra trực quan của chủ dự án:

- zone/domain `kienhieu.id.vn` đang nằm trong tài khoản Cloudflare;
- Worker `giacong-vn` tồn tại;
- Worker `giacong-vn-staging` tồn tại;
- hạ tầng Cloudflare đang có traffic/Worker invocation.

Không xóa hoặc tạo lại các Worker/route hiện hữu trước khi audit cấu hình account-side.

## Giai đoạn 2 — Next.js trên Cloudflare Workers

Repository đã có các file nền tảng:

- `open-next.config.ts` — cấu hình OpenNext mặc định;
- `wrangler.jsonc` — production mặc định là `giacong-vn`, environment `staging` là `giacong-vn-staging`;
- `public/_headers` — cache immutable cho `/_next/static/*`;
- npm scripts Cloudflare có phân tách staging/production.

Wrangler environments được dùng để tránh tạo Worker mới ngoài hai Worker đang tồn tại. Production dùng top-level Wrangler config; staging dùng `--env=staging`.

Phiên bản tool được ghim trong scripts để việc bootstrap không làm lệch `package-lock.json` trước khi CI/CD workspace được sửa ở giai đoạn riêng:

- `@opennextjs/cloudflare@1.20.2`
- `wrangler@4.115.0`

### Cổng an toàn deployment

`npm run cf:deploy` **chỉ deploy staging** và là alias của `cf:deploy:staging`.

Không có script deploy production trực tiếp trong giai đoạn này. Với production chỉ có `cf:upload:production`, tạo version nhưng không tự động đưa version đó vào traffic. Promotion production chỉ thực hiện sau khi staging đạt acceptance criteria và account-side routes/secrets được audit.

### Lệnh kiểm tra

Chạy trong `apps/giacong-lean-commerce`:

```bash
npm ci
npm run check
npm run cf:build:staging
npm run cf:preview:staging
```

Khi Cloudflare authentication và staging variables đã sẵn sàng:

```bash
npm run cf:deploy:staging
```

Production build/version sau khi staging được duyệt:

```bash
npm run cf:build
npm run cf:upload:production
```

Lệnh trên **không phải promotion production**.

## Biến môi trường production/staging bắt buộc

Không commit giá trị thật vào Git.

- `BAGISTO_API_URL` — origin mà Worker có thể gọi tới Bagisto API.
- `BAGISTO_PROXY_ORIGIN` — origin dùng cho các route proxy Bagisto.
- `BAGISTO_API_TIMEOUT_MS` — timeout BFF, mặc định ứng dụng 5000 ms.
- `GOOGLE_SHEETS_WEBHOOK_URL` — Apps Script webhook HTTPS.
- `GOOGLE_SHEETS_WEBHOOK_SECRET` — shared secret server-to-server nếu bật.

Không dùng `127.0.0.1` cho `BAGISTO_*` trên Cloudflare. Giá trị staging/production chỉ được chốt sau khi audit origin hiện tại và, nếu cần, hoàn thành Bagisto private origin/Tunnel của Giai đoạn 3.

Bindings/vars/secrets là environment-specific; staging và production phải được kiểm tra riêng, không giả định chúng tự kế thừa nhau.

## Điều kiện hoàn thành Giai đoạn 2

Giai đoạn 2 chỉ được đánh dấu **hoàn thành production** khi có bằng chứng account-side:

1. `npm run check` đạt.
2. OpenNext staging build thành công.
3. `giacong-vn-staging` được deploy thành công mà không tác động `giacong-vn`.
4. Các route độc lập Bagisto render đúng trên staging Worker.
5. Staging variables/secrets không nằm trong repository.
6. Sau khi Bagisto origin sẵn sàng, `/san-pham`, product detail và cart validation trên staging gọi được canonical Bagisto API.
7. Chỉ sau acceptance staging mới tạo/upload version production cho `giacong-vn` và thực hiện promotion có kiểm soát.

Nếu chưa có Cloudflare authentication từ môi trường triển khai hoặc chưa audit được variables/routes hiện hữu, repository ở trạng thái **Cloudflare-ready for staging**, chưa được gọi là **production deployed**.
