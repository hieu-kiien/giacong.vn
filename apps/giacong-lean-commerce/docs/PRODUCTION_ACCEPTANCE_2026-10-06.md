# Production release and browser acceptance — 2026-10-06

Status: in progress; not yet approved for customer handover.

## Release guard and rollback

- User approved production commit/push/deployment, separate Google OAuth and scoped email sender, and publishing basic-profile Google login.
- Production D1 export is stored privately in ignored `.runtime/production-pre-release-20261005.sql`; SHA256 `7cc58a31a8e4f0c7cd769f66073f32a50a48638fde00ddaf3ab00bb73e04b8e1`.
- Existing data baseline: 9 hidden products, 17 variants, 51 tier prices, 14 services, 1 request, 3 active owners, 0 news posts. Preserve existing publication states and data; do not copy staging fixtures.
- Ten additive migrations (0029–0038) were rehearsed against the export. Existing row values were preserved, foreign-key check passed, and the guard rejected replay. Remote execution must abort if baseline counts/schema differ, then verify all original row values and foreign keys after export.
- Previous production Worker version: `a2ffab9c-1dfa-4c10-9edb-57154a44c02d`. Roll back traffic to this version on failed acceptance. Keep additive schema on rollback; do not restore an old database over new customer data.
- Production Apps Script was upgraded in place from version 3 to 4, retaining endpoint and secret. Original source and workbook export are private ignored backups. Repoint existing deployment to version 3 if webhook compatibility fails.
- Keep Cloudflare Access configuration and `ADMIN_PUBLIC=false`. Website account admission requires verified identity plus active owner membership.

## External dependencies observed

- Google application is published; separate production client has production callback URLs.
- Production sender `auth.kienhieu.id.vn` is verified, with a sending-only domain-scoped key. A real configuration probe arrived in the owner's Gmail inbox. This does not prove registration/recovery flows yet.
- Apps Script deployment UI confirmed version 4 at 12:23 on 6 October 2026.

## Browser evidence so far

- Staging desktop: coherent branded account header and login form were viewed directly.
- Empty login submission: Vietnamese required-field message displayed and focus moved to email.
- Google owner login: browser returned to account page, showing contact profile, request history, confirmed-sale history and owner admin entry.
- Same account entered staging admin successfully; overview and customer list were viewed directly.
- Customer list shows the existing labeled staging fixture with email and phone `0000000000`.
- Excel button was clicked, but download event did not complete and no success/error message appeared. Export acceptance remains unresolved.
- Independent review found admin-subdomain account-login links targeting an unsupported auth origin. Links now resolve to the matching storefront; regression test was RED then GREEN. Runtime verification remains pending deployment.

### Additional real browser checks and fixes

- Product #15: changed and restored short description, observed unsaved-change confirmation, saved/reloaded, published for cart acceptance, then restored to draft and confirmed saved.
- Cart: quantity 2→4 and total 49,380 VND matched; missing phone/province showed field guidance; labeled staging request was stored and cart cleared. Confirmed staging sale `ZL-20261006-378930AF` appeared in customer and account histories with matching quantity/total.
- First request exposed a webhook contract mismatch: Worker sends `Đặt sản phẩm`, Apps Script accepted only the legacy large-quantity cart type. Allowlist fix passed RED→GREEN; staging Apps Script version 3 was deployed. Second request `LEAD-AE6C0C8557` was observed as `Đã gửi xong`, with its row visible in Sheets.
- Sheets observation exposed leading-zero phone coercion in request/sale rows. Text format is now applied before writing those phone cells; RED→GREEN tests passed. Staging Apps Script version 4 deployed at 13:02. Real retry proving preserved phone remains pending.
- Account mobile layout at 390×844 was observed directly with branded header, menu and cards without overlap.
- Service #16: empty-name save showed the field error, but exposed `VALIDATION_ERROR`; technical code prefixes were removed from product/service/media/import/access messages. Edit/save/reload was confirmed. Service preview links led to 404 because they used `/dich-vu/`; corrected to the live `/thue-gia-cong/` route. Browser verification awaits Worker deployment.
- Excel now provides a live ready message and a persistent retry download link, with object URL cleanup. Independent review found no blocker. Actual file download still requires browser acceptance.

GitNexus full change analysis must precede each commit. Apps Script `.gs` symbols are not indexed (impact is UNKNOWN); literal caller confirmation, VM contract regressions and independent review supplement the graph check, rather than treating zero graph edges as safe.

- News: created a labeled staging draft, published it, observed the listing and article content, then returned it to draft. Article screenshot exposed white navigation on a light background; it now reuses the direct-page header surface already used by product/service pages. Runtime visual verification awaits deployment.
- Brand settings: group filtering and save-draft were operated; the staging tagline draft was restored to the original value. Publication completion remains to be checked.
- Contact form: missing fields showed a Vietnamese error, valid labeled request was accepted. After version 4, a real Sheet row still displayed phone as `0`; formatting before `appendRow` was insufficient. Request writing now uses `setValues` on the preformatted exact row, protected by the existing script lock. RED→GREEN regressions and independent review passed; staging version 5 deployed at 13:17. New real request `PHONE RANGE` is awaiting delivery verification.
- Commit `e1ca7c69` passed GitHub quality, graph and D1 gates. Its staging version `8c47204f-5c47-4eb9-b7e1-8bbd5724876f` was uploaded without changing traffic; preview runtime gate is in progress.

Screenshots and detailed private runtime evidence are regeneratable artifacts in ignored `.runtime/`. No credentials or customer exports belong in Git.

## Remaining acceptance

### Browser continuation, 6 October

- Commit `6310ea26`: preview runtime gate run `37424896457` passed. Staging now serves version `166ad2b9-472b-4e79-8d1c-c6f32a14bb4b` at 100%; production traffic has not changed.
- Real Sheets observation confirmed the new `PHONE RANGE` request retains `0000000000` after staging Apps Script version 5. Confirmed sale `ZL-20261006-EFED64E4` was saved in admin for 24,690 VND; Sheets cells B3/J3 visibly contain its matching code and `0000000000`.
- News detail was visually retested after deployment: green navigation, logo and article no longer overlap. The labeled test article was returned to draft; admin shows 0 published / 3 draft posts.
- Service empty-name submission now visibly shows `Dữ liệu dịch vụ chưa hợp lệ.` and `Tên dịch vụ là bắt buộc.` without a technical error code. Input was restored to its saved original value.
- Customer detail shows name, email, phone, request history and confirmed-sale total without a username. No-result search displays Vietnamese guidance.
- Excel ready message and retry link were observed. Tool download capture timed out, but the user confirmed Chrome downloaded the file. Download is accepted with user evidence; workbook contents still require inspection.
- Brand tagline draft was restored to the published original; UI returned to `Đã đăng`, with publication disabled because there is no draft difference.
- Registration form is prepared with a labeled staging account. User agreed to enter and submit the new password themselves; completion is still pending. Browser policy requires user handoff for new credentials.
- Media: changed alt text on the existing staging fixture, saved, reloaded and observed persistence; restored original `Ảnh QA product staging 20260824`, saved and observed restoration. Success message was Vietnamese.
- Audit: real media updates and news publication/unpublication appeared with timestamps and revisions. The view still exposes internal actor IDs, table names and request UUIDs; simplify default presentation before customer handover.
- Menu: saved a labeled Home draft; public Home remained unchanged. Saved original Home value again; UI confirmed `Đã lưu bản nháp “Home”.`, `Đã đăng` and disabled publication because the draft equals the published value.
- Further UI polish found by direct observation: media overview exposes R2/D1/CDN/cache terminology; menu shows legacy IDs; Excel ready/retry notice survives search changes and may refer to a previous filter. Source changes simplify media/member/menu labels, collapse audit identifiers into details, and abort/reset export on search changes. RED→GREEN regressions and full `npm run check` passed; independent review found no blocker. Runtime acceptance of these changes awaits staging deployment.
- Image upload is pending browser extension file-access permission or user selection. A native required-field message was observed on an empty new variant; the entry was cancelled without creating data.

**Handover verdict: not ready for final customer acceptance yet.** Remaining credential flows, workbook contents, role/session checks and remaining feature coverage must be completed before promotion and final production smoke acceptance.

Registration/verification/recovery, customer-role denial, profile/request delivery and Sheet copy, confirmed sale/history/Excel, product/service/content edits and validation, unsaved-change protection, responsive layouts, logout/session behavior, and production post-deployment smoke checks must have observed evidence before final handover.
