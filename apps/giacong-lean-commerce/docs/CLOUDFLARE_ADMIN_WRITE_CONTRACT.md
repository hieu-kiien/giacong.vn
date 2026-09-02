# Cloudflare-native admin write contract

**Status:** Lean V1 staging contract. This is a server contract, not permission to change production.

This document defines the security, data-integrity and HTTP behavior that must exist before the Cloudflare-native admin UI is allowed to mutate D1 or R2. It complements `CLOUDFLARE_NATIVE_V1_PLAN.md` and the engineering baseline tracked in GitHub issue #10.

## 1. Scope and trust boundary

Staging admin target:

- hostname: `admin-staging.kienhieu.id.vn`;
- edge protection: Cloudflare Access self-hosted application and allow policy;
- Worker route: `admin-staging.kienhieu.id.vn/*` → `giacong-vn-staging`;
- canonical D1 binding: `GIACONG_VN_CATALOG`;
- canonical R2 binding: `GIACONG_VN_PRODUCT_MEDIA`.

The browser never receives D1/R2 credentials and never calls D1/R2 APIs directly. All reads and writes cross a server-side Worker boundary. Public storefront hosts, `workers.dev` URLs and preview URLs must not become alternate admin-write paths.

Request inbox management is outside this contract. Google Sheet + Apps Script remains the request queue until a separate product decision changes it.

## 2. Authentication and request admission

Every `/api/admin/**` route fails closed unless its admission checks pass.

Required checks:

1. In staging, request hostname is exactly `admin-staging.kienhieu.id.vn`.
2. Read `Cf-Access-Jwt-Assertion`; never trust an arbitrary identity/email header as proof of authentication.
3. Cryptographically verify the Access JWT against the account JWKS and the configured issuer/team domain and application audience. Signature, issuer, audience and token time validity must pass.
4. Missing auth configuration is a deployment failure and must fail closed, not disable authentication.
5. Mutation methods require an exact same-origin `Origin` matching the admin origin. Cross-origin browser mutations are rejected.
6. Enforce the endpoint `Content-Type` before parsing.
7. Enforce a byte limit before accepting/parsing the full request body.
8. Admin responses use `Cache-Control: no-store`.

Wrong-host requests to `/api/admin/**` should be hidden with `404`. Invalid/missing Access identity on the correct admin host is rejected with a safe `401` or `403` response. Do not return JWT/JWKS details, claims, stack traces or internal configuration values.

Lean V1 has no customer identity or customer team management. Internal administration uses the D1-backed roles `owner`, `content_manager`, `catalog_manager`, `sales_manager` and `viewer`. `owner` has full administrative access, while the other roles are limited to their documented capabilities and `viewer` is read-only. Cloudflare Access authenticates the operator; the `admin_members` record authorizes the operation. Any member or role change must be owner-only, same-origin, audited and fail closed.

## 3. HTTP and JSON contract

Successful JSON response:

```json
{
  "ok": true,
  "requestId": "uuid",
  "data": {}
}
```

Failed JSON response:

```json
{
  "ok": false,
  "requestId": "uuid",
  "code": "VALIDATION_ERROR",
  "message": "Safe operator-facing message",
  "fieldErrors": {}
}
```

`fieldErrors` is optional. Never return SQL, stack traces, binding names, secrets or raw internal exceptions.

Status mapping:

- `400` malformed JSON/request shape;
- `401` missing/invalid identity where appropriate;
- `403` authenticated request not admitted;
- `404` not found or intentionally hidden wrong-host admin route;
- `409` uniqueness conflict, stale write, idempotency conflict or referenced-media conflict;
- `413` payload too large;
- `415` unsupported content/media type;
- `422` business-rule validation failure;
- `500` unexpected failure with generic message only.

Stable V1 error codes:

- `INVALID_REQUEST`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `UNIQUE_CONFLICT`
- `STALE_WRITE`
- `IDEMPOTENCY_CONFLICT`
- `MEDIA_IN_USE`
- `UNSUPPORTED_MEDIA`
- `PAYLOAD_TOO_LARGE`
- `FORBIDDEN`
- `INTERNAL_ERROR`

## 4. Durable optimistic concurrency

Do not use second-resolution `updated_at` as the collision-safety token.

The admin foundation migration adds a positive integer `revision` to mutable rows. API `version` is an opaque server representation of that revision.

Rules:

- creates do not accept client `version` and begin with revision `1`;
- update/delete requires the last server version read by the operator;
- mutation predicate includes both entity ID and expected revision;
- successful update increments revision exactly once;
- zero changed rows are distinguished between `404 NOT_FOUND` and `409 STALE_WRITE`;
- server returns the canonical persisted entity and new opaque `version`;
- client clocks never participate in concurrency decisions;
- `updated_at` remains human-readable metadata and is refreshed server-side.

Tier-price replacement uses the parent variant revision as its concurrency token. `variant_tier_prices` does not need independent revision columns in Lean V1.

## 5. Atomicity and D1 discipline

- Use D1 prepared statements with bound parameters for all user-controlled values.
- Never interpolate untrusted strings into SQL identifiers or SQL fragments.
- Multi-statement business changes that must remain consistent use D1 atomic batch/transaction semantics.
- Business mutation and its audit insert are coupled so one cannot succeed without the other.
- Schema changes use explicit tracked D1 migrations only. Runtime code never creates/alters schema.
- Before staging schema/data mutation, guard the expected state; after mutation, verify postconditions and invariants.

### Site settings P2 contract

The per-setting write slice uses these routes:

- `PATCH /api/admin/site-settings` with exactly `requestId`, `key`,
  `expectedVersion` and `value`;
- `POST /api/admin/site-settings/publish` with exactly `requestId`, `key` and
  `expectedVersion`.

Both routes require a valid UUID request ID, `application/json`, a body no larger
than 64 KiB, a positive integer version and the existing content
write/publish capability. A successful mutation increments the setting version
once and writes the setting update plus its audit record in one D1 batch. A
repeated request ID with the same canonical payload is idempotent; reusing it for
another operation or payload returns `409 IDEMPOTENCY_CONFLICT`.

The schemas for this slice are `migrations/0010_site_settings_write_contract.sql`
and `migrations/0011_site_settings_bulk_publish.sql`.

`POST /api/admin/site-settings/publish-all` also requires exactly `requestId` and
uses the same 64 KiB/request-id boundary. It records one bulk audit envelope and
one linked per-setting audit for every successful row in the same D1 batch. Rows
that lose an optimistic-version race are returned as `skipped`; replaying the
same request ID returns the recorded result without repeating any write.

### News P3 contract

News editing uses two persisted snapshots. The editable draft is stored in
`draft_slug`, `draft_title`, `draft_excerpt`, `draft_content` and
`draft_cover_image_url`; the public snapshot is stored in the corresponding
`published_*` fields. The legacy unprefixed columns remain a compatibility
projection of the draft. Public list/detail queries must select only the
published snapshot and require `is_published = 1`.

Routes and exact mutation bodies:

- `POST /api/admin/news`: `{ requestId, slug, title, excerpt, content,
  coverImageUrl }` creates a draft at revision `1`;
- `PATCH /api/admin/news/[id]`: `{ requestId, revision, slug, title, excerpt,
  content, coverImageUrl }` updates only the draft and increments revision once;
- `DELETE /api/admin/news/[id]`: `{ requestId, revision }` deletes only when
  the supplied revision is current;
- `POST /api/admin/news/[id]/publish`: `{ requestId, expectedRevision,
  publish }` copies the validated draft to the public snapshot when `publish`
  is true, or hides it when false;
- `POST /api/admin/news/batch`: `{ requestId, publish, items }`, where `items`
  contains unique `{ id, expectedRevision }` entries and is capped at 100.

News writes use the same bounded JSON, same-origin, capability, revision and
request-id rules as other admin mutations. Publishing requires a non-empty
excerpt. A batch returns `changed`, `changedCount`, `selectedCount` and safe
per-item `skipped` reasons (`not_found`, `stale`, `validation`) rather than
claiming success for the whole selection. Draft/update, publish/unpublish and
delete audits are coupled to their D1 mutation; batch writes also record one
`admin_news_bulk_audit` envelope and one child audit for every changed item.
Migration `0012_news_draft_publish_contract.sql` must be applied and verified
before enabling these writes on staging.

### Managed page P4 contract

Managed pages use the same draft/published separation as news, but their content
is a validated `PageBlock[]` snapshot rather than arbitrary HTML. The routes are:

- `GET /api/admin/pages` — bounded list of up to 100 pages;
- `POST /api/admin/pages`: `{ requestId, pageKey, routePath, title }` creates a
  disabled draft at version `1`;
- `PATCH /api/admin/pages/[pageKey]`: `{ requestId, blocks, draftEnabled,
  expectedVersion, seoTitle, seoDescription }` replaces the complete draft
  snapshot and increments the page version once;
- `POST /api/admin/pages/[pageKey]/publish`: `{ requestId, expectedVersion }`
  copies the validated draft to the published snapshot and increments the
  version once.

The page key and route path are normalized to safe internal forms. Blocks are
parsed by the shared page-builder contract; HTML/markup and unknown block shapes
are rejected. Create, draft save and publish all require the page capability,
same-origin request and a valid UUID request ID. A repeated request ID with the
same canonical fingerprint replays the persisted result; another fingerprint
returns `409 IDEMPOTENCY_CONFLICT`. The page mutation and its specialized audit
row are one D1 batch, with `site_pages.last_request_id` retained for the latest
request marker and `admin_site_page_audit` providing the page-specific audit
envelope.

Migration `0019_admin_site_page_write_contract.sql` must be applied and verified
on staging before relying on this write contract.

## 6. Canonical normalization

The server performs only deterministic normalization:

- trim leading/trailing Unicode whitespace from human text;
- normalize slugs to lowercase ASCII hyphenated form;
- trim SKU while preserving operator-provided case until a future schema decision says otherwise;
- booleans become stored `0/1` only inside persistence adapters;
- VND prices are positive integers, never floating point;
- integer quantity fields reject fractions, NaN, infinity and unapproved numeric-string coercion.

Invalid MOQ/step/tier/contact combinations are rejected, never silently repaired.

## 7. Category contract

Routes:

- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `GET /api/admin/categories/[id]`
- `PATCH /api/admin/categories/[id]`
- `GET /api/admin/categories/batch?ids=<comma-separated-ids>` — manager-only
  revision snapshot trước batch action;
- `POST /api/admin/categories/batch` — manager-only soft-deactivate tối đa 100
  category trong một batch, per-item skip và replay idempotency.

Deletion is out of Lean V1; deactivation is the safe removal path.

Create exact fields:

- `name`: string, 1..120 chars;
- `slug`: string, 1..140 chars after normalization;
- `description`: string, 0..5000 chars;
- `imageUrl`: string or null, max 500 chars;
- `sortOrder`: integer, 0..1,000,000;
- `isActive`: boolean.

Update contains the same fields plus required `revision`. Slug conflict returns `409 UNIQUE_CONFLICT`.

## 8. Product contract

Routes:

- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/products/[id]`
- `PATCH /api/admin/products/[id]`
- `DELETE /api/admin/products/[id]` — soft archive

Deletion is soft archive only; variants, prices and lead references remain intact.

Exact mutation bodies:

- `POST`: `{ requestId, categoryId, description, imageUrl, isActive,
  leadTimeDays, name, shortDescription, sku, slug, status }`;
- `PATCH`: `{ requestId, revision, categoryId, description, imageUrl, isActive,
  leadTimeDays, name, shortDescription, sku, slug, status }`;
- `DELETE`: `{ requestId, revision }`.

All keys are required and unknown keys are rejected. Numeric fields must arrive as
JSON numbers, not numeric strings. Create starts at revision `1`; update/archive
match the supplied revision and increment it exactly once. Every product write,
the optional `product_admin_meta` projection, and its `admin_audit_log` row are
coupled in one D1 batch. Reusing a request ID with the same canonical payload is
safe; another payload or operation returns `409 IDEMPOTENCY_CONFLICT`.

Canonical fields:

- `name`: string, 1..180 chars;
- `slug`: string, 1..200 chars;
- `sku`: string, 1..120 chars;
- `shortDescription`: string, 0..1000 chars;
- `description`: string, 0..30000 chars;
- `imageUrl`: string or null, max 500 chars;
- `categoryId`: positive integer or null;
- `isActive`: boolean;
- update/delete only: `requestId` and positive `revision`.

Validation:

- unique slug;
- unique SKU;
- non-null category reference exists;
- managed media references use canonical `/media/products/...` form.

Product detail response includes variants and tier prices so the editor starts
from one canonical snapshot. Publishing still requires the existing variant
validation gate.

### Product bulk import P5 contract

`POST /api/admin/products/import` is the JSON-only bulk import boundary. It
requires `Content-Type: application/json`, one valid UUID v4 in
`Idempotency-Key` or `X-Request-Id` (both may be sent only when identical), a
streamed body no larger than 64 KiB, and at most 50 rows. The body is exactly
`{ rows }`; each row uses the reviewed import fields and category references are
resolved server-side by slug. Only `owner` and `catalog_manager` may call it.

The server validates every row before any write. A successful import always
creates inactive `draft` products, and returns `{ createdCount, productIds,
replayed }`. Product rows, `product_admin_meta`, the idempotency marker and one
audit row per product are written in one D1 batch; a failed row or uniqueness
conflict leaves the batch unchanged. A repeated UUID with the same canonical
raw rows replays the original product IDs without re-reading categories or
writing again. Reusing it for another payload returns
`409 IDEMPOTENCY_CONFLICT`. Category/row validation is returned as `422`,
uniqueness as `409 UNIQUE_CONFLICT`, and unsupported content type as `415`.

This slice intentionally exposes no CSV upload UI yet: the parser/helper and
server JSON contract are ready for the P5 admin surface, while browser and
staging evidence remain release gates.

## 9. Variant contract

Routes:

- `GET /api/admin/products/[productId]/variants`
- `POST /api/admin/products/[productId]/variants`
- `PATCH /api/admin/products/[productId]/variants/[variantId]`
- `DELETE /api/admin/products/[productId]/variants/[variantId]`

Exact mutation bodies:

- `POST`: `{ requestId, attributeCode, attributeId, attributeLabel,
  contactFromQuantity, imageUrl, isAvailable, moq, name, optionId,
  optionLabel, quantityStep, sku, sortOrder, tierPrices, unit }`;
- `PATCH`: the same fields plus positive `revision`;
- `DELETE`: `{ requestId, revision }`.

The envelope and each tier object are exact; unknown keys and numeric-string
coercion are rejected. Variant create/update/archive, tier replacement and the
variant `admin_audit_log` row are one D1 batch. The parent variant revision is
the concurrency token and increments exactly once for update/archive.

Fields:

- `name`: string, 1..180 chars;
- `sku`: string, 1..120 chars, unique;
- `optionLabel`: string, 1..120 chars;
- `unit`: string, 1..50 chars;
- `moq`: positive integer;
- `quantityStep`: positive integer;
- `contactFromQuantity`: positive integer;
- `isAvailable`: boolean;
- `sortOrder`: integer, 0..1,000,000;
- `attributeId`: positive integer;
- `attributeCode`: string, 1..120 chars;
- `attributeLabel`: string, 1..120 chars;
- `optionId`: non-negative integer;
- `imageUrl`: string or null, max 500 chars;
- update/delete only: `requestId` and positive `revision`.

Canonical business invariants, matching the active storefront/cart read path:

```text
moq > 0
quantityStep > 0
contactFromQuantity > moq
(contactFromQuantity - moq) % quantityStep == 0
```

A write that makes existing tiers unreachable under a changed MOQ/step is rejected unless the same atomic operation replaces those tiers with a valid complete set.

## 10. Tier-price contract

Preferred write shape:

- `tierPrices` trong `POST/PATCH /api/admin/products/[productId]/variants...`;
  hiện chưa có route `PUT` standalone riêng.

Lean V1 should prefer complete atomic replacement rather than exposing a UI that performs transient row-by-row pricing changes.

Input includes parent variant `revision` and the complete tier set. Every tier has:

- `minQuantity`: positive integer;
- `price`: positive integer VND.

Invariants:

```text
minQuantity >= variant.moq
minQuantity < variant.contactFromQuantity
(minQuantity - variant.moq) % variant.quantityStep == 0
price > 0
currency == "VND"
```

Within a variant:

- `minQuantity` is unique and strictly ascending after canonical sort;
- a priced variant must contain a tier at exactly MOQ;
- duplicate boundaries are rejected;
- replacement and parent revision increment are atomic;
- resulting state must be readable by the existing storefront/cart code.

Nếu cần mở route tier-price standalone trong tương lai, phải tạo contract và
impact/test riêng; không suy diễn route chưa tồn tại từ tài liệu cũ.

## 11. Product media contract

Routes:

- `POST /api/admin/media`
- `GET /api/admin/media`
- `PATCH /api/admin/media/[id]`
- `DELETE /api/admin/media/[id]`
- `POST /api/admin/media/cleanup`

Upload rules:

- `multipart/form-data`, one file per request;
- max file: **8 MiB**, with separately bounded multipart overhead;
- only JPEG, PNG and WebP;
- validate file signature/magic bytes server-side in addition to declared MIME;
- server generates `products/<uuid>.<ext>`; client cannot choose arbitrary R2 paths;
- canonical public URL is `/media/products/<uuid>.<ext>`;
- set explicit R2 HTTP content type metadata;
- no SVG, executable/archive/arbitrary binary upload in V1;
- browser never receives presigned write credentials in V1.

Before delete, query D1 product and variant references. Any live reference returns `409 MEDIA_IN_USE`. A missing object can be treated idempotently only when D1 reference state is clear.

## 12. Service-content contract

Routes:

- `GET /api/admin/services`
- `GET /api/admin/services/[id]`
- `GET /api/admin/services/batch?ids=<comma-separated-ids>` — manager-only revision snapshot trước batch action;
- `POST /api/admin/services/batch` — manager-only archive nhiều service trong phạm vi tối đa 100 item;
- `PATCH /api/admin/services/[id]`
- `DELETE /api/admin/services/[id]`

Fields:

- `slug`: string, 1..200 chars, unique;
- `name`: string, 1..180 chars;
- `summary`: string, 0..2000 chars;
- `description`: string, 0..30000 chars;
- `metaTitle`: string, 0..180 chars;
- `isActive`: boolean;
- service row hiện tại giữ nguyên read shape dùng chung; không thêm `revision` trực tiếp vào `AdminService` trong lát này vì interface có fan-out lớn;
- batch archive nhận `{ requestId, items: [{ id, expectedRevision }] }`, đọc snapshot revision server-side, chỉ archive item active khớp revision;
- batch trả `changedCount`, `selectedCount`, `replayed` và `skipped[]` với reason `not_found`, `stale` hoặc `already_archived`;
- batch archive cập nhật `services.revision`, đồng bộ `service_admin_meta` khi có bảng, ghi audit child/envelope và dùng `admin_audit_log` để idempotency;
- update/delete legacy hiện hữu vẫn là contract riêng; không coi batch snapshot là thay đổi ngầm cho các route đó.

Creating service taxonomy remains deferred until existing service-page mapping is reconciled. Initial UI may be edit-only for managed rows.

## 13. Audit log and idempotency

Before mutation endpoints are enabled, the tracked D1 admin-foundation migration must exist and be verified on staging.

Every successful mutation records:

- unique UUID `request_id`;
- server timestamp;
- validated Cloudflare Access actor subject;
- action: `create`, `update`, `delete`, `upload`;
- constrained entity type;
- entity key/identifier;
- previous revision when applicable;
- resulting revision when applicable;
- lowercase SHA-256 fingerprint of the canonical accepted mutation payload.

Do not store Access JWTs, secrets or unnecessary PII.

For retriable creates/uploads and other mutations, duplicate successful `requestId` + identical payload fingerprint must not repeat the side effect. Reusing a request ID with a different fingerprint returns `409 IDEMPOTENCY_CONFLICT`.

The audit record is part of the atomic mutation boundary for D1 business changes. For R2 operations, design compensation/idempotency so uncertain network retries cannot create duplicate objects or silently lose reference integrity.

## 14. Collection and body limits

Admin collections must be explicitly bounded. Initial default page size is 50 and hard maximum is 100 unless a narrower endpoint limit is documented.

Body limits:

- normal JSON mutation: 64 KiB;
- long product/service content mutation: 128 KiB when the route explicitly opts
  into the long limit. Các route product/service hiện tại dùng bounded parser mặc
  định 64 KiB cùng field-level bounds; việc mở budget 128 KiB là follow-up riêng,
  cần test và impact review trên shared helper.
- media: 8 MiB file plus bounded multipart overhead.

As of 2026-08-31, the admin JSON write routes use the shared bounded parser
(`readBoundedAdminJson`) and the primary admin collection read models enforce an
explicit `LIMIT 100`. This is verified by `scripts/admin-request.test.mts` and
the full `npm run check` gate; it does not replace authenticated browser role
read-back.

Reject oversized bodies with `413 PAYLOAD_TOO_LARGE` before normal parsing/work.

## 15. Required automated tests before UI writes

Admission/security:

- wrong hostname rejected;
- missing JWT rejected;
- invalid signature rejected;
- wrong issuer rejected;
- wrong audience rejected;
- expired/not-yet-valid token rejected;
- public/preview/`workers.dev` host cannot write;
- cross-origin mutation rejected;
- oversized/wrong content type rejected;
- admin responses are `no-store` and errors leak no internal details.

Categories/products:

- create/update success;
- duplicate slug/SKU;
- missing category;
- stale version;
- revision increments exactly once;
- deactivation preserves canonical read behavior;
- idempotent retry and request-ID fingerprint conflict.

Variants/tiers:

- valid MOQ/step/contact threshold;
- contact threshold equal to or below MOQ rejected;
- unreachable contact threshold rejected;
- missing MOQ tier rejected;
- tier at/above contact threshold rejected;
- tier off step rejected;
- duplicate tier boundary rejected;
- stale variant write;
- SKU conflict;
- availability update;
- complete tier replacement is atomic and preserves cart pricing.

Media:

- valid JPEG/PNG/WebP accepted;
- MIME/signature mismatch rejected;
- unsupported/oversized upload rejected;
- server-generated namespace enforced;
- referenced delete rejected;
- unreferenced delete succeeds;
- duplicate request ID is idempotent.

Audit/integrity:

- every successful business mutation has one audit event;
- failed validation/stale/conflict has no business mutation;
- D1 business mutation and audit cannot split;
- payload fingerprint is deterministic;
- no SQL/stack/token/secret leakage.

After automated tests, staging runtime QA must perform protected admin writes and verify the public storefront reads the resulting canonical D1/R2 state correctly.

## 16. UI quality gate

The admin UI is built only after server write tests are green. It targets WCAG 2.2 AA and must include keyboard operation, visible focus, labeled controls, programmatic field errors, non-color-only status, usable touch targets, responsive layout, and explicit loading/empty/error/success/stale states.

Destructive actions require clear intent. Product/category removal uses deactivation in Lean V1 unless a separately reviewed delete contract exists.

## 17. Production prohibition

This contract remains staging-only until every production acceptance gate in `CLOUDFLARE_NATIVE_V1_PLAN.md` is met.

Do not:

- enable production admin writes to test this implementation;
- mutate production D1/R2 before accepted production migration/data plans exist;
- copy staging demo data into production implicitly;
- change `giacong-vn` or `kienhieu.id.vn/*` merely to test admin work.
