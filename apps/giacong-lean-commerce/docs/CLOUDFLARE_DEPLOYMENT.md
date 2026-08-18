# Cloudflare deployment, recovery và production runbook — Lean V1

Tài liệu này mô tả đường triển khai và phục hồi hiện hành của `apps/giacong-lean-commerce`. Nó phải được đọc cùng:

- `CLOUDFLARE_NATIVE_V1_PLAN.md` — quyết định kiến trúc và scope;
- `CLOUDFLARE_CURRENT_STATE.md` — bằng chứng implementation/runtime đã xác minh;
- `CLOUDFLARE_ADMIN_WRITE_CONTRACT.md` — contract write/admin.

Bagisto/PHP/VPS/Tunnel là legacy/reference, không thuộc runtime hiện hành.

## 1. Kiến trúc vận hành hiện tại

```text
Cloudflare DNS / TLS / Access / CDN
        |
Next.js + OpenNext Worker
        |
        +-- D1: catalog + CMS + News + leads + audit
        +-- R2: product/site/news media + Next cache
        +-- Queue: async lead delivery
        |      `-- DLQ khi vượt retry budget
        `-- Google Apps Script / Sheet: secondary operational sink
```

Các nguyên tắc không được đảo ngược:

- **D1 là source of truth** cho catalog, CMS, lead và audit.
- Lead phải được persist D1 thành công trước khi enqueue/delivery.
- Google Sheet là secondary operational mirror, không phải canonical request queue.
- Browser không truy cập trực tiếp D1/R2.
- Admin production và staging đều fail-closed sau Cloudflare Access và D1 membership.
- Worker rollback không đồng nghĩa database/media rollback.

## 2. Resource map đã khai báo

Nguồn cấu hình canonical: `wrangler.jsonc`.

### Production

| Thành phần | Resource |
| --- | --- |
| Worker | `giacong-vn` |
| Public route | `kienhieu.id.vn/*` |
| Admin route | `admin.kienhieu.id.vn/*` |
| D1 | `giacong-vn-catalog` |
| D1 binding | `GIACONG_VN_CATALOG` |
| R2 media | `giacong-vn-product-media` |
| R2 media binding | `GIACONG_VN_PRODUCT_MEDIA` |
| R2 Next cache | `giacong-vn-next-cache` |
| Queue | `giacong-vn-leads` |
| DLQ | `giacong-vn-leads-dlq` |

### Staging

| Thành phần | Resource |
| --- | --- |
| Worker | `giacong-vn-staging` |
| Public route | `staging.kienhieu.id.vn/*` |
| Admin route | `admin-staging.kienhieu.id.vn/*` |
| D1 | `giacong-vn-catalog-staging` |
| R2 media | `giacong-vn-product-media-staging` |
| R2 Next cache | `giacong-vn-next-cache-staging` |
| Queue | `giacong-vn-leads-staging` |
| DLQ | `giacong-vn-leads-staging-dlq` |

Không đổi tên, xóa hoặc recreate resource chỉ để “sửa deploy” nếu chưa kiểm tra binding và dữ liệu hiện có.

## 3. Pipeline chuẩn

### Pull request

PR chỉ được kiểm chứng, không mutate remote staging state:

1. `npm ci`;
2. production dependency security gate;
3. `npm run check`;
4. `npm run cf:build:staging`;
5. Wrangler staging dry-run/package validation;
6. GitNexus safety gate.

PR không được apply D1 migration remote và không deploy Worker remote.

### Merge vào `master`

Pipeline `CI and Cloudflare staging gate` thực hiện:

1. Quality gate;
2. kiểm tra Cloudflare credentials/current staging Worker;
3. bảo đảm staging Access Service Auth policy cho CI;
4. OpenNext staging build;
5. Wrangler dry-run trước khi đổi remote state;
6. apply **pending staging D1 migrations**;
7. deploy Worker staging;
8. verify staging deployment đang ở một version nhận 100% traffic.

Sau workflow staging thành công, `Cloudflare staging deep QA` checkout đúng commit vừa deploy và chạy acceptance qua Cloudflare Access, gồm baseline security headers, accessibility semantics/keyboard, commerce/runtime checks, responsive/browser checks và News regression.

Không coi một commit là staging-accepted chỉ vì build hoặc deploy thành công; post-deploy QA cũng phải xanh.

## 4. Production promotion — hiện là thao tác có kiểm soát

Repo không coi merge `master` là lệnh production deploy tự động.

Trước mỗi production promotion phải có đủ:

- commit đã pass PR gates;
- cùng commit đã deploy staging và pass post-deploy QA;
- migration production đã được review;
- production content/catalog/contact/trust claims đã được owner duyệt;
- D1 pre-change export/bookmark đã được ghi lại;
- current Worker version ID và rollback target đã được ghi lại;
- người thực hiện và thời điểm maintenance/change window đã được xác định;
- rollback decision point đã được thống nhất.

### Pre-change evidence

Từ thư mục app, ghi lại current Worker deployments:

```bash
npx wrangler@4.115.0 deployments status --json
```

Ghi lại current D1 Time Travel bookmark:

```bash
npx wrangler@4.115.0 d1 time-travel info giacong-vn-catalog
```

Tạo full SQL export trước thay đổi dữ liệu/schema quan trọng:

```bash
mkdir -p backups
npx wrangler@4.115.0 d1 export giacong-vn-catalog \
  --remote \
  --output="backups/giacong-vn-catalog-prechange-YYYYMMDD-HHMMSS.sql"
```

File backup chứa dữ liệu production và **không được commit vào Git**. Lưu nó vào kho backup được kiểm soát quyền truy cập theo quy trình vận hành của dự án.

### Production migration/deploy

Không chạy khi staging acceptance hoặc backup evidence chưa đạt.

Apply pending D1 migrations production:

```bash
npx wrangler@4.115.0 d1 migrations apply GIACONG_VN_CATALOG --remote
```

Sau đó build/package production và deploy bằng OpenNext procedure đã được review cho commit đó. Không dùng `--env=staging` cho production.

Ngay sau deploy phải smoke-test ít nhất:

- `/`;
- `/san-pham`;
- một product detail có variant/tier;
- `/gui-yeu-cau`;
- `/tin-tuc` và một article published;
- `/thue-gia-cong/...`;
- admin Access/login/session;
- cart revalidation/submit bằng dữ liệu test được phép;
- lead D1 persistence → Queue delivery diagnostics;
- một media URL R2 thật.

## 5. Worker rollback

Cloudflare Worker rollback tạo ngay một deployment mới dùng version được chọn và đưa version đó trở thành active deployment. Rollback code **không thay đổi D1/R2/Queue state**.

Liệt kê deployment/version hiện hành trước khi rollback:

```bash
npx wrangler@4.115.0 deployments status --json
```

Rollback tới version ID đã ghi nhận:

```bash
npx wrangler@4.115.0 rollback <VERSION_ID> \
  --message "Rollback production after <incident/change-id>"
```

Không rollback mù nếu version đích phụ thuộc binding/resource đã bị xóa hoặc thay đổi không tương thích. Nếu schema đã thay đổi, code cũ có thể không chạy được trên schema mới dù Worker rollback thành công.

Sau Worker rollback:

1. xác nhận active deployment;
2. smoke-test public + admin read path;
3. kiểm tra lead Queue/DLQ và delivery diagnostics;
4. không tự rollback D1 trừ khi incident yêu cầu và restore point đã được xác định;
5. ghi incident/change log.

## 6. D1 recovery

### Nguyên tắc

D1 Time Travel restore là thao tác **destructive, overwrite in place**. Không chạy production restore chỉ để thử nghiệm. Restore drill phải được chứng minh trên staging trước.

### Xem current bookmark

Staging:

```bash
npx wrangler@4.115.0 d1 time-travel info giacong-vn-catalog-staging
```

Production:

```bash
npx wrangler@4.115.0 d1 time-travel info giacong-vn-catalog
```

Có thể truy vấn bookmark cho một timestamp RFC3339:

```bash
npx wrangler@4.115.0 d1 time-travel info giacong-vn-catalog-staging \
  --timestamp="2026-08-18T09:00:00+07:00"
```

### Restore bằng bookmark/timestamp

**Staging drill only, có chủ ý:**

```bash
npx wrangler@4.115.0 d1 time-travel restore giacong-vn-catalog-staging \
  --bookmark=<BOOKMARK>
```

hoặc:

```bash
npx wrangler@4.115.0 d1 time-travel restore giacong-vn-catalog-staging \
  --timestamp="<RFC3339_TIMESTAMP>"
```

Cloudflare trả bookmark cho trạng thái trước restore; phải ghi lại bookmark này để có khả năng undo restore nếu cần.

### Staging restore drill acceptance

Một drill chỉ được tính là pass khi:

1. chụp pre-drill bookmark và SQL export;
2. ghi lại row-count/invariant baseline của catalog, CMS, lead, audit và News;
3. tạo một thay đổi **staging-only** có thể nhận diện;
4. restore staging về bookmark/timestamp đã chọn;
5. xác nhận thay đổi thử nghiệm biến mất;
6. `PRAGMA quick_check`/schema/migration history hợp lệ;
7. storefront, admin read path, News, cart revalidation và media-reference reads vẫn hoạt động;
8. post-restore deep QA xanh;
9. ghi lại thời gian restore, bookmark trước/sau và người thực hiện.

Production restore chỉ được cân nhắc sau khi staging drill đã chứng minh runbook và incident owner xác định chính xác restore point.

## 7. D1 SQL export

D1 export là lớp backup bổ sung, đặc biệt hữu ích cho snapshot trước change và lưu giữ ngoài Time Travel window.

Staging:

```bash
npx wrangler@4.115.0 d1 export giacong-vn-catalog-staging \
  --remote \
  --output="backups/giacong-vn-catalog-staging-YYYYMMDD-HHMMSS.sql"
```

Production:

```bash
npx wrangler@4.115.0 d1 export giacong-vn-catalog \
  --remote \
  --output="backups/giacong-vn-catalog-YYYYMMDD-HHMMSS.sql"
```

Không dùng một export chưa được kiểm tra như bằng chứng duy nhất của recoverability. Recovery phải được drill.

## 8. R2/media recovery và reconciliation

Worker rollback hoặc D1 Time Travel không tự hoàn nguyên object R2.

Media lifecycle hiện dùng D1 metadata/reference guards và R2 object cleanup. Khi incident liên quan media:

- ưu tiên giữ D1 metadata/tombstone làm nguồn điều tra;
- không bulk-delete R2 chỉ vì D1 restore đã diễn ra;
- đối chiếu referenced media keys từ D1 với object R2;
- object thiếu phải được phục hồi từ nguồn media được phê duyệt hoặc re-upload có kiểm soát;
- orphan object chỉ cleanup sau reference-safe verification;
- Next cache R2 có thể được tái tạo, nhưng product/site/news media không được xem là cache.

Nếu chưa có external media backup đã được kiểm chứng, đó là một production recovery gap và phải được ghi rõ trong launch acceptance thay vì giả định R2 có thể tự phục hồi.

## 9. Queue, DLQ và secondary delivery

Rollback code/database không “undo” message Queue đã enqueue hoặc delivery đã thực hiện.

Sau incident:

- kiểm tra lead canonical row trong D1 trước;
- dùng delivery status/attempt/error fields để xác định trạng thái;
- kiểm tra Queue retry/DLQ;
- không tạo lead mới chỉ để retry một lead đã tồn tại;
- request ID/fingerprint/idempotency vẫn là ranh giới chống duplicate;
- Google Sheet có thể thiếu/chậm/duplicate delivery ở tầng integration, nhưng không được dùng để quyết định canonical lead có tồn tại hay không.

## 10. Production NO-GO / rollback triggers

Không production deploy hoặc phải cân nhắc rollback khi có một trong các điều kiện:

- staging post-deploy QA đỏ;
- migration preflight/backup evidence thiếu;
- production dependency gate đỏ hoặc security exception hết hạn;
- admin Access/membership fail-open hoặc không xác minh được;
- lead persistence/idempotency/Queue path lỗi;
- cart canonical revalidation sai giá/MOQ/tier;
- D1 invariant/schema check lỗi;
- media reference safety lỗi;
- 5xx tăng bất thường sau deploy;
- production data/content chưa được owner duyệt.

Worker rollback ưu tiên khi lỗi nằm ở code/deployment và schema hiện tại vẫn tương thích với code trước. D1 restore chỉ dùng khi incident nằm ở dữ liệu và restore point đã được xác định.

## 11. Bằng chứng cần giữ cho mỗi production change

- Git commit SHA;
- PR/acceptance result;
- staging Worker version ID;
- production Worker version trước và sau change;
- D1 pre-change bookmark;
- path/hash của SQL export được lưu ngoài repo;
- migration list trước/sau;
- smoke-test result;
- rollback target;
- incident/change owner;
- nếu rollback/restore xảy ra: lệnh, timestamp, bookmark/version và verification result.

## 12. Trạng thái production readiness

Việc có resource production trong `wrangler.jsonc` **không đồng nghĩa production-ready**. Launch vẫn cần đồng thời:

- production data/content approval;
- staging restore drill đã pass;
- production backup location/media recovery policy đã được xác nhận;
- security/accessibility/performance acceptance đạt ngưỡng đã khóa;
- observability/alert/rollback ownership rõ;
- production promotion procedure được phê duyệt.

Cho đến khi các điều kiện này có bằng chứng, trạng thái vẫn là **NO-GO production launch**.
